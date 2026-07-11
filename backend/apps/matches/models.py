from django.db import models


class Match(models.Model):
    MODALITY_CHOICES = [
        (2, 'Dupla (2x2)'),
        (3, 'Trio (3x3)'),
        (4, 'Quarteto (4x4)'),
        (5, 'Quinteto (5x5)'),
        (6, 'Sexteto (6x6)'),
    ]

    date = models.DateField(verbose_name='Data')
    location = models.CharField(max_length=200, blank=True, null=True, verbose_name='Local')
    modality = models.PositiveSmallIntegerField(choices=MODALITY_CHOICES, default=6, verbose_name='Modalidade')
    gameday = models.ForeignKey(
        'attendance.GameDay', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='matches', verbose_name='Dia de jogo'
    )
    team_generation = models.ForeignKey(
        'teams.TeamGeneration', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='matches', verbose_name='Geração de times'
    )
    notes = models.TextField(blank=True, null=True, verbose_name='Observações')
    created_by = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True,
        verbose_name='Registrado por'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Partida'
        verbose_name_plural = 'Partidas'
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f'Partida {self.get_modality_display()} — {self.date}'


class MatchTeam(models.Model):
    match = models.ForeignKey(
        Match, on_delete=models.CASCADE,
        related_name='match_teams', verbose_name='Partida'
    )
    team_name = models.CharField(max_length=50, verbose_name='Nome do time')
    color_hex = models.CharField(max_length=10, blank=True, verbose_name='Cor')
    score = models.PositiveSmallIntegerField(default=0, verbose_name='Pontos')
    winner = models.BooleanField(default=False, verbose_name='Vencedor')
    team = models.ForeignKey(
        'teams.Team', on_delete=models.SET_NULL, null=True, blank=True,
        verbose_name='Time (referência)'
    )

    class Meta:
        verbose_name = 'Time na partida'
        verbose_name_plural = 'Times na partida'

    def __str__(self):
        return f'{self.team_name}: {self.score}'


class MatchPlayer(models.Model):
    match = models.ForeignKey(
        Match, on_delete=models.CASCADE,
        related_name='match_players', verbose_name='Partida'
    )
    player = models.ForeignKey(
        'players.Player', on_delete=models.CASCADE,
        related_name='match_appearances', verbose_name='Jogador'
    )
    match_team = models.ForeignKey(
        MatchTeam, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='match_players', verbose_name='Time na partida'
    )
    # Para cálculo de stats via MatchTeam.winner
    mvp = models.BooleanField(default=False, verbose_name='MVP da partida')

    class Meta:
        verbose_name = 'Jogador na partida'
        verbose_name_plural = 'Jogadores na partida'
        unique_together = ('match', 'player')

    def __str__(self):
        return f'{self.player} — {self.match}'
