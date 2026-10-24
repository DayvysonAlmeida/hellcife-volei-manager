"""Aviso no deploy (migrate/check): as chaves do Web Push faltando ou sem formar par deixam os celulares sem notificação."""
from django.core.checks import Warning, register


@register()
def vapid_keys_check(app_configs, **kwargs):
    from .push import key_status
    status = key_status()
    if status == 'missing':
        return [Warning(
            'Push desligado: falta VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ou VAPID_CLAIM_EMAIL.',
            hint='Sem elas o app nem pergunta se o atleta quer notificações no celular.',
            id='notifications.W001',
        )]
    if status == 'invalid':
        return [Warning(
            'As chaves VAPID não formam par: a chave privada não abre ou não corresponde à pública.',
            hint='Gere as duas juntas (manage.py generate_vapid_keys) e atualize as duas no Cloud Run.',
            id='notifications.W002',
        )]
    return []
