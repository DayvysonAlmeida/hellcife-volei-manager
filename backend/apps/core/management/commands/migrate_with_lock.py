"""
Roda o migrate com uma trava no PostgreSQL.

No Cloud Run, vários containers podem subir ao mesmo tempo e todos rodam o migrate.
Sem a trava, dois deles tentam aplicar a mesma migration e um quebra (ex.: "column already exists").
Com a trava, o segundo espera o primeiro terminar e encontra tudo aplicado.

Cuidados que vieram do incidente de 11/11/2026 (instâncias paradas em "Aguardando a trava", ninguém logava):
- Sem migration pendente, que é o caso de quase toda inicialização, o comando só confere e sai, sem trava.
- A trava (pg_advisory_lock) pertence à sessão do PostgreSQL, e o pooler do Neon (PgBouncer em modo transação)
  troca a sessão do servidor a cada comando. Pegar e soltar a trava pelo pooler podia cair em sessões diferentes,
  e ela ficava presa numa sessão que ninguém controlava. Por isso a trava e o migrate usam a conexão direta do
  Neon (o mesmo host sem "-pooler"). Nela, se o container cair, a sessão fecha e o PostgreSQL solta a trava.
- A espera tem limite, abaixo dos 240 s da sonda de inicialização do Cloud Run: se a trava não vier, o comando
  falha com uma mensagem clara, em vez de o container ficar parado até ser morto sem explicação.
"""
import time
from contextlib import contextmanager

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

MIGRATION_LOCK_ID = 727274  # número fixo e arbitrário que identifica esta trava
LOCK_TIMEOUT_SECONDS = 120  # sobra tempo para o migrate e o gunicorn antes dos 240 s da sonda do Cloud Run
LOCK_POLL_SECONDS = 2


def pending_migrations():
    """As migrations que o migrate aplicaria agora (lista vazia quando o banco está em dia)."""
    executor = MigrationExecutor(connection)
    return executor.migration_plan(executor.loader.graph.leaf_nodes())


def direct_host(host):
    """O host direto do Neon: o mesmo endereço sem "-pooler". Outros hosts (localhost, Docker) ficam como estão."""
    if host and '-pooler.' in host:
        return host.replace('-pooler.', '.', 1)
    return host


@contextmanager
def direct_connection():
    """Dentro do bloco, a conexão padrão vai direto ao Neon, sem o pooler; ao sair, volta ao endereço original."""
    original = connection.settings_dict.get('HOST') or ''
    direct = direct_host(original)
    if direct == original:
        yield
        return
    connection.close()  # a próxima consulta já reconecta no host direto
    connection.settings_dict['HOST'] = direct
    try:
        yield
    finally:
        connection.close()
        connection.settings_dict['HOST'] = original


def acquire_lock(cursor, timeout):
    """Tenta a trava até o prazo. Devolve quantos segundos esperou; se o prazo acabar, levanta CommandError."""
    started = time.monotonic()
    while True:
        cursor.execute('SELECT pg_try_advisory_lock(%s)', [MIGRATION_LOCK_ID])
        if cursor.fetchone()[0]:
            return time.monotonic() - started
        remaining = timeout - (time.monotonic() - started)
        if remaining <= 0:
            raise CommandError(
                f'A trava das migrations não veio em {timeout:g} s. Outra instância está aplicando migrations '
                f'ou a trava ficou presa: no SQL Editor do Neon, procure em pg_locks a trava {MIGRATION_LOCK_ID}.'
            )
        time.sleep(min(LOCK_POLL_SECONDS, remaining))


class Command(BaseCommand):
    help = 'Aplica as migrations com uma trava no PostgreSQL (seguro com vários containers subindo juntos).'

    def add_arguments(self, parser):
        # Aceita a mesma opção do migrate; nunca pergunta nada (roda sempre sem interação)
        parser.add_argument('--noinput', '--no-input', action='store_true', help='Compatível com o migrate.')
        parser.add_argument(
            '--lock-timeout', type=float, default=LOCK_TIMEOUT_SECONDS,
            help=f'Segundos de espera pela trava antes de desistir (padrão: {LOCK_TIMEOUT_SECONDS}).',
        )

    def handle(self, *args, **options):
        if connection.vendor != 'postgresql':
            call_command('migrate', interactive=False)
            return

        plan = pending_migrations()
        if not plan:
            self.stdout.write('Nenhuma migration pendente: seguindo sem a trava.')
            return

        timeout = options['lock_timeout']
        self.stdout.write(f'{len(plan)} migration(s) pendente(s).')
        with direct_connection(), connection.cursor() as cursor:
            self.stdout.write(f'Aguardando a trava das migrations (até {timeout:g} s)...')
            waited = acquire_lock(cursor, timeout)
            self.stdout.write(f'Trava obtida em {waited:.1f} s.')
            try:
                call_command('migrate', interactive=False)
            finally:
                cursor.execute('SELECT pg_advisory_unlock(%s)', [MIGRATION_LOCK_ID])
