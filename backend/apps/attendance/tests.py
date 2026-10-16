from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import User
from apps.players.models import Player
from .models import Attendance, AttendancePayment, GameDay

BASE = '/api/attendance/gamedays'


def make_player(name, **kwargs):
    return Player.objects.create(name=name, main_position='setter', **kwargs)


class PricingTests(TestCase):
    def test_split_suggests_court_price_divided_by_spots_rounded_up(self):
        gd = GameDay(date=date.today(), court_price=Decimal('100'), max_players=12)
        self.assertEqual(gd.suggested_price_per_person, Decimal('8.34'))
        self.assertEqual(gd.effective_price_per_person, Decimal('8.34'))

    def test_admin_price_overrides_suggestion(self):
        gd = GameDay(date=date.today(), court_price=Decimal('100'), max_players=12, price_per_person=Decimal('10'))
        self.assertEqual(gd.effective_price_per_person, Decimal('10'))

    def test_fixed_event_without_price_is_free(self):
        gd = GameDay(date=date.today(), pricing_type=GameDay.PRICING_FIXED)
        self.assertEqual(gd.effective_price_per_person, Decimal('0'))


class CircuitApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.athlete_user = User.objects.create_user('atleta@x.com', 'senha-forte-123', name='Atleta')
        self.p1 = make_player('Ana', user=self.athlete_user)
        self.p2 = make_player('Bia')
        self.p3 = make_player('Caio')

    def make_gameday(self, **kwargs):
        defaults = dict(date=date.today() + timedelta(days=1), max_players=2, is_published=True)
        defaults.update(kwargs)
        gd = GameDay.objects.create(**defaults)
        for p in (self.p1, self.p2, self.p3):
            Attendance.objects.create(gameday=gd, player=p)
        return gd

    def att(self, gd, player):
        return Attendance.objects.get(gameday=gd, player=player)

    def checkin(self, gd, player):
        return self.client.post(f'{BASE}/{gd.id}/public-checkin/', {'player_id': player.id}, format='json')


class CheckinTests(CircuitApiTestCase):
    def test_free_checkin_is_not_marked_as_paid(self):
        """Antes, todo check-in do atleta saía como 'Pagou' mesmo sem pagamento."""
        gd = self.make_gameday(court_price=Decimal('100'))
        response = self.checkin(gd, self.p1)
        self.assertEqual(response.status_code, 200)
        att = self.att(gd, self.p1)
        self.assertTrue(att.present)
        self.assertFalse(att.has_paid)
        self.assertFalse(att.used_credit)

    def test_credits_are_still_used_when_circuit_charges_credits(self):
        self.p1.standalone_credits = Decimal('2')
        self.p1.save()
        gd = self.make_gameday(credit_cost=Decimal('1'))
        self.checkin(gd, self.p1)
        att = self.att(gd, self.p1)
        self.p1.refresh_from_db()
        self.assertTrue(att.present and att.has_paid and att.used_credit)
        self.assertEqual(self.p1.standalone_credits, Decimal('1'))

    def test_prepayment_reserves_spot_with_amount_and_deadline(self):
        gd = self.make_gameday(court_price=Decimal('100'), requires_prepayment=True, reservation_hold_minutes=60)
        response = self.checkin(gd, self.p1)
        self.assertTrue(response.data['is_reserved'])
        att = self.att(gd, self.p1)
        self.assertFalse(att.present)
        self.assertTrue(att.is_reserved)
        self.assertEqual(att.amount_due, Decimal('50.00'))
        self.assertAlmostEqual(att.reserved_until, timezone.now() + timedelta(minutes=60), delta=timedelta(seconds=5))

    def test_reservations_count_towards_capacity(self):
        gd = self.make_gameday(court_price=Decimal('100'), requires_prepayment=True)
        self.checkin(gd, self.p1)
        self.checkin(gd, self.p2)
        response = self.checkin(gd, self.p3)
        self.assertTrue(response.data['is_waitlist'])

    def test_cancel_releases_reservation(self):
        gd = self.make_gameday(court_price=Decimal('100'), requires_prepayment=True)
        self.checkin(gd, self.p1)
        self.client.force_authenticate(self.athlete_user)
        self.client.post(f'{BASE}/{gd.id}/cancel-checkin/', {'player_id': self.p1.id}, format='json')
        att = self.att(gd, self.p1)
        self.assertFalse(att.is_reserved)
        self.assertIsNone(att.amount_due)


class ReservationExpiryTests(CircuitApiTestCase):
    def setUp(self):
        super().setUp()
        self.gd = self.make_gameday(court_price=Decimal('100'), requires_prepayment=True, reservation_hold_minutes=30)
        self.checkin(self.gd, self.p1)
        self.checkin(self.gd, self.p2)
        self.checkin(self.gd, self.p3)  # vai para a fila

    def expire(self, player):
        Attendance.objects.filter(gameday=self.gd, player=player).update(reserved_until=timezone.now() - timedelta(minutes=1))

    def test_expired_reservation_goes_to_next_in_waitlist(self):
        self.expire(self.p1)
        self.client.get(f'{BASE}/{self.gd.id}/checkin-info/')
        self.assertFalse(self.att(self.gd, self.p1).is_reserved)
        p3 = self.att(self.gd, self.p3)
        self.assertTrue(p3.is_reserved)
        self.assertFalse(p3.is_waitlist)

    def test_claimed_payment_keeps_the_spot(self):
        self.client.force_authenticate(self.athlete_user)
        self.client.post(f'{BASE}/{self.gd.id}/claim-payment/', {'player_id': self.p1.id}, format='json')
        self.expire(self.p1)
        self.client.get(f'{BASE}/{self.gd.id}/checkin-info/')
        self.assertTrue(self.att(self.gd, self.p1).is_reserved)
        self.assertTrue(self.att(self.gd, self.p3).is_waitlist)


class AdminPaymentTests(CircuitApiTestCase):
    def setUp(self):
        super().setUp()
        self.gd = self.make_gameday(court_price=Decimal('100'), requires_prepayment=True)
        self.checkin(self.gd, self.p1)
        self.client.force_authenticate(self.admin)

    def confirm(self, player, **data):
        return self.client.post(f'{BASE}/{self.gd.id}/confirm-payment/', {'player_id': player.id, **data}, format='json')

    def test_confirm_turns_reservation_into_presence_and_records_payment(self):
        response = self.confirm(self.p1, method='cash')
        self.assertEqual(response.status_code, 200)
        att = self.att(self.gd, self.p1)
        self.assertTrue(att.present and att.has_paid)
        self.assertFalse(att.is_reserved)
        payment = att.payments.get()
        self.assertEqual((payment.amount, payment.method, payment.confirmed_by), (Decimal('50.00'), 'cash', self.admin))

    def test_exempt_records_zero(self):
        self.confirm(self.p1, method='exempt')
        self.assertEqual(self.att(self.gd, self.p1).payments.get().amount, Decimal('0'))

    def test_invalid_method_rejected(self):
        self.assertEqual(self.confirm(self.p1, method='pix_asaas').status_code, 400)

    def test_athlete_cannot_mark_payment(self):
        self.client.force_authenticate(self.athlete_user)
        response = self.client.patch(f'{BASE}/{self.gd.id}/toggle-payment/{self.p1.id}/')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.confirm(self.p1).status_code, 403)

    def test_toggle_payment_records_and_reverts(self):
        url = f'{BASE}/{self.gd.id}/toggle-payment/{self.p1.id}/'
        self.client.patch(url)
        att = self.att(self.gd, self.p1)
        self.assertTrue(att.has_paid)
        self.assertEqual(att.payments.get().status, AttendancePayment.STATUS_PAID)
        self.client.patch(url)
        att.refresh_from_db()
        self.assertFalse(att.has_paid)
        self.assertEqual(att.payments.get().status, AttendancePayment.STATUS_CANCELED)

    def test_price_change_updates_who_has_not_paid(self):
        self.client.patch(f'{BASE}/{self.gd.id}/', {'price_per_person': '35.00'}, format='json')
        self.assertEqual(self.att(self.gd, self.p1).amount_due, Decimal('35.00'))

    def test_fixed_event_requires_price(self):
        response = self.client.post(f'{BASE}/', {'date': str(date.today()), 'pricing_type': 'fixed'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('price_per_person', response.data)

    def test_prepayment_requires_a_price_to_charge(self):
        response = self.client.post(
            f'{BASE}/', {'date': str(date.today()), 'requires_prepayment': True, 'court_price': '100'}, format='json'
        )
        self.assertEqual(response.status_code, 400)

    def test_finance_summary(self):
        self.checkin(self.gd, self.p2)
        self.confirm(self.p1, method='pix_manual')
        data = self.client.get(f'{BASE}/{self.gd.id}/finance/').data
        self.assertEqual(data['collected'], Decimal('50.00'))
        self.assertEqual(data['outstanding'], Decimal('50.00'))
        self.assertEqual(data['expected'], Decimal('100.00'))
        self.assertEqual((data['confirmed'], data['reserved'], data['paid'], data['pending']), (1, 1, 1, 1))
        self.assertEqual(data['balance'], Decimal('-50.00'))


class FinanceReportTests(CircuitApiTestCase):
    def setUp(self):
        super().setUp()
        today = timezone.localdate()
        self.gd = self.make_gameday(date=today, court_price=Decimal('100'), requires_prepayment=True)
        for p in (self.p1, self.p2):
            self.checkin(self.gd, p)
        self.client.force_authenticate(self.admin)
        self.client.post(f'{BASE}/{self.gd.id}/confirm-payment/', {'player_id': self.p1.id, 'method': 'pix_manual'}, format='json')
        self.client.post(f'{BASE}/{self.gd.id}/claim-payment/', {'player_id': self.p2.id}, format='json')

    def test_overview_uses_real_payments_and_court_cost(self):
        data = self.client.get('/api/attendance/finance/overview/').data
        self.assertEqual(data['circuits_received'], Decimal('50.00'))
        self.assertEqual(data['court_costs'], Decimal('100.00'))
        self.assertEqual(data['balance'], Decimal('-50.00'))
        self.assertEqual(data['outstanding'], Decimal('50.00'))
        self.assertEqual(data['pending_claims'], 1)
        self.assertEqual(len(data['series']), 12)
        self.assertEqual(data['series'][-1]['received'], Decimal('50.00'))
        self.assertEqual(data['by_location'][0]['collected'], Decimal('50.00'))

    def test_claims_and_debtors(self):
        claims = self.client.get('/api/attendance/finance/claims/').data
        self.assertEqual([c['player_id'] for c in claims], [self.p2.id])
        debtors = self.client.get('/api/attendance/finance/debtors/').data
        self.assertEqual([(d['player_id'], d['amount_due']) for d in debtors], [(self.p2.id, Decimal('50.00'))])

    def test_invalid_month(self):
        self.assertEqual(self.client.get('/api/attendance/finance/overview/?month=xx').status_code, 400)

    def test_athlete_has_no_access(self):
        self.client.force_authenticate(self.athlete_user)
        self.assertEqual(self.client.get('/api/attendance/finance/overview/').status_code, 403)


class OwnershipTests(CircuitApiTestCase):
    """Cancelar vaga, avisar pagamento e usar cota grátis exigem login do próprio atleta."""

    def setUp(self):
        super().setUp()
        self.other_user = User.objects.create_user('outra@x.com', 'senha-forte-123', name='Outra')
        self.p2.user = self.other_user
        self.p2.save()
        self.gd = self.make_gameday(court_price=Decimal('100'), requires_prepayment=True)
        self.checkin(self.gd, self.p1)  # reservar continua aberto pelo link público

    def post(self, action, **data):
        return self.client.post(f'{BASE}/{self.gd.id}/{action}/', {'player_id': self.p1.id, **data}, format='json')

    def test_reserving_is_still_public(self):
        self.assertTrue(self.att(self.gd, self.p1).is_reserved)

    def test_anonymous_cannot_cancel_or_claim(self):
        self.assertEqual(self.post('cancel-checkin').status_code, 401)
        self.assertEqual(self.post('claim-payment').status_code, 401)
        self.assertTrue(self.att(self.gd, self.p1).is_reserved)

    def test_other_athlete_cannot_touch_my_spot(self):
        self.client.force_authenticate(self.other_user)
        self.assertEqual(self.post('cancel-checkin').status_code, 403)
        self.assertEqual(self.post('claim-payment').status_code, 403)

    def test_owner_and_admin_can(self):
        self.client.force_authenticate(self.athlete_user)
        self.assertEqual(self.post('claim-payment').status_code, 200)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.post('cancel-checkin').status_code, 200)

    def test_claim_requires_a_spot_and_unpaid(self):
        self.client.force_authenticate(self.other_user)
        response = self.client.post(f'{BASE}/{self.gd.id}/claim-payment/', {'player_id': self.p2.id}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_free_guest_quota_requires_owner(self):
        response = self.post('public-add-guest', name='Visitante', use_free_guest=True)
        self.assertEqual(response.status_code, 401)



class ListReservedCountTests(CircuitApiTestCase):
    def test_list_counts_valid_reservations(self):
        gd = self.make_gameday(court_price=Decimal('100'), requires_prepayment=True, reservation_hold_minutes=30)
        self.checkin(gd, self.p1)
        self.checkin(gd, self.p2)
        Attendance.objects.filter(gameday=gd, player=self.p2).update(reserved_until=timezone.now() - timedelta(minutes=1))
        self.client.force_authenticate(self.admin)
        row = next(r for r in self.client.get(f'{BASE}/').data['results'] if r['id'] == gd.id)
        self.assertEqual(row['total_reserved'], 1)
