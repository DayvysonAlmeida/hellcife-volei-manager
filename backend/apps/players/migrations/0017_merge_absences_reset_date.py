from django.db import migrations


class Migration(migrations.Migration):
    """Une o ramo da main (0014_player_absences_reset_date, já aplicada em produção) ao ramo da v2.0."""

    dependencies = [
        ('players', '0014_player_absences_reset_date'),
        ('players', '0016_player_standalone_credits'),
    ]

    operations = []
