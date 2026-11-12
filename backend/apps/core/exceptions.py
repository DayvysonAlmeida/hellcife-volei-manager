import math

from rest_framework.exceptions import Throttled
from rest_framework.views import exception_handler as drf_exception_handler


def too_many_attempts(wait):
    """A mensagem do limite de tentativas, com a espera arredondada para cima em minutos."""
    minutes = max(1, math.ceil((wait or 60) / 60))
    return f'Muitas tentativas. Tente de novo em {minutes} minuto{"s" if minutes > 1 else ""}.'


def exception_handler(exc, context):
    """O padrão do DRF, com uma mensagem clara quando o limite de tentativas estoura (as telas mostram o "detail")."""
    response = drf_exception_handler(exc, context)
    if isinstance(exc, Throttled) and response is not None:
        response.data = {'detail': too_many_attempts(exc.wait)}
    return response
