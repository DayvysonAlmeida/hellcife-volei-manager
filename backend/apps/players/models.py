from django.db import models


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
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name='Telefone')
    instagram = models.CharField(max_length=100, blank=True, null=True, verbose_name='Instagram')
    avatar = models.FileField(upload_to='avatars/', blank=True, null=True, verbose_name='Foto do Jogador')
    notes = models.TextField(blank=True, null=True, verbose_name='Observações')
    mini_stars = models.PositiveSmallIntegerField(default=1, verbose_name='Mini Estrelas')
    big_stars = models.PositiveSmallIntegerField(default=0, verbose_name='Estrelas Grandes')
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

    @property
    def latest_overall(self):
        eval_ = self.evaluations.order_by('-date').first()
        return eval_.overall if eval_ else None

    @property
    def avatar_url(self):
        if self.avatar:
            return self.avatar.url
        return None

    @property
    def display_name(self):
        return self.nickname or self.name
