from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('system', 'Sistema'),
        ('prize', 'Prêmio'),
        ('circuit', 'Circuito'),
        ('alert', 'Alerta'),
        ('financial', 'Financeiro'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='notifications',
        verbose_name='Usuário'
    )
    title = models.CharField(max_length=200, verbose_name='Título')
    message = models.TextField(verbose_name='Mensagem')
    type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='system', verbose_name='Tipo')
    is_read = models.BooleanField(default=False, verbose_name='Lida')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criada em')

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notificação'
        verbose_name_plural = 'Notificações'

    def __str__(self):
        return f"{self.title} - {self.user.name}"

class PushSubscription(models.Model):
    """Aparelho inscrito no Web Push (um por navegador/celular do usuário)."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='push_subscriptions',
        verbose_name='Usuário'
    )
    # Endereço do serviço de push do navegador (Google, Apple, Mozilla ou Microsoft)
    endpoint = models.URLField(max_length=1000, unique=True, verbose_name='Endpoint')
    p256dh = models.CharField(max_length=200, verbose_name='Chave pública do aparelho')
    auth = models.CharField(max_length=100, verbose_name='Segredo de autenticação')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criada em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizada em')

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Inscrição de push'
        verbose_name_plural = 'Inscrições de push'

    def __str__(self):
        return f"{self.user.name} - {self.endpoint[:60]}"

class GlobalAnnouncement(models.Model):
    title = models.CharField(max_length=200, verbose_name='Título')
    message = models.TextField(verbose_name='Mensagem')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Aviso Global'
        verbose_name_plural = 'Avisos Globais'

    def __str__(self):
        return self.title

@receiver(post_save, sender=GlobalAnnouncement)
def send_global_announcement(sender, instance, created, **kwargs):
    if created:
        from apps.core.models import User
        from .services import notify
        users = User.objects.filter(profile='player', is_active=True)
        notify([
            Notification(
                user=u,
                title=instance.title,
                message=instance.message,
                type='system'
            ) for u in users
        ])
