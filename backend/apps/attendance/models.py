from decimal import Decimal, ROUND_UP

from django.db import models
from django.utils import timezone


class GameDay(models.Model):
    date = models.DateField(verbose_name='Data')
    time = models.TimeField(blank=True, null=True, verbose_name='Hora Inicial')
    time_end = models.TimeField(blank=True, null=True, verbose_name='Hora Final')
    court_price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, verbose_name='Valor da Quadra')
    credit_cost = models.DecimalField(max_digits=4, decimal_places=1, default=0, verbose_name='Custo em Créditos', help_text='Quantos créditos custa para participar desta pelada (0 = não usa créditos).')

    # ── Cobrança ──
    PRICING_SPLIT = 'split'
    PRICING_FIXED = 'fixed'
    PRICING_CHOICES = [
        (PRICING_SPLIT, 'Rateio da quadra'),
        (PRICING_FIXED, 'Taxa fixa (evento)'),
    ]
    pricing_type = models.CharField(max_length=10, choices=PRICING_CHOICES, default=PRICING_SPLIT, verbose_name='Tipo de cobrança')
    price_per_person = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True, verbose_name='Valor por pessoa',
        help_text='Obrigatório em eventos. No rateio, se vazio, usa o valor da quadra dividido pelas vagas.'
    )
    requires_prepayment = models.BooleanField(
        default=False, verbose_name='Exigir pagamento para confirmar',
        help_text='A vaga fica reservada e só é confirmada quando o pagamento for confirmado.'
    )
    reservation_hold_minutes = models.PositiveIntegerField(
        null=True, blank=True, verbose_name='Prazo da reserva (min)',
        help_text='Tempo para pagar antes de a vaga ir para a fila. Vazio = não expira.'
    )
    description = models.CharField(max_length=200, blank=True, null=True, verbose_name='Descrição')
    location = models.CharField(max_length=200, blank=True, null=True, verbose_name='Local')
    max_players = models.PositiveSmallIntegerField(default=0, verbose_name='Limite de Jogadores')
    pix_key = models.CharField(max_length=200, blank=True, null=True, verbose_name='Chave PIX', help_text='Chave PIX opcional para recebimento do rateio.')
    is_closed = models.BooleanField(default=False, verbose_name='Encerrado', help_text='Se verdadeiro, o circuito e todas as suas peladas estão encerrados')
    is_published = models.BooleanField(default=False, verbose_name='Publicado', help_text='Se verdadeiro, o circuito fica visível para os atletas')
    published_at = models.DateTimeField(null=True, blank=True, verbose_name='Data de Publicação', help_text='A data em que o circuito foi publicado para os atletas')
    is_full_notified = models.BooleanField(default=False, help_text='Garante que a notificação de lotação seja enviada apenas uma vez')
    created_by = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True,
        verbose_name='Criado por'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Dia de jogo'
        verbose_name_plural = 'Dias de jogo'
        ordering = ['-date']

    def __str__(self):
        return f'Dia de jogo: {self.date}'

    @property
    def total_present(self):
        if hasattr(self, '_prefetched_objects_cache') and 'attendances' in self._prefetched_objects_cache:
            return sum(1 for a in self.attendances.all() if a.present)
        return self.attendances.filter(present=True).count()

    @property
    def suggested_price_per_person(self):
        """Rateio sugerido: valor da quadra ÷ vagas, arredondado para cima no centavo."""
        if self.court_price and self.max_players:
            return (Decimal(self.court_price) / self.max_players).quantize(Decimal('0.01'), rounding=ROUND_UP)
        return None

    @property
    def effective_price_per_person(self):
        """Valor cobrado de cada participante (0 = circuito gratuito)."""
        if self.price_per_person is not None:
            return self.price_per_person
        if self.pricing_type == self.PRICING_SPLIT:
            return self.suggested_price_per_person or Decimal('0')
        return Decimal('0')

    @property
    def total_reserved(self):
        """Reservas ainda válidas (aguardando pagamento)."""
        now = timezone.now()
        return self.attendances.filter(is_reserved=True).filter(
            models.Q(reserved_until__isnull=True) | models.Q(reserved_until__gt=now) | models.Q(payment_claimed=True)
        ).count()

    @property
    def occupied_spots(self):
        """Vagas ocupadas: confirmados + reservas válidas."""
        return self.total_present + self.total_reserved

    @property
    def total_players(self):
        if hasattr(self, '_prefetched_objects_cache') and 'attendances' in self._prefetched_objects_cache:
            return len(self.attendances.all())
        return self.attendances.count()


class Attendance(models.Model):
    gameday = models.ForeignKey(
        GameDay, on_delete=models.CASCADE,
        related_name='attendances', verbose_name='Dia de jogo'
    )
    player = models.ForeignKey(
        'players.Player', on_delete=models.CASCADE,
        related_name='attendances', verbose_name='Jogador'
    )
    present = models.BooleanField(default=False, verbose_name='Presente', db_index=True)
    has_paid = models.BooleanField(default=False, verbose_name='Pagou')
    payment_claimed = models.BooleanField(default=False, verbose_name='Avisou que pagou', help_text='O atleta clicou no botão informando que já realizou o PIX.')
    credits_used = models.DecimalField(max_digits=4, decimal_places=1, default=0.0, verbose_name='Créditos Utilizados')
    used_priority = models.BooleanField(default=False, verbose_name='Usou Prioridade')
    checked_at = models.DateTimeField(auto_now=True, verbose_name='Hora do check-in')
    
    # Controle de Faltas (No-shows)
    was_no_show = models.BooleanField(
        default=False, 
        verbose_name='Faltou',
        help_text='Marcado automaticamente quando o circuito fecha e não há check-in na quadra.'
    )
    is_justified = models.BooleanField(default=False, verbose_name="Falta Justificada?")
    justification_text = models.TextField(blank=True, null=True, verbose_name="Justificativa")
    
    # Integração com Assinaturas
    used_credit = models.BooleanField(default=False, verbose_name="Usou Crédito do Plano?")

    # Fila de Espera
    is_waitlist = models.BooleanField(default=False, verbose_name='Na Fila de Espera', db_index=True)
    waitlist_joined_at = models.DateTimeField(null=True, blank=True, verbose_name='Entrou na Fila em')
    is_priority = models.BooleanField(default=False, verbose_name='VIP - Fura Fila')

    # Reserva aguardando pagamento (circuitos com requires_prepayment)
    is_reserved = models.BooleanField(default=False, verbose_name='Reservado (aguardando pagamento)', db_index=True)
    reserved_until = models.DateTimeField(null=True, blank=True, verbose_name='Reserva válida até')
    amount_due = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, verbose_name='Valor devido')

    class Meta:
        verbose_name = 'Presença'
        verbose_name_plural = 'Presenças'
        unique_together = ('gameday', 'player')

    def __str__(self):
        status = 'Presente' if self.present else 'Ausente'
        return f'{self.player} — {self.gameday.date}: {status}'


class CourtCheckin(models.Model):
    gameday = models.ForeignKey(
        GameDay, on_delete=models.CASCADE,
        related_name='court_checkins', verbose_name='Dia de jogo'
    )
    player = models.ForeignKey(
        'players.Player', on_delete=models.CASCADE,
        related_name='court_checkins', verbose_name='Jogador'
    )
    arrived_at = models.DateTimeField(auto_now_add=True, verbose_name='Hora de chegada na quadra')

    class Meta:
        verbose_name = 'Tiragem de Falta (Quadra)'
        verbose_name_plural = 'Tiragens de Falta (Quadra)'
        unique_together = ('gameday', 'player')

    def __str__(self):
        return f'{self.player.name} chegou em {self.gameday.date}'


class AttendancePayment(models.Model):
    """Registro de cada pagamento de participação em circuito."""

    METHOD_PIX_MANUAL = 'pix_manual'
    METHOD_PIX_ASAAS = 'pix_asaas'
    METHOD_CASH = 'cash'
    METHOD_EXEMPT = 'exempt'
    METHOD_LEGACY = 'legacy'
    METHOD_CHOICES = [
        (METHOD_PIX_MANUAL, 'PIX (chave do grupo)'),
        (METHOD_PIX_ASAAS, 'PIX automático'),
        (METHOD_CASH, 'Dinheiro'),
        (METHOD_EXEMPT, 'Isento'),
        (METHOD_LEGACY, 'Legado (antes do controle financeiro)'),
    ]
    MANUAL_METHODS = (METHOD_PIX_MANUAL, METHOD_CASH, METHOD_EXEMPT)

    STATUS_PENDING = 'pending'
    STATUS_PAID = 'paid'
    STATUS_CANCELED = 'canceled'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pendente'),
        (STATUS_PAID, 'Pago'),
        (STATUS_CANCELED, 'Cancelado'),
    ]

    attendance = models.ForeignKey(Attendance, on_delete=models.CASCADE, related_name='payments', verbose_name='Presença')
    amount = models.DecimalField(max_digits=8, decimal_places=2, verbose_name='Valor')
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, verbose_name='Forma de pagamento')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True, verbose_name='Status')
    asaas_payment_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name='Pago em')
    confirmed_by = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='confirmed_attendance_payments', verbose_name='Confirmado por'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Pagamento de Circuito'
        verbose_name_plural = 'Pagamentos de Circuitos'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.attendance.player} — R$ {self.amount} ({self.get_status_display()})'
