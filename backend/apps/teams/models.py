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
    # Quadra dentro do circuito: dias com várias quadras ao mesmo tempo têm um sorteio por quadra
    court = models.PositiveSmallIntegerField(default=1, verbose_name='Quadra')
    notes = models.TextField(blank=True, null=True, verbose_name='Observações')
    balance_score = models.FloatField(default=0, verbose_name='Score de balanceamento')
    is_locked = models.BooleanField(default=False, verbose_name='Trancado (Finalizado)')
    # Quem foi embora/saiu da pelada: fica fora do Embaralhar e do Alocar, mas mantém o
    # check-in na quadra (para não levar falta ao encerrar o circuito).
    removed_players = models.ManyToManyField(
        'players.Player', blank=True, related_name='removed_from_generations', verbose_name='Saíram da pelada'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Geração de equipes'
        verbose_name_plural = 'Gerações de equipes'
        ordering = ['-created_at']

    def __str__(self):
        return f'Geração {self.get_modality_display()} — {self.created_at.date()}'

    def waiting_checkins(self):
        """
        Quem chegou à quadra e ainda não está em nenhum time do circuito (em nenhuma quadra), nem saiu da
        pelada, por ordem de chegada. É a lista que a tela mostra como "aguardando" e que o Completar distribui.
        """
        if not self.gameday_id:
            return []
        taken = taken_player_ids(self.gameday)
        checkins = sorted(self.gameday.court_checkins.all(), key=lambda c: (c.arrived_at, c.id))
        return [c for c in checkins if c.player_id not in taken]


def taken_player_ids(gameday):
    """
    Quem já está num time de alguma quadra do circuito (aberta ou encerrada) ou saiu da pelada.
    Assim cada atleta fica numa quadra só. Usa o prefetch quando houver.
    """
    generations = gameday.team_generations.all()
    taken = {tp.player_id for g in generations for team in g.teams.all() for tp in team.team_players.all()}
    taken |= {p.id for g in generations for p in g.removed_players.all()}
    return taken


def next_court(gameday_id):
    """Número da próxima quadra do circuito (1 no primeiro sorteio)."""
    if not gameday_id:
        return 1
    last = TeamGeneration.objects.filter(gameday_id=gameday_id).aggregate(models.Max('court'))['court__max']
    return (last or 0) + 1


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
