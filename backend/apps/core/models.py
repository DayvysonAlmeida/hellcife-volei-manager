from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email é obrigatório')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('profile', 'admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    PROFILE_CHOICES = [
        ('admin', 'Administrador'),
        ('moderator', 'Moderador'),
        ('player', 'Jogador'),
    ]

    email = models.EmailField(unique=True, verbose_name='E-mail')
    name = models.CharField(max_length=150, verbose_name='Nome')
    profile = models.CharField(max_length=20, choices=PROFILE_CHOICES, default='player', verbose_name='Perfil')
    avatar_url = models.URLField(blank=True, null=True, verbose_name='URL do Avatar')
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    is_staff = models.BooleanField(default=False, verbose_name='Staff')
    date_joined = models.DateTimeField(auto_now_add=True, verbose_name='Data de cadastro')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Última atualização')

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        verbose_name = 'Usuário'
        verbose_name_plural = 'Usuários'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.email})'

    @property
    def is_admin(self):
        return self.profile == 'admin'

    @property
    def is_moderator(self):
        return self.profile in ('admin', 'moderator')
