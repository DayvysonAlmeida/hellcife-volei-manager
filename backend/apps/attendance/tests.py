from datetime import date, timedelta
from decimal import Decimal

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import User
from apps.core.testing import CacheIsolatedTestCase as TestCase  # limite de tentativas: cache limpo a cada teste
from apps.players.models import Player
from .models import Attendance, AttendancePayment, GameDay

BASE = '/api/attendance/gamedays'


_phones = iter(range(10_000_000, 99_999_999))


def make_player(name, **kwargs):
    # WhatsApp próprio: o link público confere os 5 últimos dígitos de quem não tem conta
    kwargs.setdefault('phone', f'819{next(_phones)}')
    return Player.objects.create(name=name, main_position='setter', **kwargs)


def link_data(player):
    """O que o link do grupo manda para confirmar quem não tem conta: o atleta e os 5 últimos dígitos."""
    return {'player_id': player.id, 'phone_check': player.phone[-5:]}


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
        """Check-in como o atleta faria: logado se tem conta no app, anônimo pelo link se não tem."""
        client = APIClient()
        if player.user_id:
            client.force_authenticate(player.user)
        return client.post(f'{BASE}/{gd.id}/public-checkin/', link_data(player), format='json')


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

    @override_settings(PAGAMENTOS_ONLINE=True)
    def test_credits_are_still_used_when_circuit_charges_credits(self):
        self.p1.standalone_credits = Decimal('2')
        self.p1.save()
        gd = self.make_gameday(credit_cost=Decimal('1'))
        self.checkin(gd, self.p1)
        att = self.att(gd, self.p1)
        self.p1.refresh_from_db()
        self.assertTrue(att.present and att.has_paid and att.used_credit)
        self.assertEqual(self.p1.standalone_credits, Decimal('1'))

    def test_credits_are_ignored_while_plans_are_off(self):
        """Circuito antigo com custo em créditos salvo não pode bloquear o check-in sem os planos."""
        gd = self.make_gameday(credit_cost=Decimal('1'))
        response = self.checkin(gd, self.p1)
        self.assertEqual(response.status_code, 200)
        att = self.att(gd, self.p1)
        self.assertTrue(att.present)
        self.assertFalse(att.used_credit)
        info = self.client.get(f'{BASE}/{gd.id}/checkin-info/').data['gameday']
        self.assertEqual(info['credit_cost'], 0)

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

    def test_turning_off_prepayment_confirms_reserved_spots(self):
        self.client.patch(f'{BASE}/{self.gd.id}/', {'requires_prepayment': False}, format='json')
        att = self.att(self.gd, self.p1)
        self.assertTrue(att.present)
        self.assertFalse(att.is_reserved)
        self.assertEqual(att.amount_due, Decimal('50.00'))  # o rateio continua devido, só não trava mais a vaga

    def test_zero_price_confirms_reserved_spots(self):
        self.client.patch(f'{BASE}/{self.gd.id}/', {'price_per_person': '0'}, format='json')
        att = self.att(self.gd, self.p1)
        self.assertTrue(att.present)
        self.assertFalse(att.is_reserved)

    def test_clearing_court_price_stops_charging(self):
        gd = self.make_gameday(court_price=Decimal('100'))
        self.client.patch(f'{BASE}/{gd.id}/', {'court_price': None}, format='json')
        data = self.client.get(f'{BASE}/{gd.id}/checkin-info/').data['gameday']
        self.assertIsNone(data['court_price'])
        self.assertEqual(data['price_per_person'], Decimal('0'))

    def test_fixed_event_requires_price(self):
        response = self.client.post(f'{BASE}/', {'date': str(date.today()), 'pricing_type': 'fixed'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('price_per_person', response.data)

    def test_arena_name_is_saved_and_listed_apart_from_the_map_address(self):
        response = self.client.post(f'{BASE}/', {
            'date': str(date.today()), 'location': 'R. Santos Dumont, Recife', 'arena_name': 'Arena Belo Gol',
        }, format='json')
        self.assertEqual(response.status_code, 201)

        listed = next(gd for gd in self.client.get(f'{BASE}/').data['results'] if gd['id'] == response.data['id'])
        self.assertEqual(listed['arena_name'], 'Arena Belo Gol')
        self.assertEqual(listed['location'], 'R. Santos Dumont, Recife')

    def test_arena_name_is_optional(self):
        response = self.client.post(f'{BASE}/', {'date': str(date.today())}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['arena_name'], '')

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
        self.checkin(self.gd, self.p1)

    def post(self, action, **data):
        return self.client.post(f'{BASE}/{self.gd.id}/{action}/', {'player_id': self.p1.id, **data}, format='json')

    def test_reserving_is_still_public_for_athletes_without_account(self):
        self.assertTrue(self.att(self.gd, self.p1).is_reserved)
        response = self.client.post(f'{BASE}/{self.gd.id}/public-checkin/', link_data(self.p3), format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.att(self.gd, self.p3).is_reserved)

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


class AbsenceSyncTests(TestCase):
    """Contagem de faltas consecutivas: Ponto de Reset do admin e falta justificada."""

    def setUp(self):
        from .models import CourtCheckin
        self.CourtCheckin = CourtCheckin
        self.athlete = make_player('Atleta')
        self.witness = make_player('Testemunha')  # garante check-in na quadra (o circuito "aconteceu")
        Player.objects.filter(pk__in=[self.athlete.pk, self.witness.pk]).update(
            created_at=timezone.now() - timedelta(days=30))

    def day(self, days_ago, athlete_went=False, athlete_enrolled=False, justified=False):
        gd = GameDay.objects.create(date=date.today() - timedelta(days=days_ago), is_closed=True, is_published=True)
        self.CourtCheckin.objects.create(gameday=gd, player=self.witness)
        if athlete_went:
            self.CourtCheckin.objects.create(gameday=gd, player=self.athlete)
        if athlete_enrolled or justified:
            Attendance.objects.create(gameday=gd, player=self.athlete, present=True, is_justified=justified)
        return gd

    def sync(self):
        from .views import sync_absences_logic
        sync_absences_logic()
        self.athlete.refresh_from_db()

    def test_absences_count_up(self):
        for d in (5, 4, 3):
            self.day(d)
        self.sync()
        self.assertEqual(self.athlete.consecutive_absences, 3)

    def test_tonights_open_circuit_is_not_counted_after_9pm(self):
        """Às 22h em Brasília já é o dia seguinte em UTC: o circuito de hoje, ainda aberto, não pode gerar falta."""
        from datetime import datetime, time, timezone as dt_timezone
        from unittest.mock import patch

        today = timezone.localdate()
        gd = GameDay.objects.create(date=today, is_closed=False, is_published=True)
        self.CourtCheckin.objects.create(gameday=gd, player=self.witness)
        Attendance.objects.create(gameday=gd, player=self.athlete, present=True)

        # timezone.now() devolve UTC, como no servidor: 22h30 de Brasília = 01h30 do dia seguinte em UTC
        late_night = timezone.make_aware(datetime.combine(today, time(22, 30))).astimezone(dt_timezone.utc)
        with patch('django.utils.timezone.now', return_value=late_night):
            self.sync()
        self.assertEqual(self.athlete.consecutive_absences, 0)
        self.assertFalse(Attendance.objects.get(gameday=gd, player=self.athlete).was_no_show)

    def test_days_before_reset_date_are_ignored(self):
        for d in (5, 4, 3):
            self.day(d)
        Player.objects.filter(pk=self.athlete.pk).update(absences_reset_date=date.today() - timedelta(days=4))
        self.sync()
        self.assertEqual(self.athlete.consecutive_absences, 1)

    def test_justified_absence_neither_counts_nor_marks_no_show(self):
        self.day(5)
        gd = self.day(4, justified=True)
        self.sync()
        self.assertEqual(self.athlete.consecutive_absences, 1)
        self.assertFalse(Attendance.objects.get(gameday=gd, player=self.athlete).was_no_show)

    def test_unjustified_enrolled_absence_is_no_show(self):
        gd = self.day(4, athlete_enrolled=True)
        self.sync()
        self.assertTrue(Attendance.objects.get(gameday=gd, player=self.athlete).was_no_show)
        self.assertEqual(self.athlete.consecutive_absences, 1)

    def test_court_checkin_resets_count(self):
        self.day(5)
        self.day(4, athlete_went=True)
        self.sync()
        self.assertEqual(self.athlete.consecutive_absences, 0)

    def test_frequency_follows_the_absence_rule(self):
        """Presença: dias com circuito realizado desde o cadastro; ida = check-in na quadra."""
        from .frequency import circuit_days, frequency
        self.day(6, athlete_went=True)
        same_day = GameDay.objects.create(date=date.today() - timedelta(days=6), is_closed=True, is_published=True)
        self.CourtCheckin.objects.create(gameday=same_day, player=self.witness)  # 2 circuitos no mesmo dia = 1 dia
        self.day(5)                    # faltou
        self.day(4, justified=True)    # falta justificada: fora da conta
        self.day(3, athlete_went=True)
        self.day(40)                   # antes do cadastro
        for days_ago, closed, published in ((2, True, False), (0, False, True)):  # não publicado; hoje, ainda aberto
            gd = GameDay.objects.create(date=date.today() - timedelta(days=days_ago), is_closed=closed, is_published=published)
            self.CourtCheckin.objects.create(gameday=gd, player=self.witness)
        self.athlete.refresh_from_db()
        self.assertEqual(frequency(self.athlete, circuit_days()), {'attended_days': 2, 'total_days': 3, 'rate': 66.7})

    def test_admin_action_sets_reset_date(self):
        from unittest.mock import Mock
        from apps.players.admin import reset_consecutive_absences
        Player.objects.filter(pk=self.athlete.pk).update(consecutive_absences=7)
        reset_consecutive_absences(Mock(), None, Player.objects.filter(pk=self.athlete.pk))
        self.athlete.refresh_from_db()
        self.assertEqual(self.athlete.consecutive_absences, 0)
        self.assertEqual(self.athlete.absences_reset_date, timezone.localdate())


class JustifyAbsenceTests(TestCase):
    """Admin justifica (e desfaz) a falta pelo app; as faltas são recalculadas na hora."""

    def setUp(self):
        from .models import CourtCheckin
        self.CourtCheckin = CourtCheckin
        self.client = APIClient()
        self.admin = User.objects.create_user('adm@x.com', 'senha-forte-123', name='Adm', profile='admin')
        self.athlete = make_player('Atleta')
        self.witness = make_player('Testemunha')
        Player.objects.filter(pk__in=[self.athlete.pk, self.witness.pk]).update(created_at=timezone.now() - timedelta(days=30))

    def absent_day(self, days_ago):
        gd = GameDay.objects.create(date=date.today() - timedelta(days=days_ago), is_closed=True, is_published=True)
        self.CourtCheckin.objects.create(gameday=gd, player=self.witness)
        return Attendance.objects.create(gameday=gd, player=self.athlete, present=False)

    def justify(self, att, **data):
        return self.client.post(f'/api/attendance/records/{att.id}/justify/', data, format='json')

    def test_admin_justifies_and_undoes(self):
        from .views import sync_absences_logic
        self.absent_day(5)
        att = self.absent_day(4)
        sync_absences_logic()
        self.assertEqual(Player.objects.get(pk=self.athlete.pk).consecutive_absences, 2)

        self.client.force_authenticate(self.admin)
        response = self.justify(att)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['consecutive_absences'], 1)
        self.assertTrue(Attendance.objects.get(pk=att.pk).is_justified)

        response = self.justify(att, justified=False)
        self.assertEqual(response.data['consecutive_absences'], 2)
        self.assertFalse(Attendance.objects.get(pk=att.pk).is_justified)

    def test_athlete_cannot_justify(self):
        att = self.absent_day(4)
        self.client.force_authenticate(User.objects.create_user('outro@x.com', 'senha-forte-123', name='Outro'))
        self.assertEqual(self.justify(att).status_code, 403)
        self.assertFalse(Attendance.objects.get(pk=att.pk).is_justified)


class InactiveAndReactivationTests(CircuitApiTestCase):
    """Inativo não se inscreve; quem aparece na quadra volta a ficar ativo sem o recálculo desfazer."""

    COURT = '/api/attendance/court-checkins'

    def setUp(self):
        super().setUp()
        from .models import CourtCheckin
        self.CourtCheckin = CourtCheckin
        self.witness = make_player('Testemunha')
        Player.objects.filter(pk__in=[self.p1.pk, self.witness.pk]).update(
            created_at=timezone.now() - timedelta(days=60))
        self.p1.refresh_from_db()

    def past_absences(self, n):
        """n circuitos encerrados no passado em que o p1 não foi à quadra."""
        for d in range(n, 0, -1):
            gd = GameDay.objects.create(date=date.today() - timedelta(days=d), is_closed=True, is_published=True)
            self.CourtCheckin.objects.create(gameday=gd, player=self.witness)

    def sync(self):
        from .views import sync_absences_logic
        sync_absences_logic()
        self.p1.refresh_from_db()

    def set_inactive(self):
        Player.objects.filter(pk=self.p1.pk).update(status='inactive')

    def test_inactive_athlete_cannot_check_in(self):
        self.set_inactive()
        gd = self.make_gameday()
        response = self.checkin(gd, self.p1)
        self.assertEqual(response.status_code, 403)
        self.assertFalse(self.att(gd, self.p1).present)

    def test_admin_can_still_add_inactive_athlete(self):
        self.set_inactive()
        gd = self.make_gameday()
        self.client.force_authenticate(self.admin)
        self.client.patch(f'{BASE}/{gd.id}/toggle/{self.p1.id}/')
        self.assertTrue(self.att(gd, self.p1).present)

    def test_court_checkin_reactivates(self):
        self.set_inactive()
        gd = self.make_gameday(date=date.today())
        self.client.force_authenticate(self.admin)
        self.client.post(f'{self.COURT}/toggle/', {'gameday_id': gd.id, 'player_id': self.p1.id}, format='json')
        self.p1.refresh_from_db()
        self.assertEqual(self.p1.status, 'active')
        self.assertEqual(self.p1.absences_reset_date, date.today())

    def test_bulk_court_checkin_is_staff_only_and_reactivates(self):
        self.set_inactive()
        gd = self.make_gameday(date=date.today())
        payload = {'gameday_id': gd.id, 'player_ids': [self.p1.id], 'action_type': 'check_all'}
        self.client.force_authenticate(self.athlete_user)
        self.assertEqual(self.client.post(f'{self.COURT}/bulk-toggle/', payload, format='json').status_code, 403)
        self.assertFalse(self.CourtCheckin.objects.filter(gameday=gd).exists())

        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(f'{self.COURT}/bulk-toggle/', payload, format='json').status_code, 200)
        self.p1.refresh_from_db()
        self.assertEqual(self.p1.status, 'active')

    def test_reactivation_by_court_survives_recalculation(self):
        self.past_absences(12)
        self.sync()
        self.assertEqual(self.p1.status, 'inactive')
        gd = self.make_gameday(date=date.today())  # circuito de hoje, ainda aberto
        self.client.force_authenticate(self.admin)
        self.client.post(f'{self.COURT}/toggle/', {'gameday_id': gd.id, 'player_id': self.p1.id}, format='json')
        self.sync()
        self.assertEqual(self.p1.status, 'active')

    def test_recalculation_keeps_manual_inactivation(self):
        """Quem o admin inativou não volta a ativo só porque já foi à quadra no passado."""
        gd = GameDay.objects.create(date=date.today() - timedelta(days=3), is_closed=True, is_published=True)
        self.CourtCheckin.objects.create(gameday=gd, player=self.p1)
        self.set_inactive()
        self.sync()
        self.assertEqual(self.p1.status, 'inactive')

    def test_old_streak_does_not_inactivate_who_came_back(self):
        """Chegou a 10 faltas no passado, voltou a jogar e tem 2 faltas agora: continua ativo."""
        for d in range(15, 1, -1):
            gd = GameDay.objects.create(date=date.today() - timedelta(days=d), is_closed=True, is_published=True)
            self.CourtCheckin.objects.create(gameday=gd, player=self.witness)
            if d in (5, 4):
                self.CourtCheckin.objects.create(gameday=gd, player=self.p1)
        self.sync()
        self.assertEqual(self.p1.status, 'active')
        self.assertEqual(self.p1.consecutive_absences, 2)

    def test_ten_current_absences_inactivate(self):
        self.past_absences(10)
        self.sync()
        self.assertEqual(self.p1.status, 'inactive')

    def test_admin_reactivation_survives_recalculation(self):
        self.past_absences(12)
        self.sync()
        self.assertEqual(self.p1.status, 'inactive')
        self.client.force_authenticate(self.admin)
        response = self.client.patch(f'/api/players/{self.p1.id}/', {'status': 'active'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.sync()
        self.assertEqual(self.p1.status, 'active')
        self.assertEqual(self.p1.consecutive_absences, 0)

    def test_admin_court_action_creates_checkin_and_reactivates(self):
        from unittest.mock import Mock
        from .admin import court_checkin_add
        self.set_inactive()
        gd = self.make_gameday(date=date.today())
        court_checkin_add(Mock(), None, Attendance.objects.filter(gameday=gd, player=self.p1))
        self.assertTrue(self.CourtCheckin.objects.filter(gameday=gd, player=self.p1).exists())
        self.p1.refresh_from_db()
        self.assertEqual(self.p1.status, 'active')


class LinkedAccountCheckinTests(CircuitApiTestCase):
    """Atleta com conta confirma pelo login; quem não tem conta segue usando o link do grupo."""

    def setUp(self):
        super().setUp()
        self.other_user = User.objects.create_user('outra@x.com', 'senha-forte-123', name='Outra')
        self.gd = self.make_gameday(max_players=10)

    def post(self, player, action='public-checkin', **data):
        return self.client.post(f'{BASE}/{self.gd.id}/{action}/', {'player_id': player.id, **data}, format='json')

    def test_anonymous_cannot_check_in_athlete_with_account(self):
        self.assertEqual(self.post(self.p1).status_code, 401)
        self.assertFalse(self.att(self.gd, self.p1).present)

    def test_other_athlete_cannot_check_in_athlete_with_account(self):
        self.client.force_authenticate(self.other_user)
        self.assertEqual(self.post(self.p1).status_code, 403)
        self.assertFalse(self.att(self.gd, self.p1).present)

    def test_owner_and_admin_can_check_in(self):
        self.client.force_authenticate(self.athlete_user)
        self.assertEqual(self.post(self.p1).status_code, 200)
        self.assertTrue(self.att(self.gd, self.p1).present)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.post(self.p2).status_code, 200)

    def test_athlete_without_account_uses_the_link_with_the_whatsapp_digits(self):
        self.assertEqual(self.post(self.p2, phone_check=self.p2.phone[-5:]).status_code, 200)
        self.assertTrue(self.att(self.gd, self.p2).present)

    def test_link_without_or_with_wrong_digits_does_not_check_in(self):
        missing = self.post(self.p2)
        wrong = self.post(self.p2, phone_check='00000')
        self.assertEqual((missing.status_code, missing.data['code']), (400, 'phone_check_required'))
        self.assertEqual((wrong.status_code, wrong.data['code']), (403, 'phone_check_failed'))
        self.assertFalse(self.att(self.gd, self.p2).present)

    def test_athlete_without_whatsapp_is_told_to_ask_the_staff(self):
        no_phone = make_player('Sem Zap', phone='')
        Attendance.objects.create(gameday=self.gd, player=no_phone)
        response = self.post(no_phone, phone_check='12345')
        self.assertEqual((response.status_code, response.data['code']), (400, 'phone_missing'))

    def test_only_a_logged_athlete_invites_and_up_to_two_per_circuit(self):
        self.assertEqual(self.post(self.p2, 'public-add-guest', name='Amigo').status_code, 401)  # sem login

        self.client.force_authenticate(self.athlete_user)
        for name in ('Amigo Um', 'Amigo Dois'):
            self.assertEqual(self.post(self.p1, 'public-add-guest', name=name).status_code, 200)
        third = self.post(self.p1, 'public-add-guest', name='Amigo Tres')
        self.assertEqual(third.status_code, 400)
        self.assertIn('fale com a moderação', third.data['detail'])

        self.client.force_authenticate(self.admin)  # a staff não tem limite
        self.assertEqual(self.post(self.p1, 'public-add-guest', name='Amigo Tres').status_code, 200)

    def test_guest_is_confirmed_by_whoever_invited(self):
        self.client.force_authenticate(self.athlete_user)
        self.post(self.p1, 'public-add-guest', name='Visita')
        guest = Player.objects.get(is_guest=True, invited_by_player=self.p1)
        self.assertEqual(self.post(guest).status_code, 200)

        self.client.force_authenticate(None)
        anonymous = self.post(guest, phone_check='12345')
        self.assertEqual((anonymous.status_code, anonymous.data['code']), (403, 'guest_by_inviter'))

    def test_checkin_info_tells_who_has_account(self):
        players = {p['id']: p for p in self.client.get(f'{BASE}/{self.gd.id}/checkin-info/').data['players']}
        self.assertTrue(players[self.p1.id]['has_account'])
        self.assertFalse(players[self.p2.id]['has_account'])


class CloseCircuitTests(CircuitApiTestCase):
    """Encerrar o circuito recalcula as faltas; publicar continua notificando."""

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.admin)

    def patch(self, gd, **data):
        return self.client.patch(f'{BASE}/{gd.id}/', data, format='json')

    def test_closing_recalculates_absences_once(self):
        from unittest.mock import patch
        gd = self.make_gameday()
        with patch('apps.attendance.views.sync_absences_logic') as sync:
            self.assertEqual(self.patch(gd, description='Ajuste').status_code, 200)
            sync.assert_not_called()
            self.assertEqual(self.patch(gd, is_closed=True).status_code, 200)
            sync.assert_called_once()
            self.patch(gd, description='Depois de fechado')
            sync.assert_called_once()

    def test_publishing_still_sets_published_at(self):
        gd = self.make_gameday(is_published=False)
        self.assertEqual(self.patch(gd, is_published=True).status_code, 200)
        gd.refresh_from_db()
        self.assertIsNotNone(gd.published_at)


class GuestLevelTests(TestCase):
    """Nível temporário do convidado (1 a 10): escolhido ao convidar, usado no sorteio até ele ter avaliação."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.client.force_authenticate(self.admin)
        self.gd = GameDay.objects.create(date=date.today(), is_published=True)
        self.host = make_player('Anfitrião')

    def guest(self, name):
        return Player.objects.get(name__startswith=name, is_guest=True)

    def test_admin_and_athlete_choose_the_level(self):
        admin = self.client.post(f'{BASE}/{self.gd.id}/add-guest/', {'name': 'Iniciante', 'main_position': 'setter', 'guest_overall': 2}, format='json')
        athlete = self.client.post(f'{BASE}/{self.gd.id}/public-add-guest/', {
            'player_id': self.host.id, 'name': 'Avançado', 'main_position': 'outside', 'guest_overall': 9,
        }, format='json')
        self.assertEqual((admin.status_code, athlete.status_code), (200, 200))
        self.assertEqual((self.guest('Iniciante').guest_overall, self.guest('Avançado').guest_overall), (2, 9))

    def test_level_outside_1_to_10_is_rejected(self):
        for value in (0, 11, 'forte'):
            response = self.client.post(f'{BASE}/{self.gd.id}/add-guest/', {'name': f'X{value}', 'main_position': 'setter', 'guest_overall': value}, format='json')
            self.assertEqual(response.status_code, 400)
        self.assertFalse(Player.objects.filter(is_guest=True).exists())

    def test_admin_can_correct_the_level(self):
        self.client.post(f'{BASE}/{self.gd.id}/add-guest/', {'name': 'Fulano', 'main_position': 'setter'}, format='json')
        guest = self.guest('Fulano')
        self.assertIsNone(guest.guest_overall)  # sem nível: o sorteio usa 5, como antes
        response = self.client.patch(f'/api/players/{guest.id}/', {'guest_overall': 7}, format='json')
        self.assertEqual(response.status_code, 200)
        guest.refresh_from_db()
        self.assertEqual(guest.guest_overall, 7)

    def test_draw_uses_the_level_until_a_real_evaluation(self):
        from apps.evaluations.models import Evaluation
        from apps.teams.algorithm import get_players_with_overall
        from apps.teams.models import Team, TeamGeneration, TeamPlayer
        from apps.teams.serializers import TeamPlayerSerializer

        guest = Player.objects.create(name='Convidado', main_position='setter', is_guest=True, guest_overall=2)
        plain = Player.objects.create(name='Sem nível', main_position='setter', is_guest=True)
        overall = {p['id']: p['overall'] for p in get_players_with_overall(player_ids=[guest.id, plain.id])}
        self.assertEqual((overall[guest.id], overall[plain.id]), (2.0, 5.0))

        team = Team.objects.create(generation=TeamGeneration.objects.create(modality=2), name='Time', order=0)
        card = TeamPlayerSerializer(TeamPlayer.objects.create(team=team, player=guest)).data
        self.assertEqual(card['player_overall'], 2)  # no card do time e no empréstimo da fila também

        evaluation = Evaluation.objects.create(player=guest, evaluator=self.admin, date=date.today())
        overall = {p['id']: p['overall'] for p in get_players_with_overall(player_ids=[guest.id])}
        self.assertEqual(overall[guest.id], evaluation.overall)  # a avaliação de verdade passa a valer
