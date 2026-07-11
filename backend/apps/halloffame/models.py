from django.db import models


class HallOfFameEntry(models.Model):
    CATEGORY_CHOICES = [
        ('best_attacker', 'Melhor Atacante'),
        ('best_defender', 'Melhor Defensor'),
        ('best_server', 'Melhor Sacador'),
        ('best_setter', 'Melhor Levantador'),
        ('best_libero', 'Melhor Líbero'),
        ('revelation', 'Revelação'),
        ('most_present', 'Mais Presente'),
        ('mvp', 'MVP da Temporada'),
        ('best_blocker', 'Melhor Blocador'),
        ('best_opposite', 'Melhor Oposto'),
    ]

    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, verbose_name='Categoria')
    player = models.ForeignKey(
        'players.Player', on_delete=models.CASCADE,
        related_name='hall_of_fame_entries', verbose_name='Jogador'
    )
    year = models.PositiveSmallIntegerField(verbose_name='Ano')
    description = models.TextField(blank=True, null=True, verbose_name='Descrição')
    awarded_by = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True,
        verbose_name='Premiado por'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Entrada no Hall da Fama'
        verbose_name_plural = 'Entradas no Hall da Fama'
        ordering = ['-year', 'category']
        unique_together = ('category', 'year')  # Uma categoria por ano

    def __str__(self):
        return f'{self.get_category_display()} {self.year}: {self.player}'
