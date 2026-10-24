from django.core.cache import cache
from django.test import TestCase


class CacheIsolatedTestCase(TestCase):
    """
    Limpa o cache antes de cada teste. As contagens do limite de tentativas ficam no cache e, no SQLite,
    os ids se repetem entre testes: sem isso as contagens somariam de um teste para o outro.
    """

    def run(self, result=None):
        cache.clear()
        return super().run(result)
