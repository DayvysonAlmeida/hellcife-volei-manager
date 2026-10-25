"""
Uma pessoa, um cadastro: CPF, e-mail e WhatsApp normalizados para achar repetidos.

O CPF nunca fica aberto no banco (LGPD): guardamos uma impressão digital (HMAC-SHA256 com a chave secreta
CPF_PEPPER) para checar repetição e só os 2 últimos dígitos para mostrar (***.***.***-12).
A chave não pode mudar depois de ter CPFs gravados: com outra chave, os repetidos deixam de ser reconhecidos.
"""
import hashlib
import hmac
import re
import unicodedata

from django.conf import settings

DEV_PEPPER = 'desenvolvimento-sem-cpf-pepper'
GMAIL_DOMAINS = ('gmail.com', 'googlemail.com')


class CpfUnavailable(Exception):
    """Produção sem CPF_PEPPER: melhor recusar o CPF do que gravar com a chave errada."""


def only_digits(value):
    return re.sub(r'\D', '', str(value or ''))


def valid_cpf(value):
    """Os 11 dígitos do CPF quando os dígitos verificadores batem; None se não é um CPF válido."""
    digits = only_digits(value)
    if len(digits) != 11 or digits == digits[0] * 11:
        return None
    for size in (9, 10):
        total = sum(int(d) * (size + 1 - i) for i, d in enumerate(digits[:size]))
        check = (total * 10) % 11 % 10
        if check != int(digits[size]):
            return None
    return digits


def _pepper():
    pepper = getattr(settings, 'CPF_PEPPER', '')
    if pepper:
        return pepper
    if settings.DEBUG:
        return DEV_PEPPER
    raise CpfUnavailable


def cpf_fingerprint(digits):
    """Impressão digital do CPF (64 caracteres): serve para achar repetidos sem guardar o número."""
    return hmac.new(_pepper().encode(), digits.encode(), hashlib.sha256).hexdigest()


def masked_cpf(last2):
    return f'***.***.***-{last2}' if last2 else ''


def canonical_email(email):
    """Mesma caixa de entrada: sem maiúsculas, sem "+apelido" e, no Gmail, sem os pontos (n.ome+1@gmail = nome@gmail)."""
    email = (email or '').strip().lower()
    if '@' not in email:
        return email
    local, domain = email.rsplit('@', 1)
    local = local.split('+', 1)[0]
    if domain in GMAIL_DOMAINS:
        local, domain = local.replace('.', ''), 'gmail.com'
    return f'{local}@{domain}'


def canonical_phone(value):
    """Os 10 ou 11 dígitos do número com DDD (tira o 55 do Brasil quando vier junto)."""
    digits = only_digits(value)
    if len(digits) in (12, 13) and digits.startswith('55'):
        digits = digits[2:]
    return digits


def plain_name(value):
    """Nome para comparar: sem acento, sem maiúsculas e sem espaços sobrando."""
    text = unicodedata.normalize('NFKD', value or '')
    text = ''.join(c for c in text if not unicodedata.combining(c))
    return ' '.join(text.lower().split())


# ── Checagens no banco ──

CPF_TAKEN = 'Este CPF já tem cadastro. Se for você, entre com o seu e-mail ou fale com a organização.'
PHONE_TAKEN = 'Este WhatsApp já está em outro cadastro. Se for você, fale com a organização.'
CPF_UNAVAILABLE = 'O cadastro com CPF está temporariamente indisponível. Tente de novo mais tarde.'


def cpf_owner(digits, exclude_id=None):
    """Atleta que já tem este CPF (None se ninguém)."""
    from .models import Player
    qs = Player.objects.filter(cpf_hash=cpf_fingerprint(digits))
    return qs.exclude(pk=exclude_id).first() if exclude_id else qs.first()


def phone_owner(phone, exclude_id=None):
    """Atleta (não convidado) que já usa este WhatsApp, com o número escrito de qualquer jeito."""
    from .models import Player
    target = canonical_phone(phone)
    if len(target) < 10:
        return None
    candidates = Player.objects.filter(is_guest=False).exclude(phone__isnull=True).exclude(phone='')
    if exclude_id:
        candidates = candidates.exclude(pk=exclude_id)
    return next((p for p in candidates.only('id', 'name', 'phone') if canonical_phone(p.phone) == target), None)


def set_cpf(player, digits):
    player.cpf_hash = cpf_fingerprint(digits)
    player.cpf_last2 = digits[-2:]
