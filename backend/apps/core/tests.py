from contextlib import redirect_stdout
from io import StringIO
from unittest import mock

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import User


class ForgotPasswordLogTests(TestCase):
    """Se o e-mail falhar, o link de troca de senha nunca vai para o log de produção."""

    def setUp(self):
        self.user = User.objects.create_user('atleta@x.com', 'senha-forte-123', name='Atleta')

    def request_reset_with_smtp_down(self):
        out = StringIO()
        with mock.patch('apps.core.views.send_mail', side_effect=OSError('SMTP fora do ar')), redirect_stdout(out):
            response = APIClient().post('/api/auth/forgot-password/', {'email': self.user.email}, format='json')
        self.assertEqual(response.status_code, 200)
        return out.getvalue()

    @override_settings(DEBUG=False)
    def test_production_log_never_has_the_reset_link(self):
        output = self.request_reset_with_smtp_down()

        self.assertIn('ERRO AO ENVIAR', output)
        self.assertNotIn('reset-password?uid=', output)

    @override_settings(DEBUG=True)
    def test_development_terminal_shows_the_link(self):
        self.assertIn('reset-password?uid=', self.request_reset_with_smtp_down())


class MeEndpointTests(TestCase):
    """/auth/me/ só mostra o usuário: ninguém muda o próprio tipo de acesso por ali."""

    def setUp(self):
        self.user = User.objects.create_user('atleta@x.com', 'senha-forte-123', name='Atleta', profile='player')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_shows_the_logged_user(self):
        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['email'], 'atleta@x.com')

    def test_athlete_cannot_make_itself_admin(self):
        for method in (self.client.patch, self.client.put):
            response = method('/api/auth/me/', {'profile': 'admin', 'is_active': True}, format='json')
            self.assertEqual(response.status_code, 405)

        self.user.refresh_from_db()
        self.assertEqual(self.user.profile, 'player')
