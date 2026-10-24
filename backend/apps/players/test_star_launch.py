from datetime import date, timedelta

from django.test import TestCase
from rest_framework.test import APIClient

from apps.attendance.models import Attendance, GameDay
from apps.core.models import User
from apps.notifications.models import Notification
from .models import Player, StarHistory

LAUNCH = '/api/players/stars/launch/'


class StarLaunchTests(TestCase):
    """Estrelas lançadas por circuito: ficam ligadas ao dia, revisadas em lote e com "Desfazer"."""

    def setUp(self):
        self.mod = User.objects.create_user('mod@x.com', 'senha-forte-123', name='Ana', profile='moderator')
        self.mari_user = User.objects.create_user('mari@x.com', 'senha-forte-123', name='Mari', profile='player')
        self.mari = Player.objects.create(name='Mari', main_position='setter', gender='F', user=self.mari_user)
        self.bia = Player.objects.create(name='Bia', main_position='libero', gender='F')
        self.gameday = GameDay.objects.create(date=date.today() - timedelta(days=1), description='Circuito de sexta', is_published=True)
        self.client = APIClient()
        self.client.force_authenticate(self.mod)

    def launch(self, items, gameday=None):
        return self.client.post(LAUNCH, {'gameday': gameday or self.gameday.id, 'items': items}, format='json')

    def test_launch_links_each_star_to_the_circuit_and_author(self):
        response = self.launch([
            {'player': self.mari.id, 'category': 'attack'},
            {'player': self.mari.id, 'category': 'attack'},
            {'player': self.bia.id, 'category': 'mvp'},
        ])

        self.assertEqual(response.status_code, 201)
        self.mari.refresh_from_db()
        self.bia.refresh_from_db()
        self.assertEqual((self.mari.attack_stars, self.mari.mini_stars), (2, 2))
        self.assertEqual((self.bia.mvp_stars, self.bia.mini_stars), (1, 6))
        entry = StarHistory.objects.get(player=self.mari)
        self.assertEqual((entry.count, entry.gameday, entry.given_by), (2, self.gameday, self.mod))
        message = Notification.objects.get(user=self.mari_user, type='prize').message
        self.assertIn(f"no circuito de {self.gameday.date.strftime('%d/%m')}", message)

    def test_circuit_is_required_and_must_have_happened(self):
        future = GameDay.objects.create(date=date.today() + timedelta(days=3))
        item = [{'player': self.mari.id, 'category': 'attack'}]

        self.assertEqual(self.client.post(LAUNCH, {'items': item}, format='json').status_code, 400)
        self.assertEqual(self.launch(item, gameday=future.id).status_code, 400)
        self.assertEqual(self.launch([{'player': self.mari.id, 'category': 'saque'}]).status_code, 400)
        self.assertEqual(self.launch([]).status_code, 400)
        self.assertFalse(StarHistory.objects.exists())

    def test_only_staff_launches(self):
        self.client.force_authenticate(self.mari_user)
        self.assertEqual(self.launch([{'player': self.mari.id, 'category': 'attack'}]).status_code, 403)
        self.assertEqual(self.client.get('/api/players/stars/launch-options/').status_code, 403)

    def test_big_star_is_forged_inside_a_launch(self):
        Player.objects.filter(pk=self.mari.pk).update(mini_stars=14, attack_stars=14)

        self.launch([{'player': self.mari.id, 'category': 'defense'}])

        self.mari.refresh_from_db()
        self.assertEqual((self.mari.big_stars, self.mari.mini_stars, self.mari.attack_stars, self.mari.defense_stars), (1, 0, 0, 0))
        self.assertEqual(StarHistory.objects.get(category='promotion').gameday, self.gameday)

    def test_undo_takes_the_star_back_once(self):
        self.launch([{'player': self.mari.id, 'category': 'attack'}])
        entry = StarHistory.objects.get()

        self.assertEqual(self.client.post(f'/api/players/stars-history/{entry.id}/undo/').status_code, 200)
        self.mari.refresh_from_db()
        self.assertEqual((self.mari.attack_stars, self.mari.mini_stars), (0, 0))
        undo = StarHistory.objects.get(action='remove')
        self.assertEqual((undo.reverts, undo.gameday, undo.given_by), (entry, self.gameday, self.mod))
        self.assertEqual(self.client.post(f'/api/players/stars-history/{entry.id}/undo/').status_code, 409)

        rows = {r['id']: r for r in self.client.get('/api/players/stars-history/').data}
        self.assertEqual(rows[entry.id]['undone_by']['name'], 'Ana')
        self.assertEqual(rows[entry.id]['gameday']['description'], 'Circuito de sexta')
        self.assertEqual(rows[undo.id]['reverts_id'], entry.id)

    def test_undo_is_refused_after_the_star_became_a_big_star(self):
        Player.objects.filter(pk=self.mari.pk).update(mini_stars=14, attack_stars=14)
        self.launch([{'player': self.mari.id, 'category': 'attack'}])
        entry = StarHistory.objects.get(category='attack')

        response = self.client.post(f'/api/players/stars-history/{entry.id}/undo/')
        self.assertEqual(response.status_code, 409)
        self.assertIn('Estrela Grande', response.data['detail'])

    def test_launch_options_list_past_circuits_with_who_was_present(self):
        Attendance.objects.create(gameday=self.gameday, player=self.mari, present=True)
        Attendance.objects.create(gameday=self.gameday, player=self.bia, present=False)
        GameDay.objects.create(date=date.today() + timedelta(days=2))  # ainda não aconteceu

        options = self.client.get('/api/players/stars/launch-options/').data
        self.assertEqual([o['id'] for o in options], [self.gameday.id])
        self.assertEqual(options[0]['present_ids'], [self.mari.id])
