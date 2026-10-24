from .seasons import season_request_cache


class SeasonRequestCacheMiddleware:
    """
    A temporada atual é consultada várias vezes no mesmo pedido (painel, rankings, Elo...).
    Guarda o resultado só durante o pedido: nada fica velho de um pedido para o outro.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = season_request_cache.set({})
        try:
            return self.get_response(request)
        finally:
            season_request_cache.reset(token)
