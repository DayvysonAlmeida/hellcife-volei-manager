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
