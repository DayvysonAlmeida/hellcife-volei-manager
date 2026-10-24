from unittest import mock

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.core.models import User
from apps.players.models import Player
from .models import PushSubscription
from .push import device_label, key_status
from .tests import APPLE, BASE, FCM, PUSH_OFF, PUSH_ON, push_response, subscribe

ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36'
IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'


class KeyStatusTests(TestCase):
    """O diagnóstico acusa na hora quando as chaves VAPID do servidor faltam ou não formam par."""

    @PUSH_ON
    def test_ok_when_the_private_key_matches_the_public_one(self):
        self.assertEqual(key_status(), 'ok')

    @PUSH_OFF
    def test_missing_when_a_variable_is_empty(self):
        self.assertEqual(key_status(), 'missing')

    @PUSH_ON
    def test_invalid_when_the_keys_do_not_match_or_do_not_open(self):
        with override_settings(VAPID_PUBLIC_KEY='BOutraChavePublicaQueNaoBate'):
            self.assertEqual(key_status(), 'invalid')
        with override_settings(VAPID_PRIVATE_KEY='isso-nao-e-uma-chave'):
            self.assertEqual(key_status(), 'invalid')

    def test_device_label(self):
        self.assertEqual(device_label(ANDROID_CHROME), 'Android · Chrome')
        self.assertEqual(device_label(IPHONE), 'iPhone · Safari')
        self.assertEqual(device_label(''), 'Aparelho · navegador')


@PUSH_ON
class PushDiagnosticsApiTests(TestCase):
    def setUp(self):
        cache.clear()  # zera o limite de testes por hora
        self.athlete = User.objects.create_user('mari@x.com', 'senha-forte-123', name='Mari', profile='player')
        self.client = APIClient()
        self.client.force_authenticate(self.athlete)

    def test_subscribe_records_which_device_it_is(self):
        from .tests import device_keys
        self.client.post(f'{BASE}/push/subscribe/', {'endpoint': FCM, 'keys': device_keys()}, format='json', HTTP_USER_AGENT=ANDROID_CHROME)

        status = self.client.get(f'{BASE}/push/status/').data
        self.assertEqual(status['server'], 'ok')
        self.assertEqual([d['device'] for d in status['devices']], ['Android · Chrome'])

    @mock.patch('apps.notifications.views.time.sleep')
    @mock.patch('requests.Session.post', autospec=True)
    def test_test_push_reports_each_device_and_remembers_the_result(self, post, sleep):
        delivered = subscribe(self.athlete, FCM)
        refused = subscribe(self.athlete, APPLE)
        expired = subscribe(self.athlete, 'https://fcm.googleapis.com/fcm/send/velho')
        codes = {FCM: 201, APPLE: 403, 'https://fcm.googleapis.com/fcm/send/velho': 410}
        post.side_effect = lambda session, url, **kwargs: push_response(codes[url])

        response = self.client.post(f'{BASE}/push/test/', {'delay': 60}, format='json')

        self.assertEqual(response.status_code, 200)
        sleep.assert_called_once_with(15)  # espera no máximo 15s
        statuses = sorted(r['status'] for r in response.data['results'])
        self.assertEqual(statuses, ['delivered', 'expired', 'failed'])
        self.assertIn('403', next(r['detail'] for r in response.data['results'] if r['status'] == 'failed'))
        delivered.refresh_from_db()
        refused.refresh_from_db()
        self.assertIsNotNone(delivered.last_success_at)
        self.assertIn('VAPID', refused.last_error)
        self.assertFalse(PushSubscription.objects.filter(pk=expired.pk).exists())
        # o teste não aparece na lista de notificações
        self.assertEqual(self.client.get(f'{BASE}/').data, [])

    def test_test_push_needs_a_device_and_working_keys(self):
        self.assertEqual(self.client.post(f'{BASE}/push/test/', {}, format='json').status_code, 400)
        subscribe(self.athlete, FCM)
        with PUSH_OFF:
            self.assertEqual(self.client.post(f'{BASE}/push/test/', {}, format='json').status_code, 503)

    def test_stats_are_staff_only_and_count_athletes_with_push(self):
        self.assertEqual(self.client.get(f'{BASE}/push/stats/').status_code, 403)
        Player.objects.create(name='Mari', main_position='setter', gender='F', user=self.athlete)
        User.objects.create_user('bia@x.com', 'senha-forte-123', name='Bia', profile='player')
        subscribe(self.athlete, FCM)
        staff = User.objects.create_user('mod@x.com', 'senha-forte-123', name='Mod', profile='moderator')
        self.client.force_authenticate(staff)

        data = self.client.get(f'{BASE}/push/stats/').data
        self.assertEqual((data['athletes'], data['with_push'], data['without']), (2, 1, ['Bia']))
