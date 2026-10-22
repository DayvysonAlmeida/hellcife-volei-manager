"""Web Push: leva as notificações para os celulares inscritos, mesmo com o app fechado."""
import json
import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

import requests
from django.conf import settings
from py_vapid import Vapid
from pywebpush import WebPushException, webpush

from .models import PushSubscription

logger = logging.getLogger(__name__)

# O endpoint vem do navegador e o servidor faz POST nele: só os serviços de push de verdade são aceitos
PUSH_SERVICE_DOMAINS = (
    'fcm.googleapis.com',         # Chrome, Samsung Internet, Opera
    'push.services.mozilla.com',  # Firefox
    'push.apple.com',             # Safari e iPhone
    'notify.windows.com',         # Edge
)

MAX_SUBSCRIPTIONS_PER_USER = 10
MAX_WORKERS = 8                 # envios ao mesmo tempo
TIMEOUT = 5                     # segundos por envio
TTL = 24 * 60 * 60              # o serviço guarda o aviso por até 1 dia se o celular estiver desligado
MAX_TITLE = 100
MAX_BODY = 300                  # o push aceita ~4KB; o texto completo fica na tela de notificações


def push_enabled():
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY and settings.VAPID_CLAIM_EMAIL)


def is_allowed_endpoint(endpoint):
    try:
        url = urlsplit(endpoint)
        host = url.hostname or ''
        port = url.port
    except ValueError:
        return False
    if url.scheme != 'https' or url.username or url.password or port not in (None, 443):
        return False
    return any(host == domain or host.endswith('.' + domain) for domain in PUSH_SERVICE_DOMAINS)


def _vapid_subject():
    email = settings.VAPID_CLAIM_EMAIL
    return email if email.startswith(('mailto:', 'https://')) else f'mailto:{email}'


def _payload(notification, user):
    return json.dumps({
        'id': notification.id,
        'title': notification.title[:MAX_TITLE],
        'body': notification.message[:MAX_BODY],
        'type': notification.type,
        'url': '/athlete/notifications' if user.profile == 'player' else '/notifications',
    }, ensure_ascii=False)


def _send(session, vapid, subscription, payload):
    """Envia um push. Devolve o id da inscrição quando o aparelho não existe mais."""
    try:
        webpush(
            subscription_info={
                'endpoint': subscription.endpoint,
                'keys': {'p256dh': subscription.p256dh, 'auth': subscription.auth},
            },
            data=payload,
            vapid_private_key=vapid,
            # Um dict novo a cada envio: o webpush grava nele o "aud" do serviço de push do aparelho
            vapid_claims={'sub': _vapid_subject()},
            ttl=TTL,
            timeout=TIMEOUT,
            headers={'Urgency': 'high'},
            requests_session=session,
        )
    except WebPushException as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status in (404, 410):
            return subscription.id
        logger.warning('Push recusado (HTTP %s) para a inscrição %s', status, subscription.id)
    except requests.RequestException as exc:
        logger.warning('Push sem resposta para a inscrição %s: %s', subscription.id, exc)
    except Exception:
        logger.exception('Erro ao enviar o push para a inscrição %s', subscription.id)
    return None


def send_push(notifications):
    """Manda cada notificação para os aparelhos do seu usuário. Nunca levanta erro para quem chamou."""
    try:
        by_user = defaultdict(list)
        for notification in notifications:
            by_user[notification.user_id].append(notification)

        subscriptions = PushSubscription.objects.filter(user_id__in=list(by_user)).select_related('user')
        jobs = [
            (subscription, _payload(notification, subscription.user))
            for subscription in subscriptions
            for notification in by_user[subscription.user_id]
        ]
        if not jobs:
            return

        vapid = Vapid.from_string(settings.VAPID_PRIVATE_KEY)
        # Os envios rodam em paralelo e reaproveitam a conexão com cada serviço de push
        with requests.Session() as session:
            session.mount('https://', requests.adapters.HTTPAdapter(pool_maxsize=MAX_WORKERS))
            with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(jobs))) as pool:
                gone = {sub_id for sub_id in pool.map(lambda job: _send(session, vapid, *job), jobs) if sub_id}

        if gone:
            PushSubscription.objects.filter(id__in=gone).delete()
    except Exception:
        logger.exception('Erro ao enviar o push das notificações')
