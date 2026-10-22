import base64
import json
import os
from io import StringIO
from unittest import mock

import requests
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase, override_settings
from py_vapid import Vapid
from rest_framework.test import APIClient

from apps.core.models import User
from .models import Notification, PushSubscription
from .push import MAX_BODY, MAX_SUBSCRIPTIONS_PER_USER, is_allowed_endpoint
from .services import notify

BASE = '/api/notifications'
FCM = 'https://fcm.googleapis.com/fcm/send/abc:APA91b-token'
APPLE = 'https://web.push.apple.com/QGx-token'


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def b64url_decode(value):
    return base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))


def public_raw(key):
    return key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)


def device_keys():
    """Chaves como as que o navegador manda em PushSubscription.toJSON()."""
    return {'p256dh': b64url(public_raw(ec.generate_private_key(ec.SECP256R1()))), 'auth': b64url(os.urandom(16))}


_vapid_key = ec.generate_private_key(ec.SECP256R1())
PUSH_ON = override_settings(
    VAPID_PUBLIC_KEY=b64url(public_raw(_vapid_key)),
    VAPID_PRIVATE_KEY=b64url(_vapid_key.private_numbers().private_value.to_bytes(32, 'big')),
    VAPID_CLAIM_EMAIL='contato@hellcife.test',
)
PUSH_OFF = override_settings(VAPID_PUBLIC_KEY='', VAPID_PRIVATE_KEY='', VAPID_CLAIM_EMAIL='')


def push_response(status_code=201):
    response = requests.Response()
    response.status_code = status_code
    response._content = b''
    return response


def subscribe(user, endpoint):
    keys = device_keys()
    return PushSubscription.objects.create(user=user, endpoint=endpoint, **keys)


class EndpointValidationTests(SimpleTestCase):
    def test_accepts_the_browser_push_services(self):
        for endpoint in [
            FCM,
            APPLE,
            'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
            'https://wns2-par02p.notify.windows.com/w/?token=BQYAAA',
        ]:
            self.assertTrue(is_allowed_endpoint(endpoint), endpoint)

    def test_refuses_anything_else(self):
        for endpoint in [
            'http://fcm.googleapis.com/fcm/send/x',          # sem https
            'https://169.254.169.254/latest/meta-data/',     # metadados do servidor
            'https://localhost/x',
            'https://fcm.googleapis.com.evil.com/x',         # domínio parecido
            'https://evilfcm.googleapis.com/x',
            'https://user:senha@fcm.googleapis.com/x',
            'https://fcm.googleapis.com:8443/x',
            'nada a ver',
        ]:
            self.assertFalse(is_allowed_endpoint(endpoint), endpoint)


class PushApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.athlete = User.objects.create_user('atleta@x.com', 'senha-forte-123', name='Atleta')
        self.other = User.objects.create_user('outro@x.com', 'senha-forte-123', name='Outro')
        self.client.force_authenticate(self.athlete)

    def post_subscription(self, endpoint=FCM, keys=None):
        return self.client.post(f'{BASE}/push/subscribe/', {'endpoint': endpoint, 'keys': keys or device_keys()}, format='json')

    @PUSH_OFF
    def test_key_is_null_and_subscribe_refused_when_push_is_off(self):
        self.assertIsNone(self.client.get(f'{BASE}/push/key/').data['public_key'])
        self.assertEqual(self.post_subscription().status_code, 503)
        self.assertFalse(PushSubscription.objects.exists())

    @PUSH_ON
    def test_returns_public_key_and_saves_the_device(self):
        from django.conf import settings
        self.assertEqual(self.client.get(f'{BASE}/push/key/').data['public_key'], settings.VAPID_PUBLIC_KEY)

        response = self.post_subscription()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(PushSubscription.objects.get().user, self.athlete)

    @PUSH_ON
    def test_refuses_unknown_push_service(self):
        response = self.post_subscription(endpoint='https://169.254.169.254/latest/meta-data/')

        self.assertEqual(response.status_code, 400)
        self.assertFalse(PushSubscription.objects.exists())

    @PUSH_ON
    def test_refuses_malformed_keys(self):
        self.assertEqual(self.post_subscription(keys={'p256dh': 'curta', 'auth': b64url(os.urandom(16))}).status_code, 400)
        self.assertEqual(self.post_subscription(keys={'p256dh': device_keys()['p256dh'], 'auth': 'x'}).status_code, 400)
        self.assertFalse(PushSubscription.objects.exists())

    @PUSH_ON
    def test_same_device_moves_to_the_account_that_logged_in(self):
        self.post_subscription()
        self.client.force_authenticate(self.other)
        self.post_subscription()

        self.assertEqual(PushSubscription.objects.get().user, self.other)

    @PUSH_ON
    def test_keeps_only_the_latest_devices_including_the_new_one(self):
        for i in range(MAX_SUBSCRIPTIONS_PER_USER + 2):
            self.post_subscription(endpoint=f'{FCM}-{i}')

        self.assertEqual(self.athlete.push_subscriptions.count(), MAX_SUBSCRIPTIONS_PER_USER)
        self.assertTrue(self.athlete.push_subscriptions.filter(endpoint=f'{FCM}-{MAX_SUBSCRIPTIONS_PER_USER + 1}').exists())

    def test_unsubscribe_only_removes_own_device(self):
        subscribe(self.athlete, FCM)

        self.client.force_authenticate(self.other)
        self.client.post(f'{BASE}/push/unsubscribe/', {'endpoint': FCM}, format='json')
        self.assertTrue(PushSubscription.objects.exists())

        self.client.force_authenticate(self.athlete)
        response = self.client.post(f'{BASE}/push/unsubscribe/', {'endpoint': FCM}, format='json')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(PushSubscription.objects.exists())

    def test_requires_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(f'{BASE}/push/subscribe/', {}, format='json').status_code, 401)


@mock.patch('requests.Session.post', autospec=True, return_value=push_response())
class NotifyPushTests(TestCase):
    def setUp(self):
        self.athlete = User.objects.create_user('atleta@x.com', 'senha-forte-123', name='Atleta')
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')

    def notification(self, user, **kwargs):
        return Notification(user=user, title=kwargs.pop('title', 'Circuito Liberado! 🏐'), message=kwargs.pop('message', 'A lista abriu.'), type='circuit')

    @PUSH_ON
    def test_sends_encrypted_signed_push_to_each_device_after_commit(self, post):
        subscribe(self.athlete, FCM)
        subscribe(self.athlete, APPLE)

        with self.captureOnCommitCallbacks() as callbacks:
            created = notify([self.notification(self.athlete)])
            self.assertEqual(Notification.objects.count(), 1)
            post.assert_not_called()  # nada sai antes do commit
        for callback in callbacks:
            callback()

        self.assertEqual(post.call_count, 2)
        for call in post.call_args_list:
            endpoint, headers = call.args[1], call.kwargs['headers']
            self.assertEqual(headers['content-encoding'], 'aes128gcm')
            self.assertEqual(headers['urgency'], 'high')
            self.assertEqual(int(headers['ttl']), 24 * 60 * 60)
            # O "aud" do token VAPID é o serviço daquele aparelho (o Apple recusa o do Google)
            token = headers['authorization'].split('t=')[1].split(',')[0]
            claims = json.loads(b64url_decode(token.split('.')[1]))
            origin = 'https://' + endpoint.split('/')[2]
            self.assertEqual(claims['aud'], origin)
            self.assertEqual(claims['sub'], 'mailto:contato@hellcife.test')
            # Assinado com a chave do servidor (a mesma que o navegador usou para se inscrever)
            self.assertIn(f"k={PUSH_ON.options['VAPID_PUBLIC_KEY']}", headers['authorization'])
            self.assertTrue(Vapid.verify(headers['authorization']))
        self.assertIsNotNone(created[0].id)

    @PUSH_ON
    def test_payload_points_to_the_right_screen_and_fits(self, post):
        subscribe(self.athlete, FCM)
        subscribe(self.admin, APPLE)

        with mock.patch('apps.notifications.push.webpush', wraps=__import__('pywebpush').webpush) as webpush:
            with self.captureOnCommitCallbacks(execute=True):
                notify([
                    self.notification(self.athlete, message='x' * 1000),
                    self.notification(self.admin),
                ])

        payloads = {call.kwargs['subscription_info']['endpoint']: json.loads(call.kwargs['data']) for call in webpush.call_args_list}
        self.assertEqual(payloads[FCM]['url'], '/athlete/notifications')
        self.assertEqual(len(payloads[FCM]['body']), MAX_BODY)
        self.assertEqual(payloads[APPLE]['url'], '/notifications')
        self.assertEqual(payloads[APPLE]['title'], 'Circuito Liberado! 🏐')

    @PUSH_OFF
    def test_push_off_only_saves_the_notification(self, post):
        subscribe(self.athlete, FCM)

        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            notify([self.notification(self.athlete)])

        self.assertEqual(callbacks, [])
        self.assertEqual(Notification.objects.count(), 1)
        post.assert_not_called()

    @PUSH_ON
    def test_removes_devices_that_no_longer_exist(self, post):
        gone = subscribe(self.athlete, FCM)
        kept = subscribe(self.athlete, APPLE)
        post.side_effect = lambda session, url, **kw: push_response(410 if url == FCM else 500)

        with self.captureOnCommitCallbacks(execute=True):
            notify([self.notification(self.athlete)])

        self.assertFalse(PushSubscription.objects.filter(id=gone.id).exists())
        self.assertTrue(PushSubscription.objects.filter(id=kept.id).exists())

    @PUSH_ON
    def test_one_device_failing_does_not_stop_the_others(self, post):
        subscribe(self.athlete, FCM)
        subscribe(self.athlete, APPLE)

        def flaky(session, url, **kw):
            if url == FCM:
                raise requests.ConnectionError('sem rede')
            return push_response()
        post.side_effect = flaky

        with self.captureOnCommitCallbacks(execute=True):
            notify([self.notification(self.athlete)])

        self.assertEqual(post.call_count, 2)
        self.assertEqual(PushSubscription.objects.count(), 2)

    @PUSH_ON
    def test_global_announcement_reaches_subscribed_athletes(self, post):
        subscribe(self.athlete, FCM)
        client = APIClient()
        client.force_authenticate(self.admin)

        with self.captureOnCommitCallbacks(execute=True):
            response = client.post(f'{BASE}/global_announcement/', {'title': 'Aviso', 'message': 'Treino cancelado'}, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Notification.objects.filter(user=self.athlete).count(), 1)
        self.assertEqual(post.call_count, 1)


class GenerateVapidKeysTests(SimpleTestCase):
    def test_generated_keys_work_with_the_push_library(self):
        out = StringIO()
        call_command('generate_vapid_keys', stdout=out)
        values = dict(line.split('=', 1) for line in out.getvalue().splitlines())

        vapid = Vapid.from_string(values['VAPID_PRIVATE_KEY'])
        self.assertEqual(b64url(public_raw(vapid.private_key)), values['VAPID_PUBLIC_KEY'])
