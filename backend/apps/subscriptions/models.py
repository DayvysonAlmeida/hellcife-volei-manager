from django.db import models
from django.utils import timezone

class AsaasCustomer(models.Model):
    player = models.OneToOneField('players.Player', on_delete=models.CASCADE, related_name='asaas_customer')
    customer_id = models.CharField(max_length=100, unique=True)
    cpf = models.CharField(max_length=14, blank=True, null=True)

    class Meta:
        verbose_name = 'Cliente Asaas'
        verbose_name_plural = 'Clientes Asaas'

    def __str__(self):
        return f'{self.player} - {self.customer_id}'

class Plan(models.Model):
    name = models.CharField(max_length=50, verbose_name='Nome do Plano')
    description = models.TextField(blank=True, null=True, verbose_name='Descrição')
    price = models.DecimalField(max_digits=6, decimal_places=2, verbose_name='Preço Mensal')
    credits = models.PositiveSmallIntegerField(default=0, verbose_name='Créditos Mensais')
    priorities = models.PositiveSmallIntegerField(default=0, verbose_name='Prioridades Mensais')
    has_unlimited_priority = models.BooleanField(default=False, verbose_name='Prioridade Ilimitada')
    free_guests = models.PositiveSmallIntegerField(default=0, verbose_name='Convidados Gratuitos por Mês')
    paid_guests_allowed = models.PositiveSmallIntegerField(default=0, verbose_name='Convidados Pagos Permitidos')
    paid_guest_price = models.DecimalField(max_digits=6, decimal_places=2, default=5.00, verbose_name='Preço do Convidado')
    asaas_plan_id = models.CharField(max_length=100, blank=True, null=True, verbose_name='ID do Plano no Asaas')
    is_active = models.BooleanField(default=True, verbose_name='Plano Ativo')
    
    class Meta:
        verbose_name = 'Plano'
        verbose_name_plural = 'Planos'

    def __str__(self):
        return self.name

class UserSubscription(models.Model):
    STATUS_CHOICES = [
        ('active', 'Ativo'),
        ('past_due', 'Atrasado'),
        ('canceled', 'Cancelado'),
        ('PENDING_PAYMENT', 'Pendente de Pagamento'),
    ]
    player = models.OneToOneField('players.Player', on_delete=models.CASCADE, related_name='subscription')
    plan = models.ForeignKey(Plan, on_delete=models.RESTRICT)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    start_date = models.DateField(default=timezone.now)
    next_billing_date = models.DateField()
    asaas_subscription_id = models.CharField(max_length=100, blank=True, null=True)
    payment_url = models.URLField(max_length=500, blank=True, null=True)
    pix_copy_paste = models.TextField(blank=True, null=True)
    
    class Meta:
        verbose_name = 'Assinatura do Usuário'
        verbose_name_plural = 'Assinaturas dos Usuários'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._original_status = self.status

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        # Se mudou para 'active' (ou é novo) e não tem ciclo ativo, gera o ciclo e deposita os créditos
        if self.status == 'active' and (is_new or self._original_status != 'active'):
            from apps.subscriptions.services import SubscriptionService
            today = timezone.localdate()
            current_cycle = self.cycles.filter(is_active=True, start_date__lte=today, end_date__gte=today).first()
            if not current_cycle:
                SubscriptionService.renew_cycle(self)
                
        self._original_status = self.status

    def __str__(self):
        return f'{self.player} - {self.plan.name}'

class SubscriptionCycle(models.Model):
    subscription = models.ForeignKey(UserSubscription, on_delete=models.CASCADE, related_name='cycles')
    start_date = models.DateField()
    end_date = models.DateField()
    credits_balance = models.DecimalField(max_digits=5, decimal_places=1, default=0.0)
    priorities_used = models.PositiveSmallIntegerField(default=0)
    free_guests_used = models.PositiveSmallIntegerField(default=0)
    paid_guests_used = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    # Pagamento do Asaas que gerou o ciclo; garante idempotência do webhook
    asaas_payment_id = models.CharField(max_length=100, unique=True, blank=True, null=True)
    
    class Meta:
        verbose_name = 'Ciclo de Assinatura'
        verbose_name_plural = 'Ciclos de Assinaturas'
        ordering = ['-start_date']

    def __str__(self):
        return f'Ciclo {self.start_date.strftime("%m/%Y")} - {self.subscription.player}'

class ExtraCreditPurchase(models.Model):
    player = models.ForeignKey('players.Player', on_delete=models.CASCADE, related_name='extra_credits')
    cycle = models.ForeignKey(SubscriptionCycle, on_delete=models.CASCADE, related_name='extra_credits', null=True, blank=True)
    credits_amount = models.DecimalField(max_digits=4, decimal_places=1)
    price_paid = models.DecimalField(max_digits=6, decimal_places=2)
    asaas_payment_id = models.CharField(max_length=100, blank=True, null=True)
    payment_url = models.URLField(max_length=500, blank=True, null=True)
    pix_copy_paste = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, default='PENDING', choices=[('PENDING', 'Pendente'), ('PAID', 'Pago')])
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Compra de Crédito Extra'
        verbose_name_plural = 'Compras de Créditos Extras'

class TemporaryGuest(models.Model):
    sponsor = models.ForeignKey('players.Player', on_delete=models.CASCADE, related_name='sponsored_guests', verbose_name='Titular Responsável')
    guest_player = models.OneToOneField('players.Player', on_delete=models.CASCADE, related_name='temporary_guest_profile', verbose_name='Perfil do Convidado')
    cycle_added = models.ForeignKey(SubscriptionCycle, on_delete=models.CASCADE)
    is_paid_guest = models.BooleanField(default=False)
    asaas_payment_id = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Convidado Temporário'
        verbose_name_plural = 'Convidados Temporários'
