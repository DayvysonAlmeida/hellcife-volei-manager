"""
Boas-vindas de quem vira membro: convite para criar a senha, mensagem de boas-vindas (notificação, e-mail e o
texto pronto para a staff mandar no WhatsApp) e o "Comece por aqui" do primeiro acesso.
"""
import logging
from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from apps.notifications.models import Notification
from apps.notifications.services import notify
from .identity import canonical_phone

logger = logging.getLogger(__name__)

ONBOARDING_DAYS = 60  # o "Comece por aqui" aparece para quem ganhou acesso nos últimos 60 dias


def _frontend(path):
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def first_name(player):
    return (player.display_name or player.name or '').split(' ')[0]


def welcome_text(player, invited=False):
    """A mensagem de boas-vindas (a mesma no WhatsApp e no e-mail)."""
    how_to_enter = (
        'Use o convite que chegou no seu e-mail para criar sua senha.' if invited
        else 'Entre com o seu e-mail e senha.' if player.user_id
        else 'Peça à organização o seu acesso ao app.'
    )
    return (
        f'Fala, {first_name(player)}! 🏐🔥 Seja bem-vindo(a) ao Hellcife Vôlei, agora como membro!\n'
        f'Pelo app você confirma presença nos circuitos, acompanha seus jogos, o Elo e as estrelas.\n'
        f'👉 {_frontend("/login")}\n'
        f'{how_to_enter}\n'
        f'Ative as notificações para não perder nenhum circuito. Te vemos na quadra!'
    )


def whatsapp_url(player, text):
    """Abre o WhatsApp da staff com a mensagem pronta para o número do atleta (vazio se não tem WhatsApp)."""
    phone = canonical_phone(player.phone)
    if len(phone) < 10:
        return ''
    return f'https://wa.me/55{phone}?text={quote(text)}'


def invite_link(user):
    """Link para criar a senha (o mesmo mecanismo do "Esqueci a senha"; vale 3 dias)."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return _frontend(f'/reset-password?uid={uid}&token={token}&convite=1')


def _send(user, subject, message):
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
    except Exception as exc:
        logger.warning('Falha ao enviar e-mail de boas-vindas (usuário %s): %s', user.pk, exc)


def send_welcome(player, invited=False):
    """Notificação e e-mail de boas-vindas; com convite, o e-mail traz o link para criar a senha."""
    user = player.user
    if not user:
        return
    notify([Notification(
        user=user, title='Bem-vindo(a) ao Hellcife Vôlei! 🏐', type='system', url='/athlete',
        message='Agora você é membro! Veja o "Comece por aqui" no Início: complete seus dados, ative as notificações e confirme presença no próximo circuito.',
    )])
    steps = (
        'Para começar:\n'
        '1. Complete seus dados (CPF e WhatsApp) em Meu perfil.\n'
        '2. Ative as notificações no celular.\n'
        '3. Leia o regulamento.\n'
        '4. Confirme presença no próximo circuito.'
    )
    if invited:
        message = (
            f'{welcome_text(player, invited=True)}\n\n'
            f'Crie sua senha por aqui (o link vale 3 dias):\n{invite_link(user)}\n\n'
            f'Se o link vencer, use "Esqueci minha senha" na tela de login com este e-mail.\n\n{steps}'
        )
    else:
        message = f'{welcome_text(player)}\n\n{steps}'
    _send(user, 'Bem-vindo(a) ao Hellcife Vôlei! 🏐', message)


def onboarding(player):
    """
    "Comece por aqui": os 4 primeiros passos do membro novo. None quando não deve aparecer
    (convidado, sem conta, dispensado, acesso antigo ou tudo feito).
    """
    user = player.user
    if player.is_guest or not user or player.onboarding_dismissed_at:
        return None
    if user.date_joined < timezone.now() - timedelta(days=ONBOARDING_DAYS):
        return None
    steps = {
        'complete_data': bool(player.cpf_hash and player.phone),
        'notifications': user.push_subscriptions.exists(),
        'regulation': bool(player.regulation_seen_at),
        'first_checkin': player.attendances.filter(present=True).exists(),
    }
    return None if all(steps.values()) else steps
