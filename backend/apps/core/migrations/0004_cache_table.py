from django.core.management import call_command
from django.db import migrations


def create_cache_table(apps, schema_editor):
    # A tabela do cache (settings.CACHES) é a mesma do `manage.py createcachetable`; se já existir, nada muda.
    # Na migração ela sobe junto com o migrate_with_lock: dois containers não criam a tabela ao mesmo tempo.
    call_command('createcachetable', database=schema_editor.connection.alias)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_identity'),
    ]

    operations = [
        migrations.RunPython(create_cache_table, migrations.RunPython.noop),
    ]
