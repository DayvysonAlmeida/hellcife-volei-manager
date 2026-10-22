"""Regras de cobrança dos circuitos: reserva com prazo, confirmação de pagamento e resumo financeiro."""
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import Attendance, AttendancePayment, GameDay


def _notify(attendance, title, message):
    user = getattr(attendance.player, 'user', None)
    if user and user.is_active:
        from apps.notifications.models import Notification
        from apps.notifications.services import notify
        notify([Notification(user=user, title=title, message=message, type='financial')])


class CircuitPaymentService:

    @staticmethod
    def needs_payment(gameday: GameDay) -> bool:
        """Circuito exige pagamento antes de confirmar a vaga."""
        return gameday.requires_prepayment and gameday.effective_price_per_person > 0

    @staticmethod
    def reserve(attendance: Attendance) -> Attendance:
        """Reserva a vaga aguardando pagamento, com o prazo configurado no circuito."""
        gameday = attendance.gameday
        hold = gameday.reservation_hold_minutes
        attendance.is_reserved = True
        attendance.reserved_until = timezone.now() + timedelta(minutes=hold) if hold else None
        attendance.amount_due = gameday.effective_price_per_person
        attendance.payment_claimed = False
        attendance.present = False
        attendance.is_waitlist = False
        attendance.waitlist_joined_at = None
        attendance.save()
        return attendance

    @staticmethod
    def release(attendance: Attendance) -> Attendance:
        """Libera uma reserva (cancelamento ou expiração)."""
        attendance.is_reserved = False
        attendance.reserved_until = None
        attendance.amount_due = None
        attendance.payment_claimed = False
        attendance.save()
        return attendance

    @staticmethod
    def expire_reservations(gameday: GameDay) -> int:
        """
        Libera reservas vencidas e passa as vagas para a fila de espera.
        Quem avisou que pagou não perde a vaga enquanto o admin não confere.
        Retorna quantas reservas expiraram.
        """
        if gameday.is_closed:
            return 0
        expired = list(
            gameday.attendances.select_related('player__user').filter(
                is_reserved=True, payment_claimed=False,
                reserved_until__isnull=False, reserved_until__lte=timezone.now(),
            )
        )
        for att in expired:
            CircuitPaymentService.release(att)
            _notify(att, 'Reserva expirada ⏰', 'O prazo para pagamento acabou e sua vaga foi liberada para a fila de espera.')

        if expired:
            CircuitPaymentService.fill_from_waitlist(gameday)
        return len(expired)

    @staticmethod
    def confirm_reservations(gameday: GameDay) -> int:
        """
        Circuito deixou de exigir pagamento: reservas válidas viram presença confirmada
        e as vencidas são liberadas. Retorna quantas presenças foram confirmadas.
        """
        now = timezone.now()
        reserved = list(gameday.attendances.select_related('player__user').filter(is_reserved=True))
        confirmed = 0
        for att in reserved:
            if not (att.payment_claimed or att.reserved_until is None or att.reserved_until > now):
                CircuitPaymentService.release(att)
                continue
            att.is_reserved = False
            att.reserved_until = None
            att.present = True
            att.is_waitlist = False
            att.save()
            _notify(att, 'Presença confirmada! 🏐', 'O circuito não exige mais pagamento antecipado. Sua vaga está garantida!')
            confirmed += 1
        return confirmed

    @staticmethod
    def fill_from_waitlist(gameday: GameDay) -> list[Attendance]:
        """Reserva vagas livres para os próximos da fila (mesma ordem do 'promover da fila')."""
        promoted = []
        while not gameday.max_players or gameday.occupied_spots < gameday.max_players:
            nxt = (
                gameday.attendances.filter(is_waitlist=True)
                .select_related('player__user')
                .order_by('-is_priority', 'player__is_guest', 'waitlist_joined_at')
                .first()
            )
            if not nxt:
                break
            CircuitPaymentService.reserve(nxt)
            prazo = f' até {timezone.localtime(nxt.reserved_until):%H:%M}' if nxt.reserved_until else ''
            _notify(nxt, 'Vaga liberada! 🏐', f'Abriu uma vaga no circuito. Pague R$ {nxt.amount_due}{prazo} para confirmar.')
            promoted.append(nxt)
            if not gameday.max_players:
                break
        return promoted

    @staticmethod
    def confirm_payment(attendance: Attendance, method: str, amount=None, confirmed_by=None, asaas_payment_id=None) -> AttendancePayment:
        """Registra o pagamento; se a vaga estava reservada, confirma a presença."""
        with transaction.atomic():
            # of=('self',): o Postgres não trava o lado opcional do join (atleta sem conta no app)
            att = Attendance.objects.select_for_update(of=('self',)).select_related('gameday', 'player__user').get(pk=attendance.pk)
            gameday = att.gameday
            due = att.amount_due if att.amount_due is not None else gameday.effective_price_per_person
            if amount is None:
                amount = Decimal('0') if method == AttendancePayment.METHOD_EXEMPT else due

            payment = AttendancePayment.objects.create(
                attendance=att, amount=amount, method=method,
                status=AttendancePayment.STATUS_PAID, paid_at=timezone.now(),
                confirmed_by=confirmed_by, asaas_payment_id=asaas_payment_id,
            )

            att.has_paid = True
            att.payment_claimed = False
            att.amount_due = due
            if att.is_reserved:
                att.is_reserved = False
                att.reserved_until = None
                att.present = True
                att.is_waitlist = False
            att.save()

        if method == AttendancePayment.METHOD_EXEMPT:
            _notify(att, 'Presença confirmada! 🏐', 'Sua participação foi liberada pela organização. Vamos pro jogo!')
        else:
            _notify(att, 'Pagamento Confirmado! 💰', 'Seu pagamento foi recebido com sucesso. Obrigado e vamos pro jogo! 🏐')
        return payment

    @staticmethod
    def revert_payment(attendance: Attendance) -> None:
        """Desfaz a confirmação (pagamento marcado por engano). A presença não muda."""
        with transaction.atomic():
            attendance.payments.filter(status=AttendancePayment.STATUS_PAID).update(status=AttendancePayment.STATUS_CANCELED)
            attendance.has_paid = False
            attendance.save(update_fields=['has_paid'])

    @staticmethod
    def update_pending_amounts(gameday: GameDay) -> None:
        """Quando o admin muda o valor, atualiza quem ainda não pagou."""
        gameday.attendances.filter(has_paid=False).filter(Q(is_reserved=True) | Q(present=True)).update(
            amount_due=gameday.effective_price_per_person
        )

    @staticmethod
    def summary(gameday: GameDay) -> dict:
        """Resumo financeiro do circuito."""
        price = gameday.effective_price_per_person
        now = timezone.now()
        atts = list(gameday.attendances.prefetch_related('payments'))

        def is_active_reservation(a):
            return a.is_reserved and (a.payment_claimed or a.reserved_until is None or a.reserved_until > now)

        participants = [a for a in atts if a.present or is_active_reservation(a)]
        paid_payments = [p for a in atts for p in a.payments.all() if p.status == AttendancePayment.STATUS_PAID]
        collected = sum((p.amount for p in paid_payments), Decimal('0'))
        unpaid = [a for a in participants if not a.has_paid]
        outstanding = sum(((a.amount_due if a.amount_due is not None else price) for a in unpaid), Decimal('0'))
        court_cost = gameday.court_price or Decimal('0')

        return {
            'pricing_type': gameday.pricing_type,
            'price_per_person': price,
            'suggested_price_per_person': gameday.suggested_price_per_person,
            'requires_prepayment': gameday.requires_prepayment,
            'confirmed': sum(1 for a in atts if a.present),
            'reserved': sum(1 for a in atts if is_active_reservation(a)),
            'paid': sum(1 for a in participants if a.has_paid),
            'exempt': sum(1 for p in paid_payments if p.method == AttendancePayment.METHOD_EXEMPT),
            'claimed': sum(1 for a in unpaid if a.payment_claimed),
            'pending': len(unpaid),
            'expected': collected + outstanding,
            'collected': collected,
            'outstanding': outstanding,
            'court_cost': court_cost,
            'balance': collected - court_cost,
        }
