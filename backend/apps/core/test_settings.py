import os
import subprocess
import sys

from django.conf import settings
from django.core.cache import caches
from django.core.cache.backends.db import DatabaseCache
from django.test import SimpleTestCase, TestCase


class DebugDefaultTests(SimpleTestCase):
    """Sem a variável DEBUG: no Cloud Run (K_SERVICE) o debug fica desligado; fora dele, ligado."""

    def debug_with(self, **env):
        base = {k: v for k, v in os.environ.items() if k not in ('DEBUG', 'K_SERVICE')}
        code = (
            'import decouple; decouple.config = decouple.Config(decouple.RepositoryEmpty())\n'  # ignora um .env local
            'from django.conf import settings; print(settings.DEBUG)'
        )
        result = subprocess.run(
            [sys.executable, '-c', code], cwd=settings.BASE_DIR, capture_output=True, text=True,
            env={**base, 'DJANGO_SETTINGS_MODULE': 'config.settings', 'SECRET_KEY': 'chave-do-teste', **env},
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip().splitlines()[-1]

    def test_cloud_run_without_the_variable_is_off(self):
        self.assertEqual(self.debug_with(K_SERVICE='hellcife-volei-manager-brasil'), 'False')

    def test_outside_cloud_run_stays_on(self):
        self.assertEqual(self.debug_with(), 'True')

    def test_the_variable_still_wins(self):
        self.assertEqual(self.debug_with(K_SERVICE='hellcife-volei-manager-brasil', DEBUG='True'), 'True')
        self.assertEqual(self.debug_with(DEBUG='False'), 'False')


class SharedCacheTests(TestCase):
    """O cache fica no banco: o que uma instância do Cloud Run grava, as outras leem."""

    def test_another_instance_reads_what_one_wrote(self):
        self.assertIsInstance(caches['default'], DatabaseCache)
        caches['default'].set('tentativas-de-login', 3)
        other_instance = DatabaseCache(settings.CACHES['default']['LOCATION'], {})
        self.assertEqual(other_instance.get('tentativas-de-login'), 3)
