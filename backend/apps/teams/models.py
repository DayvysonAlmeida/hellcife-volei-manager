from django.db import models


class TeamGeneration(models.Model):
    MODALITY_CHOICES = [
        (2, 'Dupla (2x2)'),
        (3, 'Trio (3x3)'),
        (4, 'Quarteto (4x4)'),
        (5, 'Quinteto (5x5)'),
        (6, 'Sexteto (6x6)'),
    ]

    gameday = models.ForeignKey(
        'attendance.GameDay', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='team_generations', verbose_name='Dia de jogo'
    )
    modality = models.PositiveSmallIntegerField(choices=MODALITY_CHOICES, verbose_name='Modalidade')
    created_by = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True,
        verbose_name='Criado por'
    )
    notes = models.TextField(blank=True, null=True, verbose_name='Observações')
    balance_score = models.FloatField(default=0, verbose_name='Score de balanceamento')
    is_locked = models.BooleanField(default=False, verbose_name='Trancado (Finalizado)')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Geração de equipes'
        verbose_name_plural = 'Gerações de equipes'
        ordering = ['-created_at']

    def __str__(self):
        return f'Geração {self.get_modality_display()} — {self.created_at.date()}'


TEAM_COLORS = ['Vermelho', 'Azul', 'Verde', 'Amarelo', 'Roxo', 'Laranja', 'Rosa', 'Ciano']
TEAM_COLOR_HEX = ['#D90429', '#2563EB', '#16A34A', '#CA8A04', '#7C3AED', '#EA580C', '#DB2777', '#0891B2']


class Team(models.Model):
    generation = models.ForeignKey(
        TeamGeneration, on_delete=models.CASCADE,
        related_name='teams', verbose_name='Geração'
    )
    name = models.CharField(max_length=50, verbose_name='Nome do time')
    color = models.CharField(max_length=30, blank=True, verbose_name='Cor')
    color_hex = models.CharField(max_length=10, blank=True, verbose_name='Hex da cor')
    avg_overall = models.FloatField(default=0, verbose_name='Overall médio')
    order = models.PositiveSmallIntegerField(default=0, verbose_name='Ordem')

    class Meta:
        verbose_name = 'Time'
        verbose_name_plural = 'Times'
        ordering = ['order']

    def __str__(self):
        return f'{self.name} (Gen #{self.generation_id})'


class TeamPlayer(models.Model):
    team = models.ForeignKey(
        Team, on_delete=models.CASCADE,
        related_name='team_players', verbose_name='Time'
    )
    player = models.ForeignKey(
        'players.Player', on_delete=models.CASCADE,
        related_name='team_appearances', verbose_name='Jogador'
    )
    order_in_team = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = 'Jogador no time'
        verbose_name_plural = 'Jogadores no time'
        unique_together = ('team', 'player')

    def __str__(self):
        return f'{self.player} → {self.team}'
