"""Criação de notificações: grava no banco e avisa os celulares inscritos no push."""
from functools import partial

from django.db import transaction

from .models import Notification
from .push import push_enabled, send_push


def athlete_audience():
    """
    Quem recebe os avisos coletivos de atleta (circuito aberto, rankings, temporada, aviso geral):
    logins de jogador e a staff que também joga (admin ou moderador com cadastro de atleta ativo).
    """
    from django.db.models import Q
    from apps.core.models import User
    return User.objects.filter(is_active=True).filter(Q(profile='player') | Q(player_profile__status='active'))


def notify(notifications, push=True):
    """
    Grava as notificações de uma vez e manda o push depois do commit.
    Use no lugar de Notification.objects.create/bulk_create (o bulk_create não dispara signal).
    push=False: só aparecem na lista do app, sem o celular apitar (avisos para muita gente que não é o envolvido).
    Um `push_action` (atributo comum, não salvo) vira o botão da notificação no Android.
    """
    notifications = list(notifications)
    if not notifications:
        return []
    created = Notification.objects.bulk_create(notifications)
    if push and push_enabled():
        # Depois do commit, para não avisar o celular de algo que voltou atrás. Ainda dentro da
        # requisição: o Cloud Run quase para a CPU depois da resposta, e o envio ficaria pela metade.
        transaction.on_commit(partial(send_push, created), robust=True)
    return created
