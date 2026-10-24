from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone

STAR_VALIDATORS = [MinValueValidator(0), MaxValueValidator(5)]
GUEST_LEVEL_VALIDATORS = [MinValueValidator(1), MaxValueValidator(10)]


class Player(models.Model):
    POSITION_CHOICES = [
        ('libero', 'Líbero'),
        ('setter', 'Levantador'),
        ('opposite', 'Oposto'),
        ('outside', 'Ponteiro'),
        ('middle', 'Central'),
        ('universal', 'Universal'),
    ]

    HAND_CHOICES = [
        ('right', 'Destro'),
        ('left', 'Canhoto'),
        ('both', 'Ambidestro'),
    ]

    # Autodeclarado (LGPD: só o necessário; ninguém precisa dizer se é cis ou trans). O sorteio espalha
    # quem marcou "Mulher" entre os times; as demais opções entram no sorteio normal.
    GENDER_CHOICES = [
        ('F', 'Mulher'),
        ('M', 'Homem'),
        ('NB', 'Pessoa não binária'),
        ('O', 'Outro'),
        ('N', 'Prefiro não informar'),
    ]

    STATUS_CHOICES = [
        ('active', 'Ativo'),
        ('inactive', 'Inativo'),
        ('injured', 'Lesionado'),
        ('suspended', 'Suspenso'),
        ('pending', 'Aguardando aprovação'),  # cadastrou-se pelo app; não aparece em listas nem rankings
    ]

    name = models.CharField(max_length=150, verbose_name='Nome')  # nome social: o que aparece no app
    legal_name = models.CharField(
        max_length=150, blank=True, default='', verbose_name='Nome completo (civil)',
        help_text='Opcional. Só a staff vê.',
    )
    terms_accepted_at = models.DateTimeField(
        null=True, blank=True, verbose_name='Aceitou regulamento e uso dos dados em',
    )
    nickname = models.CharField(max_length=80, blank=True, null=True, verbose_name='Apelido')
    shirt_number = models.PositiveSmallIntegerField(blank=True, null=True, verbose_name='Número da camisa')
    age = models.PositiveSmallIntegerField(blank=True, null=True, verbose_name='Idade')

    is_guest = models.BooleanField(default=False, verbose_name='É Convidado?', db_index=True)
    invited_by = models.CharField(max_length=150, blank=True, null=True, verbose_name='Convidado por')
    # Atleta que convidou pelo app: é avisado quando o convidado entra na lista
    invited_by_player = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invited_guests', verbose_name='Convidado pelo atleta',
    )
    guest_overall = models.PositiveSmallIntegerField(
        blank=True, null=True, validators=GUEST_LEVEL_VALIDATORS, verbose_name='Nível do convidado',
        help_text='Avaliação temporária para o sorteio: 1–3 iniciante, 4–7 intermediário, 8–10 avançado. '
                  'Vale até o convidado ter uma avaliação de verdade.',
    )
    height = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True, verbose_name='Altura (m)')
    weight = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True, verbose_name='Peso (kg)')
    main_position = models.CharField(max_length=20, choices=POSITION_CHOICES, verbose_name='Posição principal')
    secondary_position = models.CharField(
        max_length=20, choices=POSITION_CHOICES, blank=True, null=True, verbose_name='Posição secundária'
    )
    dominant_hand = models.CharField(max_length=10, choices=HAND_CHOICES, default='right', verbose_name='Mão dominante')
    gender = models.CharField(max_length=2, choices=GENDER_CHOICES, default='M', verbose_name='Gênero')
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name='Telefone')
    instagram = models.CharField(max_length=100, blank=True, null=True, verbose_name='Instagram')
    avatar = models.FileField(upload_to='avatars/', blank=True, null=True, verbose_name='Foto do Jogador')
    notes = models.TextField(blank=True, null=True, verbose_name='Observações')
    standalone_credits = models.DecimalField(max_digits=4, decimal_places=1, default=0.0, verbose_name='Créditos Avulsos')

    # Sistema de Estrelas — cada categoria tem 0–5 estrelas
    # Total (mvp + ataque + defesa) = mini_stars (0–15)
    # Opção B: ao atingir 15, big_stars sobe através da soma de pontos baseadas no histórico vitalício.
    mvp_stars = models.PositiveSmallIntegerField(
        default=0, verbose_name='MVPs'
    )
    attack_stars = models.PositiveSmallIntegerField(
        default=0, verbose_name='Melhores Ataques'
    )
    defense_stars = models.PositiveSmallIntegerField(
        default=0, verbose_name='Melhores Defesas'
    )
    setter_stars = models.PositiveSmallIntegerField(
        default=0, verbose_name='Melhores Levantamentos'
    )
    pass_stars = models.PositiveSmallIntegerField(
        default=0, verbose_name='Melhores Passes'
    )
    block_stars = models.PositiveSmallIntegerField(
        default=0, verbose_name='Melhores Bloqueios'
    )
    mini_stars = models.PositiveSmallIntegerField(default=0, verbose_name='Total de Mini Estrelas')
    big_stars = models.PositiveSmallIntegerField(default=0, verbose_name='Estrelas Grandes')
    
    # Controle de Frequência
    consecutive_absences = models.PositiveSmallIntegerField(
        default=0, 
        verbose_name='Faltas Consecutivas',
        help_text='Quantos circuitos fechados seguidos este jogador não fez check-in na quadra.'
    )
    absences_reset_date = models.DateField(
        null=True, blank=True,
        verbose_name='Ponto de Reset',
        help_text='Data em que as faltas consecutivas foram zeradas manualmente. Faltas anteriores a essa data serão ignoradas.'
    )

    # Sistema Elo — baseado em vitórias/derrotas nas partidas
    elo = models.FloatField(
        default=500.0,
        verbose_name='Elo da temporada',
        help_text='Elo da temporada atual (zera em 500 a cada temporada). Calculado pelas partidas da temporada.'
    )
    elo_tier = models.CharField(
        max_length=20,
        default='silver',
        verbose_name='Faixa Elo',
        help_text='Faixa atual do jogador na temporada.',
    )
    elo_all_time = models.FloatField(
        default=500.0,
        verbose_name='Elo histórico',
        help_text='Elo de todas as partidas, sem reset. Não aparece no app: usado só para equilibrar o sorteio dos times.',
    )

    # Totais absolutos para o Dashboard (não são resetados ao virar grande estrela)
    total_mvp = models.PositiveIntegerField(default=0, verbose_name='Total MVP')
    total_attack = models.PositiveIntegerField(default=0, verbose_name='Total Ataque')
    total_defense = models.PositiveIntegerField(default=0, verbose_name='Total Defesa')
    total_setter = models.PositiveIntegerField(default=0, verbose_name='Total Levantamento')
    total_pass = models.PositiveIntegerField(default=0, verbose_name='Total Passe')
    total_block = models.PositiveIntegerField(default=0, verbose_name='Total Bloqueio')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='Status', db_index=True)
    user = models.OneToOneField(
        'core.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='player_profile', verbose_name='Usuário vinculado'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Jogador'
        verbose_name_plural = 'Jogadores'
        ordering = ['name']

    def __str__(self):
        display = self.nickname or self.name
        if self.shirt_number:
            return f'#{self.shirt_number} {display}'
        return display

    def promote_stars(self):
        """
        Recalcula mini_stars a partir das 6 categorias. (Desativado: gerenciado diretamente pela API para permitir zerar o troco)
        """
        pass

    @property
    def latest_overall(self):
        eval_ = self.evaluations.order_by('-date', '-id').first()
        return eval_.overall if eval_ else None

    @property
    def draw_overall(self):
        """Nível usado no sorteio: a última avaliação ou, sem ela, o nível temporário do convidado."""
        overall = self.latest_overall
        return overall if overall is not None else self.guest_overall

    @property
    def avatar_url(self):
        if self.avatar:
            return self.avatar.url
        return None

    @property
    def display_name(self):
        return self.nickname or self.name

    @classmethod
    def reactivate_inactive(cls, player_ids):
        """
        Volta para ativo quem estava inativo e apareceu na quadra.
        Grava o Ponto de Reset para o recálculo de faltas não inativar de novo pelo histórico.
        """
        return cls.objects.filter(id__in=player_ids, status='inactive', is_guest=False).update(
            status='active', consecutive_absences=0, absences_reset_date=timezone.localdate()
        )


class StarHistory(models.Model):
    CATEGORY_CHOICES = [
        ('mvp', 'MVP'),
        ('attack', 'Ataque'),
        ('defense', 'Defesa'),
        ('setter', 'Levantador'),
        ('pass', 'Passe'),
        ('block', 'Bloqueio'),
        ('promotion', 'Promoção (Grande Estrela)'),
    ]

    ACTION_CHOICES = [
        ('add', 'Adicionado'),
        ('remove', 'Removido'),
        ('promote', 'Conquistou Grande Estrela'),
    ]

    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='star_history', verbose_name='Jogador')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, verbose_name='Categoria')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, verbose_name='Ação')
    count = models.PositiveSmallIntegerField(default=1, verbose_name='Quantidade')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='Data e Hora')
    # Quem da staff deu ou tirou a estrela (vazio nos lançamentos de antes deste registro)
    given_by = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='stars_given', verbose_name='Lançado por',
    )

    class Meta:
        verbose_name = 'Histórico de Estrela'
        verbose_name_plural = 'Histórico de Estrelas'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.player.display_name} - {self.get_action_display()} {self.count} {self.get_category_display()}"


class Badge(models.Model):
    TIER_CHOICES = [
        ('bronze', 'Bronze'),
        ('silver', 'Prata'),
        ('gold', 'Ouro'),
        ('diamond', 'Diamante'),
    ]

    CONDITION_CHOICES = [
        ('total_matches', 'Total de Partidas Jogadas'),
        ('total_mvp', 'Total de MVPs'),
        ('total_big_stars', 'Total de Grandes Estrelas'),
        ('consecutive_wins', 'Vitórias Consecutivas'),
        ('consecutive_matches_no_loss', 'Partidas Invicto no Dia'),
    ]

    name = models.CharField(max_length=100, verbose_name='Nome do Badge')
    description = models.TextField(verbose_name='Descrição')
    icon = models.CharField(max_length=50, default='Award', verbose_name='Ícone Lucide')
    color_hex = models.CharField(max_length=20, default='#FFD700', verbose_name='Cor Hexadecimal')
    tier = models.CharField(max_length=20, choices=TIER_CHOICES, default='bronze', verbose_name='Nível')
    condition_type = models.CharField(max_length=50, choices=CONDITION_CHOICES, verbose_name='Condição')
    condition_value = models.PositiveIntegerField(verbose_name='Valor da Condição')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Badge'
        verbose_name_plural = 'Badges'
        ordering = ['tier', 'condition_value']

    def __str__(self):
        return f"{self.name} ({self.get_tier_display()})"


class PlayerBadge(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='badges', verbose_name='Jogador')
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name='awarded_to', verbose_name='Badge')
    awarded_at = models.DateTimeField(auto_now_add=True, verbose_name='Conquistado em')

    class Meta:
        verbose_name = 'Badge do Jogador'
        verbose_name_plural = 'Badges dos Jogadores'
        unique_together = ('player', 'badge')
        ordering = ['-awarded_at']

    def __str__(self):
        return f"{self.player.display_name} - {self.badge.name}"


class Season(models.Model):
    """
    Temporada da ranqueada (Elo, Fire Shark e Gladiador). Semestral: janeiro-junho e julho-dezembro.
    A número 0 é a pré-temporada (todo o histórico até o início da Temporada 1).
    """
    number = models.PositiveSmallIntegerField(unique=True, verbose_name='Número')
    name = models.CharField(max_length=60, verbose_name='Nome')
    start_date = models.DateField(null=True, blank=True, verbose_name='Início', help_text='Vazio na pré-temporada.')
    end_date = models.DateField(verbose_name='Fim')
    finalized_at = models.DateTimeField(
        null=True, blank=True, verbose_name='Encerrada em',
        help_text='Preenchido quando o resultado final é salvo (na virada para a temporada seguinte).',
    )
    prize_notes = models.TextField(blank=True, verbose_name='Premiação', help_text='Texto livre sobre a premiação da temporada.')
    results_validated_at = models.DateTimeField(
        null=True, blank=True, verbose_name='Resultado validado em',
        help_text='Preenchido quando a organização confere a classificação final. Antes disso, os atletas não veem o pódio.',
    )
    results_validated_by = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='+', verbose_name='Validado por',
    )

    class Meta:
        verbose_name = 'Temporada'
        verbose_name_plural = 'Temporadas'
        ordering = ['-number']

    def __str__(self):
        return self.name

    def contains(self, day) -> bool:
        return (self.start_date is None or day >= self.start_date) and day <= self.end_date


class SeasonStanding(models.Model):
    """Resultado final de um atleta numa temporada encerrada."""
    season = models.ForeignKey(Season, on_delete=models.CASCADE, related_name='standings', verbose_name='Temporada')
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='season_standings', verbose_name='Atleta')
    elo = models.FloatField(verbose_name='Elo final')
    elo_tier = models.CharField(max_length=20, verbose_name='Faixa final')
    matches = models.PositiveIntegerField(default=0, verbose_name='Partidas')
    wins = models.PositiveIntegerField(default=0, verbose_name='Vitórias')
    point_balance = models.IntegerField(default=0, verbose_name='Saldo de pontos')
    fire_score = models.FloatField(null=True, blank=True, verbose_name='Fire Shark')
    elo_rank = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name='Posição no Elo')
    fire_rank = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name='Posição no Fire Shark')
    wins_rank = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name='Posição no Gladiador')

    class Meta:
        verbose_name = 'Resultado da temporada'
        verbose_name_plural = 'Resultados das temporadas'
        unique_together = ('season', 'player')
        ordering = ['season', 'elo_rank']

    def __str__(self):
        return f'{self.season} — {self.player}'


class RankingLeader(models.Model):
    """
    Líder atual de cada ranking, para o aviso de "novo líder" sair uma vez só.
    Fica no banco (e não no cache da memória) porque vale para todos os containers e sobrevive a reinícios.
    """
    ranking = models.CharField(max_length=30, unique=True, verbose_name='Ranking')
    player = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, related_name='+', verbose_name='Atleta líder')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Líder de ranking'
        verbose_name_plural = 'Líderes de ranking'

    def __str__(self):
        return f'{self.ranking} — {self.player}'
