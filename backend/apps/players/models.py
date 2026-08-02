from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone

STAR_VALIDATORS = [MinValueValidator(0), MaxValueValidator(5)]


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

    GENDER_CHOICES = [
        ('M', 'Masculino'),
        ('F', 'Feminino'),
    ]

    STATUS_CHOICES = [
        ('active', 'Ativo'),
        ('inactive', 'Inativo'),
        ('injured', 'Lesionado'),
        ('suspended', 'Suspenso'),
    ]

    name = models.CharField(max_length=150, verbose_name='Nome')
    nickname = models.CharField(max_length=80, blank=True, null=True, verbose_name='Apelido')
    shirt_number = models.PositiveSmallIntegerField(blank=True, null=True, verbose_name='Número da camisa')
    age = models.PositiveSmallIntegerField(blank=True, null=True, verbose_name='Idade')

    is_guest = models.BooleanField(default=False, verbose_name='É Convidado?', db_index=True)
    invited_by = models.CharField(max_length=150, blank=True, null=True, verbose_name='Convidado por')
    height = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True, verbose_name='Altura (m)')
    weight = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True, verbose_name='Peso (kg)')
    main_position = models.CharField(max_length=20, choices=POSITION_CHOICES, verbose_name='Posição principal')
    secondary_position = models.CharField(
        max_length=20, choices=POSITION_CHOICES, blank=True, null=True, verbose_name='Posição secundária'
    )
    dominant_hand = models.CharField(max_length=10, choices=HAND_CHOICES, default='right', verbose_name='Mão dominante')
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default='M', verbose_name='Sexo')
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name='Telefone')
    instagram = models.CharField(max_length=100, blank=True, null=True, verbose_name='Instagram')
    avatar = models.FileField(upload_to='avatars/', blank=True, null=True, verbose_name='Foto do Jogador')
    notes = models.TextField(blank=True, null=True, verbose_name='Observações')

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
    def avatar_url(self):
        if self.avatar:
            return self.avatar.url
        return None

    @property
    def display_name(self):
        return self.nickname or self.name


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

    class Meta:
        verbose_name = 'Histórico de Estrela'
        verbose_name_plural = 'Histórico de Estrelas'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.player.display_name} - {self.get_action_display()} {self.count} {self.get_category_display()}"
