from unittest import mock

from django.db.utils import OperationalError
from django.test import TestCase

URL = '/api/health/'


class HealthTests(TestCase):
    """/api/health/: sem login, leve por padrão e com ?db=1 para conferir o banco."""

    def test_ok_without_login_and_without_touching_the_database(self):
        with self.assertNumQueries(0):
            response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')
        self.assertNotIn('database', response.json())

    def test_invalid_token_does_not_matter(self):
        self.assertEqual(self.client.get(URL, HTTP_AUTHORIZATION='Bearer token-invalido').status_code, 200)

    def test_monitors_can_send_head(self):
        self.assertEqual(self.client.head(URL).status_code, 200)

    def test_only_reads(self):
        self.assertEqual(self.client.post(URL).status_code, 405)

    @mock.patch.dict('os.environ', {'K_REVISION': 'hellcife-volei-manager-brasil-00042-abc'})
    def test_shows_the_cloud_run_revision(self):
        self.assertEqual(self.client.get(URL).json()['revision'], 'hellcife-volei-manager-brasil-00042-abc')

    def test_never_cached(self):
        self.assertIn('no-store', self.client.get(URL)['Cache-Control'])

    def test_db_check(self):
        with self.assertNumQueries(1):
            response = self.client.get(URL, {'db': '1'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['database'], 'ok')

    def test_db_down_is_503_without_details(self):
        with mock.patch('apps.core.health.connection') as conn, self.assertLogs('apps.core.health', 'ERROR'):
            conn.cursor.side_effect = OperationalError('senha errada para o usuário neondb_owner')
            response = self.client.get(URL, {'db': '1'})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {'status': 'erro', 'revision': '', 'database': 'indisponível'})
        self.assertNotIn('neondb_owner', response.content.decode())
