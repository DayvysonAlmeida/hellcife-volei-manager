import math

from rest_framework.exceptions import Throttled
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """O padrão do DRF, com uma mensagem clara quando o limite de tentativas estoura (as telas mostram o "detail")."""
    response = drf_exception_handler(exc, context)
    if isinstance(exc, Throttled) and response is not None:
        minutes = max(1, math.ceil((exc.wait or 60) / 60))
        response.data = {'detail': f'Muitas tentativas. Tente de novo em {minutes} minuto{"s" if minutes > 1 else ""}.'}
    return response
