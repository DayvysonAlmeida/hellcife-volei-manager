"""Criação de notificações: grava no banco e avisa os celulares inscritos no push."""
from functools import partial

from django.db import transaction

from .models import Notification
from .push import push_enabled, send_push


def notify(notifications):
    """
    Grava as notificações de uma vez e manda o push depois do commit.
    Use no lugar de Notification.objects.create/bulk_create (o bulk_create não dispara signal).
    """
    notifications = list(notifications)
    if not notifications:
        return []
    created = Notification.objects.bulk_create(notifications)
    if push_enabled():
        # Depois do commit, para não avisar o celular de algo que voltou atrás. Ainda dentro da
        # requisição: o Cloud Run quase para a CPU depois da resposta, e o envio ficaria pela metade.
        transaction.on_commit(partial(send_push, created), robust=True)
    return created
