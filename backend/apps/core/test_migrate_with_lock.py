from io import StringIO
from unittest import mock, skipUnless

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection, connections
from django.test import SimpleTestCase, TestCase
from django.test.utils import CaptureQueriesContext

from apps.core.management.commands import migrate_with_lock

MODULE = 'apps.core.management.commands.migrate_with_lock'
POOLER = 'ep-calm-sun-123456-pooler.sa-east-1.aws.neon.tech'
DIRECT = 'ep-calm-sun-123456.sa-east-1.aws.neon.tech'
PENDING = [('migration pendente', False)]  # o plano do migrate é uma lista de (migration, de trás para frente)
HELD_LOCKS = (
    "SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND objid = %s AND granted "
    "AND database = (SELECT oid FROM pg_database WHERE datname = current_database())"
)


def run(**options):
    out = StringIO()
    call_command('migrate_with_lock', stdout=out, **options)
    return out.getvalue()


class WithoutDatabaseTests(SimpleTestCase):
    """O pooler do Neon não guarda a trava da sessão: com migration pendente, a trava e o migrate vão pelo host direto."""

    def test_removes_the_pooler_from_the_neon_host(self):
        self.assertEqual(migrate_with_lock.direct_host(POOLER), DIRECT)

    def test_other_hosts_stay_the_same(self):
        for host in [DIRECT, 'localhost', 'db', '']:
            with self.subTest(host=host):
                self.assertEqual(migrate_with_lock.direct_host(host), host)

    def test_switches_the_host_only_inside_the_block_even_on_error(self):
        fake = mock.Mock(settings_dict={'HOST': POOLER})
        with mock.patch(f'{MODULE}.connection', fake):
            with self.assertRaises(RuntimeError), migrate_with_lock.direct_connection():
                self.assertEqual(fake.settings_dict['HOST'], DIRECT)
                self.assertEqual(fake.close.call_count, 1)  # fechou antes de trocar: reconecta já no host direto
                raise RuntimeError
        self.assertEqual(fake.settings_dict['HOST'], POOLER)
        self.assertEqual(fake.close.call_count, 2)

    def test_migrate_runs_on_the_direct_host(self):
        fake = mock.MagicMock(vendor='postgresql', settings_dict={'HOST': POOLER})
        fake.cursor.return_value.__enter__.return_value.fetchone.return_value = (True,)  # trava livre
        hosts = []
        with mock.patch(f'{MODULE}.connection', fake), \
                mock.patch(f'{MODULE}.pending_migrations', return_value=PENDING), \
                mock.patch(f'{MODULE}.call_command', side_effect=lambda *a, **k: hosts.append(fake.settings_dict['HOST'])):
            run()
        self.assertEqual(hosts, [DIRECT])
        self.assertEqual(fake.settings_dict['HOST'], POOLER)

    def test_other_databases_just_migrate(self):
        with mock.patch(f'{MODULE}.connection', mock.Mock(vendor='sqlite')), \
                mock.patch(f'{MODULE}.call_command') as migrate:
            run()
        migrate.assert_called_once_with('migrate', interactive=False)


@skipUnless(connection.vendor == 'postgresql', 'a trava só existe no PostgreSQL')
class PostgresLockTests(TestCase):
    def held_locks(self):
        with connection.cursor() as cursor:
            cursor.execute(HELD_LOCKS, [migrate_with_lock.MIGRATION_LOCK_ID])
            return cursor.fetchone()[0]

    def test_nothing_pending_skips_the_lock_and_the_migrate(self):
        # O banco de teste já está com todas as migrations: é o caso de quase toda inicialização no Cloud Run
        with CaptureQueriesContext(connection) as queries, mock.patch(f'{MODULE}.call_command') as migrate:
            out = run()
        migrate.assert_not_called()
        self.assertIn('Nenhuma migration pendente', out)
        self.assertEqual([q['sql'] for q in queries if 'advisory' in q['sql']], [])

    def test_pending_migrates_holding_the_lock_and_releases_it(self):
        during = []
        with mock.patch(f'{MODULE}.pending_migrations', return_value=PENDING), \
                mock.patch(f'{MODULE}.call_command', side_effect=lambda *a, **k: during.append(self.held_locks())) as migrate:
            run()
        migrate.assert_called_once_with('migrate', interactive=False)
        self.assertEqual(during, [1])
        self.assertEqual(self.held_locks(), 0)

    def test_gives_up_when_another_instance_holds_the_lock(self):
        other = connections.create_connection('default')  # outra sessão, como outra instância subindo junto
        try:
            with other.cursor() as cursor:
                cursor.execute('SELECT pg_advisory_lock(%s)', [migrate_with_lock.MIGRATION_LOCK_ID])
            with mock.patch(f'{MODULE}.pending_migrations', return_value=PENDING), \
                    mock.patch(f'{MODULE}.call_command') as migrate, \
                    mock.patch(f'{MODULE}.LOCK_POLL_SECONDS', 0.05), \
                    self.assertRaisesMessage(CommandError, 'não veio em 0.3 s'):
                run(lock_timeout=0.3)
            migrate.assert_not_called()
        finally:
            other.close()
