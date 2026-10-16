from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.players.models import Player
from .models import Plan, SubscriptionCycle, UserSubscription

WEBHOOK_URL = '/api/subscriptions/webhook/asaas/'
TOKEN = 'test-token'


@override_settings(ASAAS_WEBHOOK_TOKEN=TOKEN)
class AsaasWebhookSubscriptionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.plan = Plan.objects.create(name='Mensal', price='100.00', credits=4)
        player = Player.objects.create(name='Atleta', main_position='setter')
        self.sub = UserSubscription.objects.create(
            player=player, plan=self.plan, status='PENDING_PAYMENT',
            next_billing_date=timezone.now().date() + timedelta(days=1),
            asaas_subscription_id='sub_1',
        )

    def post(self, payment_id, token=TOKEN):
        return self.client.post(
            WEBHOOK_URL,
            {'event': 'PAYMENT_RECEIVED', 'payment': {'id': payment_id, 'subscription': 'sub_1'}},
            format='json', HTTP_ASAAS_ACCESS_TOKEN=token,
        )

    def test_first_payment_creates_single_cycle(self):
        self.assertEqual(self.post('pay_1').status_code, 200)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.status, 'active')
        self.assertEqual(self.sub.cycles.count(), 1)
        self.assertEqual(self.sub.cycles.get().asaas_payment_id, 'pay_1')

    def test_retried_webhook_is_idempotent(self):
        self.post('pay_1')
        self.post('pay_1')
        self.assertEqual(self.sub.cycles.count(), 1)

    def test_renewal_payment_creates_next_cycle(self):
        self.post('pay_1')
        self.post('pay_2')
        cycles = list(self.sub.cycles.order_by('start_date'))
        self.assertEqual(len(cycles), 2)
        self.assertEqual(cycles[1].asaas_payment_id, 'pay_2')
        self.assertGreater(cycles[1].start_date, cycles[0].end_date - timedelta(days=1))

    def test_invalid_token_is_rejected(self):
        self.assertEqual(self.post('pay_1', token='errado').status_code, 401)
        self.assertFalse(SubscriptionCycle.objects.exists())
