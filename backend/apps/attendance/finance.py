"""Relatórios financeiros dos circuitos (visão geral do mês, avisos de pagamento e devedores)."""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from django.db.models import Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from .models import Attendance, AttendancePayment, GameDay
from .payments import CircuitPaymentService

ZERO = Decimal('0')


def _month_bounds(month: date) -> tuple[date, date]:
    start = month.replace(day=1)
    return start, start + relativedelta(months=1)


def _location_key(location: str | None) -> str:
    return ' '.join((location or 'Sem local').lower().split())


def _active_reservation_q():
    return Q(is_reserved=True) & (
        Q(payment_claimed=True) | Q(reserved_until__isnull=True) | Q(reserved_until__gt=timezone.now())
    )


def _attendance_row(att: Attendance) -> dict:
    gd = att.gameday
    return {
        'attendance_id': att.id,
        'player_id': att.player_id,
        'player_name': att.player.display_name,
        'player_avatar': att.player.avatar_url,
        'player_is_guest': att.player.is_guest,
        'gameday_id': gd.id,
        'gameday_date': gd.date,
        'gameday_location': gd.location,
        'gameday_is_closed': gd.is_closed,
        'amount_due': att.amount_due if att.amount_due is not None else gd.effective_price_per_person,
        'is_reserved': att.is_reserved,
        'reserved_until': att.reserved_until,
        'payment_claimed': att.payment_claimed,
    }


def payment_claims() -> list[dict]:
    """Atletas que avisaram que pagaram e aguardam conferência do admin."""
    qs = (
        Attendance.objects.filter(payment_claimed=True, has_paid=False)
        .filter(Q(present=True) | Q(is_reserved=True))
        .select_related('player', 'gameday')
        .order_by('gameday__date', 'player__name')
    )
    return [_attendance_row(a) for a in qs]


def debtors(days: int = 60) -> list[dict]:
    """Participantes (confirmados ou com reserva válida) que ainda não pagaram, nos circuitos dos últimos N dias."""
    since = timezone.localdate() - timedelta(days=days)
    qs = (
        Attendance.objects.filter(has_paid=False, gameday__date__gte=since)
        .filter(Q(present=True) | _active_reservation_q())
        .select_related('player', 'gameday')
        .order_by('player__name', 'gameday__date')
    )
    rows = [_attendance_row(a) for a in qs]
    return [r for r in rows if r['amount_due'] and r['amount_due'] > 0]


def overview(month: date) -> dict:
    start, end = _month_bounds(month)

    paid = AttendancePayment.objects.filter(
        status=AttendancePayment.STATUS_PAID, paid_at__date__gte=start, paid_at__date__lt=end
    )
    circuits_received = paid.aggregate(t=Sum('amount'))['t'] or ZERO

    from apps.subscriptions.models import ExtraCreditPurchase, UserSubscription
    extras_received = ExtraCreditPurchase.objects.filter(
        status='PAID', created_at__date__gte=start, created_at__date__lt=end
    ).aggregate(t=Sum('price_paid'))['t'] or ZERO

    gamedays = list(GameDay.objects.filter(date__gte=start, date__lt=end).order_by('date'))
    circuits = []
    by_location = defaultdict(lambda: {'label': None, 'collected': ZERO, 'court_cost': ZERO, 'circuits': 0})
    for gd in gamedays:
        s = CircuitPaymentService.summary(gd)
        circuits.append({'id': gd.id, 'date': gd.date, 'location': gd.location, 'is_closed': gd.is_closed, **s})
        loc = by_location[_location_key(gd.location)]
        loc['label'] = loc['label'] or (gd.location or 'Sem local').strip()
        loc['collected'] += s['collected']
        loc['court_cost'] += s['court_cost']
        loc['circuits'] += 1

    court_costs = sum((c['court_cost'] for c in circuits), ZERO)
    received = circuits_received + extras_received
    active_subs = UserSubscription.objects.filter(status='active').select_related('plan')

    return {
        'month': start.strftime('%Y-%m'),
        'received': received,
        'circuits_received': circuits_received,
        'extras_received': extras_received,
        'court_costs': court_costs,
        'balance': received - court_costs,
        'outstanding': sum((c['outstanding'] for c in circuits), ZERO),
        'payments_count': paid.exclude(method=AttendancePayment.METHOD_EXEMPT).count(),
        'pending_claims': Attendance.objects.filter(payment_claimed=True, has_paid=False).count(),
        'plans': {
            'active_subscriptions': active_subs.count(),
            'mrr_estimate': sum((s.plan.price for s in active_subs), ZERO),
        },
        'circuits': circuits,
        'by_location': sorted(by_location.values(), key=lambda loc: loc['collected'], reverse=True),
        'series': monthly_series(end, months=12),
    }


def monthly_series(end: date, months: int = 12) -> list[dict]:
    """Recebido × custo das quadras dos últimos N meses (até o mês anterior a `end`)."""
    start = end - relativedelta(months=months)
    received = defaultdict(lambda: ZERO)
    for row in (
        AttendancePayment.objects.filter(status=AttendancePayment.STATUS_PAID, paid_at__date__gte=start, paid_at__date__lt=end)
        .annotate(m=TruncMonth('paid_at')).values('m').annotate(t=Sum('amount'))
    ):
        received[row['m'].strftime('%Y-%m')] += row['t'] or ZERO

    from apps.subscriptions.models import ExtraCreditPurchase
    for row in (
        ExtraCreditPurchase.objects.filter(status='PAID', created_at__date__gte=start, created_at__date__lt=end)
        .annotate(m=TruncMonth('created_at')).values('m').annotate(t=Sum('price_paid'))
    ):
        received[row['m'].strftime('%Y-%m')] += row['t'] or ZERO

    costs = defaultdict(lambda: ZERO)
    for row in (
        GameDay.objects.filter(date__gte=start, date__lt=end)
        .annotate(m=TruncMonth('date')).values('m').annotate(t=Sum('court_price'))
    ):
        costs[row['m'].strftime('%Y-%m')] += row['t'] or ZERO

    series = []
    for i in range(months):
        key = (start + relativedelta(months=i)).strftime('%Y-%m')
        series.append({'month': key, 'received': received[key], 'court_costs': costs[key]})
    return series
