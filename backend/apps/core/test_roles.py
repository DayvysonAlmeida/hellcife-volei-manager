from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from apps.attendance.models import GameDay
from apps.evaluations.models import Evaluation
from apps.matches.models import Match
from apps.notifications.models import GlobalAnnouncement, Notification
from apps.players.models import Player
from .models import User


class RolesTestCase(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.moderator = User.objects.create_user('mod@x.com', 'senha-forte-123', name='Mod', profile='moderator')
        self.athlete = User.objects.create_user('mari@x.com', 'senha-forte-123', name='Mari', profile='player')
        self.mari = Player.objects.create(name='Mari', main_position='setter', gender='F', user=self.athlete, phone='81911112222')
        self.bia = Player.objects.create(
            name='Bia', main_position='libero', gender='F', phone='81988887777', notes='Pediu para jogar mais cedo', elo=640,
        )
        self.pending = Player.objects.create(name='Novata', main_position='outside', gender='F', status='pending')
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client


class AdminOnlyAreasTests(RolesTestCase):
    """Finanças, exclusões, fechamento de temporada e regulamento: só o admin. O moderador cuida do dia a dia."""

    def admin_only_calls(self):
        gameday = GameDay.objects.create(date=date.today(), is_published=True)
        match = Match.objects.create(date=date.today(), modality=2)
        victim = Player.objects.create(name='Excluir', main_position='middle', gender='M')
        return [
            ('delete', f'/api/players/{victim.id}/', None),
            ('delete', f'/api/matches/{match.id}/', None),
            ('post', f'/api/attendance/gamedays/{gameday.id}/revert-payment/', {'player_id': self.mari.id}),
            ('get', f'/api/attendance/gamedays/{gameday.id}/finance/', None),
            ('delete', f'/api/attendance/gamedays/{gameday.id}/', None),
            ('get', '/api/attendance/finance/overview/', None),
            ('get', '/api/attendance/finance/debtors/', None),
            ('post', '/api/players/seasons/1/validate/', None),
            ('patch', '/api/players/seasons/1/prize/', {'prize': 'x'}),
            ('post', f'/api/players/{self.bia.id}/recalculate-elo/', None),
            ('post', '/api/players/recalculate-all-elos/', None),
            ('post', '/api/subscriptions/plans/', {'name': 'Plano'}),
            ('put', '/api/hall-of-fame/regulation/1/', {'title': 'X', 'content': '<p>x</p>'}),
            ('post', '/api/hall-of-fame/', {'year': 2026}),
        ]

    def test_moderator_is_blocked(self):
        client = self.as_user(self.moderator)
        for method, url, data in self.admin_only_calls():
            with self.subTest(f'{method} {url}'):
                self.assertEqual(getattr(client, method)(url, data, format='json').status_code, 403)

    def test_admin_gets_through(self):
        client = self.as_user(self.admin)
        for method, url, data in self.admin_only_calls():
            with self.subTest(f'{method} {url}'):
                self.assertNotEqual(getattr(client, method)(url, data, format='json').status_code, 403)

    def test_moderator_keeps_the_court_day(self):
        gameday = GameDay.objects.create(date=date.today(), is_published=True)
        client = self.as_user(self.moderator)
        for method, url in [
            ('get', '/api/attendance/finance/claims/'),
            ('patch', f'/api/attendance/gamedays/{gameday.id}/toggle-payment/{self.mari.id}/'),
            ('get', '/api/dashboard/'),
        ]:
            with self.subTest(url):
                self.assertNotEqual(getattr(client, method)(url, format='json').status_code, 403)

        self.assertEqual(client.patch(f'/api/players/{self.bia.id}/', {'nickname': 'Bibi'}, format='json').status_code, 200)
        guest = Player.objects.create(name='Convidado', main_position='middle', gender='M', is_guest=True)
        self.assertEqual(client.delete(f'/api/players/{guest.id}/').status_code, 204)

    def test_moderator_does_not_see_everyones_subscriptions(self):
        self.assertEqual(self.as_user(self.moderator).get('/api/subscriptions/user-subscriptions/').status_code, 200)
        # sem cadastro de atleta: nenhuma assinatura (as dos outros só o admin vê)
        response = self.client.get('/api/subscriptions/user-subscriptions/')
        rows = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(list(rows), [])


class AthletePrivacyTests(RolesTestCase):
    """Pela API, o atleta não lê dados da staff nem dados privados de outros atletas."""

    def test_private_fields_of_others_come_empty(self):
        client = self.as_user(self.athlete)

        other = client.get(f'/api/players/{self.bia.id}/').data
        self.assertEqual((other['phone'], other['notes'], other['elo'], other['elo_tier']), (None, None, None, None))
        listed = next(p for p in client.get('/api/players/', {'page_size': 100}).data['results'] if p['id'] == self.bia.id)
        self.assertIsNone(listed['elo'])

        mine = client.get('/api/players/me/').data
        self.assertEqual(mine['phone'], '81911112222')
        self.assertIsNotNone(mine['elo'])

    def test_staff_sees_private_fields(self):
        data = self.as_user(self.moderator).get(f'/api/players/{self.bia.id}/').data
        self.assertEqual((data['phone'], data['notes'], data['elo']), ('81988887777', 'Pediu para jogar mais cedo', 640))

    def test_pending_signups_are_hidden_from_athletes(self):
        client = self.as_user(self.athlete)
        self.assertEqual(client.get(f'/api/players/{self.pending.id}/').status_code, 404)
        ids = [p['id'] for p in client.get('/api/players/', {'status': 'pending'}).data['results']]
        self.assertNotIn(self.pending.id, ids)

        self.assertEqual(self.as_user(self.moderator).get(f'/api/players/{self.pending.id}/').status_code, 200)

    def test_athlete_sees_only_its_own_evaluations(self):
        Evaluation.objects.create(player=self.mari, evaluator=self.admin, date=date.today(), attack=8)
        Evaluation.objects.create(player=self.bia, evaluator=self.admin, date=date.today(), attack=9)
        client = self.as_user(self.athlete)

        response = client.get('/api/evaluations/')
        rows = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual({row['player'] for row in rows}, {self.mari.id})
        self.assertEqual(client.get(f'/api/evaluations/radar/{self.bia.id}/').data['skills'], {})
        self.assertEqual(client.get(f'/api/evaluations/radar/{self.mari.id}/').data['skills']['Ataque'], 8)

    def test_staff_dashboard_is_staff_only(self):
        self.assertEqual(self.as_user(self.athlete).get('/api/dashboard/').status_code, 403)


class TeamTests(RolesTestCase):
    """Tela Equipe: só o admin promove e rebaixa, e ninguém tira o próprio acesso de admin."""

    def test_only_admin_sees_the_team(self):
        self.assertEqual(self.as_user(self.moderator).get('/api/auth/users/team/').status_code, 403)

        data = self.as_user(self.admin).get('/api/auth/users/team/').data
        self.assertEqual({u['email'] for u in data['staff']}, {'admin@x.com', 'mod@x.com'})
        self.assertEqual([(u['email'], u['player_id']) for u in data['athletes']], [('mari@x.com', self.mari.id)])

    def test_admin_promotes_and_the_person_is_told(self):
        response = self.as_user(self.admin).patch(f'/api/auth/users/{self.athlete.id}/', {'profile': 'moderator'}, format='json')

        self.assertEqual(response.status_code, 200)
        self.athlete.refresh_from_db()
        self.assertEqual(self.athlete.profile, 'moderator')
        self.assertTrue(Notification.objects.filter(user=self.athlete, title='Seu acesso mudou').exists())

    def test_moderator_cannot_promote(self):
        response = self.as_user(self.moderator).patch(f'/api/auth/users/{self.athlete.id}/', {'profile': 'admin'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_admin_cannot_remove_its_own_admin_access(self):
        client = self.as_user(self.admin)
        for data in ({'profile': 'moderator'}, {'is_active': False}):
            self.assertEqual(client.patch(f'/api/auth/users/{self.admin.id}/', data, format='json').status_code, 400)
        self.assertEqual(client.delete(f'/api/auth/users/{self.admin.id}/').status_code, 400)
        self.admin.refresh_from_db()
        self.assertEqual((self.admin.profile, self.admin.is_active), ('admin', True))

    def test_another_admin_can_be_demoted(self):
        other = User.objects.create_user('admin2@x.com', 'senha-forte-123', name='Admin 2', profile='admin')
        response = self.as_user(self.admin).patch(f'/api/auth/users/{other.id}/', {'profile': 'moderator'}, format='json')
        self.assertEqual(response.status_code, 200)


class AthleteAudienceTests(RolesTestCase):
    """Avisos coletivos de atleta chegam também à staff que joga."""

    def test_global_announcement_reaches_staff_who_plays(self):
        Player.objects.create(name='Mod', main_position='opposite', gender='M', user=self.moderator)

        GlobalAnnouncement.objects.create(title='Aviso', message='Quadra nova!')

        notified = set(Notification.objects.filter(title='Aviso').values_list('user__email', flat=True))
        self.assertEqual(notified, {'mari@x.com', 'mod@x.com'})  # o admin não joga: não recebe


class CircuitPrivacyTests(RolesTestCase):
    """Nota (overall), pagamentos e justificativas dos outros: só a staff. Cada atleta vê os próprios."""

    def setUp(self):
        super().setUp()
        from apps.attendance.models import Attendance
        self.gameday = GameDay.objects.create(date=date.today(), is_published=True)
        Attendance.objects.create(gameday=self.gameday, player=self.mari, present=True, has_paid=True)
        Attendance.objects.create(gameday=self.gameday, player=self.bia, present=True, has_paid=True,
                                  is_justified=True, justification_text='Consulta médica')
        Evaluation.objects.create(player=self.mari, evaluator=self.admin, date=date.today(), attack=8)
        Evaluation.objects.create(player=self.bia, evaluator=self.admin, date=date.today(), attack=6)

    def test_public_link_shows_position_but_no_ratings_or_payments(self):
        data = APIClient().get(f'/api/attendance/gamedays/{self.gameday.id}/checkin-info/').data
        bia = next(p for p in data['players'] if p['id'] == self.bia.id)

        self.assertEqual(bia['main_position'], 'libero')
        for field in ('latest_overall', 'has_paid', 'used_credit', 'amount_due'):
            self.assertNotIn(field, bia)
        self.assertIsNotNone(data['gameday']['average_overall'])  # a média da lista continua

    def test_athlete_sees_own_payment_and_rating_in_the_list(self):
        data = self.as_user(self.athlete).get(f'/api/attendance/gamedays/{self.gameday.id}/checkin-info/').data
        mine = next(p for p in data['players'] if p['id'] == self.mari.id)
        bia = next(p for p in data['players'] if p['id'] == self.bia.id)

        self.assertTrue(mine['has_paid'])
        self.assertGreater(mine['latest_overall'], 0)
        self.assertNotIn('has_paid', bia)

        staff = self.as_user(self.moderator).get(f'/api/attendance/gamedays/{self.gameday.id}/checkin-info/').data
        self.assertIn('latest_overall', next(p for p in staff['players'] if p['id'] == self.bia.id))

    def test_athlete_only_reads_own_attendance_rows(self):
        client = self.as_user(self.athlete)
        records = client.get('/api/attendance/records/').data
        rows = records['results'] if isinstance(records, dict) else records
        self.assertEqual({r['player'] for r in rows}, {self.mari.id})

        detail = client.get(f'/api/attendance/gamedays/{self.gameday.id}/').data
        self.assertEqual([a['player'] for a in detail['attendances']], [self.mari.id])
        self.assertNotIn('Consulta médica', str(detail))

    def test_staff_screens_with_everyones_data_are_staff_only(self):
        client = self.as_user(self.athlete)
        self.assertEqual(client.get('/api/attendance/gamedays/general-stats/').status_code, 403)
        self.assertEqual(client.get('/api/players/ranking/').status_code, 403)
        self.assertEqual(self.as_user(self.moderator).get('/api/players/ranking/').status_code, 200)

    def test_rating_of_others_is_hidden_from_athletes(self):
        client = self.as_user(self.athlete)
        self.assertIsNone(client.get(f'/api/players/{self.bia.id}/').data['latest_overall'])
        other = client.get(f'/api/players/{self.bia.id}/stats/').data
        self.assertEqual((other['overall_history'], other['overall_rank']), ([], None))

        mine = client.get(f'/api/players/{self.mari.id}/stats/').data
        self.assertTrue(mine['overall_history'])
        self.assertIsNotNone(client.get('/api/players/me/').data['latest_overall'])
