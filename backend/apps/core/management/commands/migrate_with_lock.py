"""
Roda o migrate com uma trava no PostgreSQL.

No Cloud Run, vários containers podem subir ao mesmo tempo e todos rodam o migrate.
Sem a trava, dois deles tentam aplicar a mesma migration e um quebra (ex.: "column already exists").
Com a trava, o segundo espera o primeiro terminar e encontra tudo aplicado.
A trava é da sessão: se o container cair, o PostgreSQL a libera sozinho.
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection

MIGRATION_LOCK_ID = 727274  # número fixo e arbitrário que identifica esta trava


class Command(BaseCommand):
    help = 'Aplica as migrations com uma trava no PostgreSQL (seguro com vários containers subindo juntos).'

    def add_arguments(self, parser):
        # Aceita a mesma opção do migrate; nunca pergunta nada (roda sempre sem interação)
        parser.add_argument('--noinput', '--no-input', action='store_true', help='Compatível com o migrate.')

    def handle(self, *args, **options):
        if connection.vendor != 'postgresql':
            call_command('migrate', interactive=False)
            return

        with connection.cursor() as cursor:
            self.stdout.write('Aguardando a trava das migrations...')
            cursor.execute('SELECT pg_advisory_lock(%s)', [MIGRATION_LOCK_ID])
            try:
                call_command('migrate', interactive=False)
            finally:
                cursor.execute('SELECT pg_advisory_unlock(%s)', [MIGRATION_LOCK_ID])
