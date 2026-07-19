from django.db import models


class GameDay(models.Model):
    date = models.DateField(verbose_name='Data')
    time = models.TimeField(blank=True, null=True, verbose_name='Hora')
    description = models.CharField(max_length=200, blank=True, null=True, verbose_name='Descrição')
    location = models.CharField(max_length=200, blank=True, null=True, verbose_name='Local')
    max_players = models.PositiveSmallIntegerField(default=0, verbose_name='Limite de Jogadores')
    created_by = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True,
        verbose_name='Criado por'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Dia de jogo'
        verbose_name_plural = 'Dias de jogo'
        ordering = ['-date']

    def __str__(self):
        return f'Dia de jogo: {self.date}'

    @property
    def total_present(self):
        if hasattr(self, '_prefetched_objects_cache') and 'attendances' in self._prefetched_objects_cache:
            return sum(1 for a in self.attendances.all() if a.present)
        return self.attendances.filter(present=True).count()

    @property
    def total_players(self):
        if hasattr(self, '_prefetched_objects_cache') and 'attendances' in self._prefetched_objects_cache:
            return len(self.attendances.all())
        return self.attendances.count()


class Attendance(models.Model):
    gameday = models.ForeignKey(
        GameDay, on_delete=models.CASCADE,
        related_name='attendances', verbose_name='Dia de jogo'
    )
    player = models.ForeignKey(
        'players.Player', on_delete=models.CASCADE,
        related_name='attendances', verbose_name='Jogador'
    )
    present = models.BooleanField(default=False, verbose_name='Presente', db_index=True)
    has_paid = models.BooleanField(default=False, verbose_name='Pagou')
    checked_at = models.DateTimeField(auto_now=True, verbose_name='Hora do check-in')

    class Meta:
        verbose_name = 'Presença'
        verbose_name_plural = 'Presenças'
        unique_together = ('gameday', 'player')

    def __str__(self):
        status = 'Presente' if self.present else 'Ausente'
        return f'{self.player} — {self.gameday.date}: {status}'
