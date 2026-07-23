from django.db import models


class GameDay(models.Model):
    date = models.DateField(verbose_name='Data')
    time = models.TimeField(blank=True, null=True, verbose_name='Hora Inicial')
    time_end = models.TimeField(blank=True, null=True, verbose_name='Hora Final')
    court_price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, verbose_name='Valor da Quadra')
    description = models.CharField(max_length=200, blank=True, null=True, verbose_name='Descrição')
    location = models.CharField(max_length=200, blank=True, null=True, verbose_name='Local')
    max_players = models.PositiveSmallIntegerField(default=0, verbose_name='Limite de Jogadores')
    is_closed = models.BooleanField(default=False, verbose_name='Encerrado', help_text='Se verdadeiro, o circuito e todas as suas peladas estão encerrados')
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
    
    # Controle de Faltas (No-shows)
    was_no_show = models.BooleanField(
        default=False, 
        verbose_name='Faltou',
        help_text='Marcado automaticamente quando o circuito fecha e não há check-in na quadra.'
    )
    is_justified = models.BooleanField(default=False, verbose_name='Justificada')
    justification_text = models.CharField(max_length=255, blank=True, null=True, verbose_name='Motivo da Justificativa')

    class Meta:
        verbose_name = 'Presença'
        verbose_name_plural = 'Presenças'
        unique_together = ('gameday', 'player')

    def __str__(self):
        status = 'Presente' if self.present else 'Ausente'
        return f'{self.player} — {self.gameday.date}: {status}'


class CourtCheckin(models.Model):
    gameday = models.ForeignKey(
        GameDay, on_delete=models.CASCADE,
        related_name='court_checkins', verbose_name='Dia de jogo'
    )
    player = models.ForeignKey(
        'players.Player', on_delete=models.CASCADE,
        related_name='court_checkins', verbose_name='Jogador'
    )
    arrived_at = models.DateTimeField(auto_now_add=True, verbose_name='Hora de chegada na quadra')

    class Meta:
        verbose_name = 'Tiragem de Falta (Quadra)'
        verbose_name_plural = 'Tiragens de Falta (Quadra)'
        unique_together = ('gameday', 'player')

    def __str__(self):
        return f'{self.player.name} chegou em {self.gameday.date}'
