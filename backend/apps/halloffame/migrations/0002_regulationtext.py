from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('halloffame', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='RegulationText',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(default='Regulamento Oficial', max_length=200, verbose_name='Título')),
                ('content', models.TextField(verbose_name='Conteúdo HTML')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Última atualização')),
                ('updated_by', models.ForeignKey(null=True, on_delete=models.SET_NULL, to='core.user', verbose_name='Atualizado por')),
            ],
            options={
                'verbose_name': 'Texto do Regulamento',
                'verbose_name_plural': 'Textos do Regulamento',
                'ordering': ['-updated_at'],
            },
        ),
    ]