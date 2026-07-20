from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Adiciona índice composto em (player_id, date) na tabela Evaluation.
    As subqueries de overall mais recente filtram por player e ordenam por date,
    portanto esse índice composto acelera drasticamente essas consultas.
    """

    dependencies = [
        ('evaluations', '0004_performance_indexes'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='evaluation',
            index=models.Index(
                fields=['player', '-date'],
                name='evaluation_player_date_idx',
            ),
        ),
    ]
