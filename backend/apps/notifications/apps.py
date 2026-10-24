from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    name = 'apps.notifications'

    def ready(self):
        from . import checks  # noqa: F401  (registra o aviso das chaves VAPID)
