import logging
import os

from django.db import connection
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_safe

logger = logging.getLogger(__name__)


@never_cache
@require_safe  # GET e HEAD: alguns monitores só mandam HEAD
def health(request):
    """
    Verificação de saúde para monitor externo e conferência de deploy, sem login.
    Por padrão não toca no banco: o Neon dorme sem uso e cobra pelo tempo acordado, e um monitor
    batendo a cada poucos minutos o manteria acordado. Com ?db=1 também faz um SELECT 1 no Postgres.
    """
    data = {'status': 'ok', 'revision': os.environ.get('K_REVISION', '')}  # versão do Cloud Run no ar
    if request.GET.get('db') == '1':
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
        except Exception:
            logger.exception('Verificação de saúde: o banco não respondeu')
            return _json({**data, 'status': 'erro', 'database': 'indisponível'}, status=503)
        data['database'] = 'ok'
    return _json(data)


def _json(data, status=200):
    return JsonResponse(data, status=status, json_dumps_params={'ensure_ascii': False})
