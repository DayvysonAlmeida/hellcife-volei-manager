"""Aviso no deploy: sem CPF_PEPPER o cadastro com CPF fica indisponível (melhor do que cifrar com a chave errada)."""
from django.conf import settings
from django.core.checks import Warning, register


@register()
def cpf_pepper_check(app_configs, **kwargs):
    if settings.DEBUG or getattr(settings, 'CPF_PEPPER', ''):
        return []
    return [Warning(
        'CPF_PEPPER não definida: o cadastro de novos atletas (que pede CPF) vai ficar indisponível.',
        hint='Crie a variável CPF_PEPPER no Cloud Run com um valor aleatório e nunca troque depois.',
        id='players.W001',
    )]
