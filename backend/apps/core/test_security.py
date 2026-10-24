from contextlib import redirect_stdout
from datetime import date
from io import StringIO

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.attendance.models import GameDay
from apps.players.models import Player
from .models import User


class SecurityTestCase(TestCase):
    def setUp(self):
        cache.clear()  # as contagens de tentativas ficam no cache
        self.client = APIClient()
        self.athlete = User.objects.create_user('mari@x.com', 'senha-forte-123', name='Mari', profile='player')
        self.moderator = User.objects.create_user('mod@x.com', 'senha-forte-123', name='Mod', profile='moderator')
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')


class QuickMatchPermissionTests(SecurityTestCase):
    """A partida rápida do chaveamento já vem com resultado (mexe no Elo): só a staff cria."""

    def test_athlete_cannot_create_a_quick_match(self):
        self.client.force_authenticate(self.athlete)
        response = self.client.post('/api/matches/quick/', {'match': {'date': str(date.today())}, 'teams': [{}]}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_staff_gets_through(self):
        self.client.force_authenticate(self.moderator)
        response = self.client.post('/api/matches/quick/', {}, format='json')
        self.assertEqual(response.status_code, 400)  # passou da permissão; faltou o corpo


class RateLimitTests(SecurityTestCase):
    """Limite de tentativas por alvo (e-mail, atleta), com mensagem clara."""

    def login(self, email, password='errada-123'):
        return self.client.post('/api/auth/login/', {'email': email, 'password': password}, format='json')

    def test_login_is_limited_per_email(self):
        for _ in range(10):
            self.assertEqual(self.login('mari@x.com').status_code, 401)

        blocked = self.login('mari@x.com', 'senha-forte-123')
        self.assertEqual(blocked.status_code, 429)
        self.assertIn('Muitas tentativas', blocked.data['detail'])
        # outra conta não é afetada
        self.assertEqual(self.login('mod@x.com', 'senha-forte-123').status_code, 200)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_forgot_password_is_limited_per_email(self):
        with redirect_stdout(StringIO()):  # a view registra o envio no log
            for _ in range(3):
                self.assertEqual(self.client.post('/api/auth/forgot-password/', {'email': 'mari@x.com'}, format='json').status_code, 200)
            self.assertEqual(self.client.post('/api/auth/forgot-password/', {'email': 'mari@x.com'}, format='json').status_code, 429)

    def test_change_password_is_limited_per_account(self):
        self.client.force_authenticate(self.athlete)
        body = {'old_password': 'errada', 'new_password': 'nova-senha-123', 'new_password_confirm': 'nova-senha-123'}
        for _ in range(10):
            self.assertEqual(self.client.post('/api/auth/change-password/', body, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/auth/change-password/', body, format='json').status_code, 429)

    def test_public_checkin_is_limited_per_athlete(self):
        gameday = GameDay.objects.create(date=date.today(), is_published=True)
        target = Player.objects.create(name='Bia', main_position='libero', gender='F')
        other = Player.objects.create(name='Duda', main_position='setter', gender='F')
        url = f'/api/attendance/gamedays/{gameday.id}/cancel-checkin/'

        for _ in range(20):
            self.assertNotEqual(self.client.post(url, {'player_id': target.id}, format='json').status_code, 429)
        self.assertEqual(self.client.post(url, {'player_id': target.id}, format='json').status_code, 429)
        self.assertNotEqual(self.client.post(url, {'player_id': other.id}, format='json').status_code, 429)


class ApiDocsTests(SecurityTestCase):
    """O mapa da API não fica aberto na internet em produção."""

    @override_settings(DEBUG=False, SECURE_SSL_REDIRECT=False)
    def test_production_hides_the_api_map_except_for_admin(self):
        self.assertIn(self.client.get('/api/schema/').status_code, (401, 403))
        self.client.force_authenticate(self.athlete)
        self.assertEqual(self.client.get('/api/schema/').status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get('/api/schema/').status_code, 200)

    @override_settings(DEBUG=True)
    def test_development_keeps_it_open(self):
        self.assertEqual(self.client.get('/api/schema/').status_code, 200)


class SessionTests(SecurityTestCase):
    """Trocar ou redefinir a senha encerra as sessões dos outros aparelhos; este aparelho continua dentro."""

    def login_tokens(self, email='mari@x.com', password='senha-forte-123'):
        return self.client.post('/api/auth/login/', {'email': email, 'password': password}, format='json').data

    def refresh(self, token):
        return APIClient().post('/api/auth/refresh/', {'refresh': token}, format='json')

    def test_change_password_ends_other_sessions_and_keeps_this_device(self):
        other_device = self.login_tokens()['refresh']
        self.client.force_authenticate(self.athlete)

        response = self.client.post('/api/auth/change-password/', {
            'old_password': 'senha-forte-123', 'new_password': 'nova-senha-456', 'new_password_confirm': 'nova-senha-456',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.refresh(other_device).status_code, 401)
        self.assertEqual(self.refresh(response.data['refresh']).status_code, 200)

    def test_staff_password_reset_and_deactivation_end_sessions(self):
        player = Player.objects.create(name='Mari', main_position='setter', gender='F', user=self.athlete)
        token = self.login_tokens()['refresh']
        self.client.force_authenticate(self.moderator)
        self.client.post(f'/api/players/{player.id}/reset-password/', {'password': 'trocada-pela-staff'}, format='json')
        self.assertEqual(self.refresh(token).status_code, 401)

        token = self.login_tokens(password='trocada-pela-staff')['refresh']
        self.client.force_authenticate(self.admin)
        self.client.patch(f'/api/auth/users/{self.athlete.id}/', {'is_active': False}, format='json')
        self.assertEqual(self.refresh(token).status_code, 401)


class PhotoUploadTests(SecurityTestCase):
    """A foto precisa ser imagem de verdade: o tipo que o celular informa não basta (SVG pode carregar código)."""

    def test_svg_disguised_as_image_is_refused(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        Player.objects.create(name='Mari', main_position='setter', gender='F', user=self.athlete)
        self.client.force_authenticate(self.athlete)
        svg = SimpleUploadedFile('eu.svg', b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', content_type='image/svg+xml')

        response = self.client.patch('/api/players/me/', {'avatar': svg}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertIn('avatar', response.data)


class NotificationListTests(SecurityTestCase):
    """O sininho busca só as 50 mais recentes; avisos lidos antigos são apagados; ninguém cria aviso pela API."""

    def test_list_is_capped_and_old_read_ones_are_cleaned(self):
        from datetime import timedelta
        from django.utils import timezone
        from apps.notifications.models import Notification
        Notification.objects.bulk_create([Notification(user=self.athlete, title=f'Aviso {i}', message='.') for i in range(60)])
        old = Notification.objects.create(user=self.athlete, title='Velho', message='.', is_read=True)
        Notification.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=120))
        self.client.force_authenticate(self.athlete)

        self.assertEqual(len(self.client.get('/api/notifications/').data), 50)
        self.client.post('/api/notifications/read_all/')
        self.assertFalse(Notification.objects.filter(pk=old.pk).exists())
        self.assertEqual(self.client.post('/api/notifications/', {'title': 'x', 'message': 'y'}, format='json').status_code, 405)


class ListPerformanceTests(SecurityTestCase):
    """Jogos: o número de consultas não cresce com a quantidade de partidas; a sequência de vitórias segue certa."""

    def make_match(self, player, won, days_ago):
        from datetime import timedelta
        from apps.matches.models import Match, MatchPlayer, MatchTeam
        gameday = GameDay.objects.create(date=date.today() - timedelta(days=days_ago))
        match = Match.objects.create(date=gameday.date, modality=2, gameday=gameday)
        team = MatchTeam.objects.create(match=match, team_name='A', winner=won)
        MatchPlayer.objects.create(match=match, match_team=team, player=player)

    def count_queries(self, url):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        with CaptureQueriesContext(connection) as ctx:
            self.assertEqual(self.client.get(url).status_code, 200)
        return len(ctx.captured_queries)

    def test_matches_list_does_not_query_once_per_match(self):
        player = Player.objects.create(name='Bia', main_position='libero', gender='F')
        self.client.force_authenticate(self.moderator)
        self.make_match(player, True, 1)
        few = self.count_queries('/api/matches/')
        for days in range(2, 8):
            self.make_match(player, True, days)
        self.assertEqual(self.count_queries('/api/matches/'), few)

    def test_win_streak_in_the_list_still_counts_the_latest_results(self):
        player = Player.objects.create(name='Bia', main_position='libero', gender='F')
        for days_ago, won in [(1, True), (2, True), (3, False), (4, True)]:
            self.make_match(player, won, days_ago)
        self.client.force_authenticate(self.moderator)

        row = next(p for p in self.client.get('/api/players/', {'page_size': 50}).data['results'] if p['id'] == player.id)
        self.assertEqual((row['stats']['win_streak'], row['stats']['matches']), (2, 4))


class StaffPasswordRuleTests(SecurityTestCase):
    """Criar acesso e redefinir senha pela staff seguem a regra do app: pelo menos 8 caracteres."""

    def test_staff_password_needs_eight_characters(self):
        player = Player.objects.create(name='Bia', main_position='libero', gender='F')
        self.client.force_authenticate(self.moderator)
        url = f'/api/players/{player.id}/create-access/'
        self.assertEqual(self.client.post(url, {'email': 'bia@x.com', 'password': '1234567'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(url, {'email': 'bia@x.com', 'password': '12345678'}, format='json').status_code, 201)
        reset = f'/api/players/{player.id}/reset-password/'
        self.assertEqual(self.client.post(reset, {'password': 'curta12'}, format='json').status_code, 400)


class SeasonPerRequestTests(SecurityTestCase):
    """A temporada atual é resolvida uma vez por pedido, não a cada tela que a usa."""

    def test_dashboard_stats_resolves_the_season_once(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        self.client.force_authenticate(self.moderator)
        self.client.get('/api/players/dashboard-stats/')  # primeira vez cria as temporadas que faltarem
        with CaptureQueriesContext(connection) as ctx:
            self.assertEqual(self.client.get('/api/players/dashboard-stats/').status_code, 200)
        season_queries = [q for q in ctx.captured_queries if 'players_season' in q['sql']]
        self.assertLessEqual(len(season_queries), 4)

    def test_outside_a_request_nothing_is_cached(self):
        from apps.players.seasons import ensure_current_season, season_request_cache
        self.assertIsNone(season_request_cache.get())
        self.assertEqual(ensure_current_season().pk, ensure_current_season().pk)
