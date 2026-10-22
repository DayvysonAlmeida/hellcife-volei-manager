from django.db import models


class Match(models.Model):
    MODALITY_CHOICES = [
        (2, 'Dupla (2x2)'),
        (3, 'Trio (3x3)'),
        (4, 'Quarteto (4x4)'),
        (5, 'Quinteto (5x5)'),
        (6, 'Sexteto (6x6)'),
    ]

    date = models.DateField(verbose_name='Data', db_index=True)
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
    # "quadra:jogo" da fila (ex.: "77:5"): o mesmo jogo salvo por dois celulares vira uma partida só
    bracket_key = models.CharField(
        max_length=40, unique=True, null=True, blank=True, verbose_name='Jogo da fila',
        help_text='Quadra e número do jogo na fila; evita salvar o mesmo jogo duas vezes.'
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
    mvp = models.BooleanField(default=False, verbose_name='MVP da partida', db_index=True)
    best_attacker = models.BooleanField(default=False, verbose_name='Melhor Ataque', db_index=True)
    best_server = models.BooleanField(default=False, verbose_name='Melhor Saque', db_index=True)
    best_defender = models.BooleanField(default=False, verbose_name='Melhor Defesa', db_index=True)
    best_setter = models.BooleanField(default=False, verbose_name='Melhor Levantador', db_index=True)
    best_libero = models.BooleanField(default=False, verbose_name='Melhor Líbero', db_index=True)
    best_blocker = models.BooleanField(default=False, verbose_name='Melhor Blocador', db_index=True)
    best_opposite = models.BooleanField(default=False, verbose_name='Melhor Oposto', db_index=True)
    is_borrowed = models.BooleanField(default=False, verbose_name='Emprestado')
    borrowed_from_team_name = models.CharField(max_length=50, blank=True, null=True, verbose_name='Emprestado do time')
    elo_delta = models.FloatField(
        null=True, blank=True, verbose_name='Elo ganho/perdido',
        help_text='Quanto o Elo da temporada mudou nesta partida (ex.: +18 ou -14).',
    )

    class Meta:
        verbose_name = 'Jogador na partida'
        verbose_name_plural = 'Jogadores na partida'
        unique_together = ('match', 'player')

    def __str__(self):
        return f'{self.player} — {self.match}'
