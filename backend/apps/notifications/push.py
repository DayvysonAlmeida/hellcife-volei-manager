"""Web Push: leva as notificações para os celulares inscritos, mesmo com o app fechado."""
import base64
import json
import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

import requests
from cryptography.hazmat.primitives import serialization
from django.conf import settings
from django.utils import timezone
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

OK, GONE = 'ok', 'gone'
# O que cada recusa do serviço de push quer dizer, para o diagnóstico na tela
REFUSALS = {
    400: 'Pedido recusado pelo serviço de push (400).',
    401: 'Chave VAPID recusada (401): confira as variáveis VAPID do servidor.',
    403: 'Chave VAPID recusada (403): a inscrição foi feita com outra chave. Reative as notificações neste aparelho.',
    413: 'Aviso grande demais (413).',
    429: 'Serviço de push pediu para esperar (429).',
}


def push_enabled():
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY and settings.VAPID_CLAIM_EMAIL)


def key_status():
    """
    'ok' quando as três variáveis VAPID existem e a chave privada corresponde à pública.
    'missing' (falta alguma) ou 'invalid' (a privada não abre ou não forma par com a pública): o push não funciona.
    """
    if not push_enabled():
        return 'missing'
    try:
        public = Vapid.from_string(settings.VAPID_PRIVATE_KEY).public_key.public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint,
        )
    except Exception:
        return 'invalid'
    derived = base64.urlsafe_b64encode(public).rstrip(b'=').decode()
    return 'ok' if derived == settings.VAPID_PUBLIC_KEY.rstrip('=') else 'invalid'


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


def device_label(user_agent):
    """'Android · Chrome', 'iPhone · Safari'... a partir do navegador que se inscreveu."""
    ua = user_agent or ''
    system = next((name for key, name in (
        ('iPhone', 'iPhone'), ('iPad', 'iPad'), ('Android', 'Android'), ('Windows', 'Windows'),
        ('Macintosh', 'Mac'), ('Linux', 'Linux'),
    ) if key in ua), 'Aparelho')
    browser = next((name for key, name in (
        ('SamsungBrowser', 'Samsung Internet'), ('Edg/', 'Edge'), ('OPR/', 'Opera'), ('Firefox', 'Firefox'),
        ('CriOS', 'Chrome'), ('Chrome', 'Chrome'), ('Safari', 'Safari'),
    ) if key in ua), 'navegador')
    return f'{system} · {browser}'


def _vapid_subject():
    email = settings.VAPID_CLAIM_EMAIL
    return email if email.startswith(('mailto:', 'https://')) else f'mailto:{email}'


def _home(user):
    return '/athlete/notifications' if user.profile == 'player' else '/notifications'


def _payload(notification, user):
    created = notification.created_at
    return json.dumps({
        'id': notification.id,
        'title': notification.title[:MAX_TITLE],
        'body': notification.message[:MAX_BODY],
        'type': notification.type,
        # A tela do assunto; sem link, a lista de notificações
        'url': notification.url or _home(user),
        'action': getattr(notification, 'push_action', None),
        'timestamp': int(created.timestamp() * 1000) if created else None,
    }, ensure_ascii=False)


def _send(session, vapid, subscription, payload):
    """Envia um push. Devolve OK, GONE (o aparelho não existe mais) ou a explicação do erro."""
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
        return OK
    except WebPushException as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status in (404, 410):
            return GONE
        logger.warning('Push recusado (HTTP %s) para a inscrição %s', status, subscription.id)
        return REFUSALS.get(status, f'Push recusado (HTTP {status}).')
    except requests.RequestException as exc:
        logger.warning('Push sem resposta para a inscrição %s: %s', subscription.id, exc)
        return 'O serviço de push não respondeu.'
    except Exception:
        logger.exception('Erro ao enviar o push para a inscrição %s', subscription.id)
        return 'Erro no servidor ao enviar.'


def _deliver(jobs):
    """
    Manda cada (inscrição, conteúdo) e guarda o resultado no aparelho: entregue, erro ou apagado (expirou).
    Devolve [(inscrição, resultado)].
    """
    if not jobs:
        return []
    vapid = Vapid.from_string(settings.VAPID_PRIVATE_KEY)
    # Os envios rodam em paralelo e reaproveitam a conexão com cada serviço de push
    with requests.Session() as session:
        session.mount('https://', requests.adapters.HTTPAdapter(pool_maxsize=MAX_WORKERS))
        with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(jobs))) as pool:
            results = list(pool.map(lambda job: (job[0], _send(session, vapid, *job)), jobs))

    by_result = defaultdict(set)
    for subscription, result in results:
        by_result[result].add(subscription.id)
    if by_result[OK]:
        # update() não mexe no updated_at: a ordem "aparelho usado por último" continua a da inscrição
        PushSubscription.objects.filter(id__in=by_result[OK]).update(last_success_at=timezone.now(), last_error='')
    if by_result[GONE]:
        PushSubscription.objects.filter(id__in=by_result[GONE]).delete()
    for result, ids in by_result.items():
        if result not in (OK, GONE):
            PushSubscription.objects.filter(id__in=ids).update(last_error=result[:200])
    failed = len(results) - len(by_result[OK]) - len(by_result[GONE])
    logger.info('Push: %s entregue(s), %s aparelho(s) expirado(s), %s falha(s)', len(by_result[OK]), len(by_result[GONE]), failed)
    return results


def send_push(notifications):
    """Manda cada notificação para os aparelhos do seu usuário. Nunca levanta erro para quem chamou."""
    try:
        by_user = defaultdict(list)
        for notification in notifications:
            by_user[notification.user_id].append(notification)

        subscriptions = PushSubscription.objects.filter(user_id__in=list(by_user)).select_related('user')
        _deliver([
            (subscription, _payload(notification, subscription.user))
            for subscription in subscriptions
            for notification in by_user[subscription.user_id]
        ])
    except Exception:
        logger.exception('Erro ao enviar o push das notificações')


def send_test_push(user):
    """Notificação de teste para todos os aparelhos do usuário; devolve o resultado de cada um."""
    payload = json.dumps({
        'title': 'Teste de notificação 🔔',
        'body': 'Chegou! Se apareceu com a tela bloqueada, as notificações estão funcionando neste aparelho.',
        'type': 'system',
        'url': _home(user),
        'test': True,
        'timestamp': int(timezone.now().timestamp() * 1000),
    }, ensure_ascii=False)
    results = _deliver([(subscription, payload) for subscription in user.push_subscriptions.all()])
    return [
        {
            'device': device_label(subscription.user_agent),
            'status': 'delivered' if result == OK else 'expired' if result == GONE else 'failed',
            'detail': '' if result in (OK, GONE) else result,
        } for subscription, result in results
    ]
