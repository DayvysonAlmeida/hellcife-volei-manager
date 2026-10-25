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
    # E-mail sem "+apelido" e, no Gmail, sem pontos: o mesmo endereço escrito de outro jeito não cria outra conta
    email_canonical = models.CharField(max_length=254, blank=True, default='', db_index=True, verbose_name='E-mail normalizado')
    name = models.CharField(max_length=150, verbose_name='Nome')
    profile = models.CharField(max_length=20, choices=PROFILE_CHOICES, default='player', verbose_name='Perfil')
    avatar_url = models.URLField(blank=True, null=True, verbose_name='URL do Avatar')
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    is_staff = models.BooleanField(default=False, verbose_name='Staff')
    # Quem se cadastra pelo app só entra depois de clicar no link do e-mail; contas criadas pela staff já valem
    email_confirmed = models.BooleanField(default=True, verbose_name='E-mail confirmado')
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

    def save(self, *args, **kwargs):
        from apps.players.identity import canonical_email
        self.email_canonical = canonical_email(self.email)
        update_fields = kwargs.get('update_fields')
        if update_fields is not None and 'email' in update_fields:
            kwargs['update_fields'] = {*update_fields, 'email_canonical'}
        super().save(*args, **kwargs)

    @property
    def is_admin(self):
        return self.profile == 'admin'

    @property
    def is_moderator(self):
        return self.profile in ('admin', 'moderator')
