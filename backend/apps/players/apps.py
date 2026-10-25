from django.apps import AppConfig


class PlayersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.players'
    verbose_name = 'Jogadores'

    def ready(self):
        from . import checks  # noqa: F401  (registra o aviso da CPF_PEPPER)
