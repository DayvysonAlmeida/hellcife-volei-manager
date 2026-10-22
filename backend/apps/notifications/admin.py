from urllib.parse import urlsplit

from django.contrib import admin
from .models import Notification, GlobalAnnouncement, PushSubscription

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'type', 'is_read', 'created_at')
    list_filter = ('type', 'is_read', 'created_at')
    search_fields = ('title', 'message', 'user__name', 'user__email')
    readonly_fields = ('created_at',)

@admin.register(GlobalAnnouncement)
class GlobalAnnouncementAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_at')
    search_fields = ('title', 'message')
    readonly_fields = ('created_at',)

@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    """Só consulta: as inscrições são criadas pelos aparelhos e apagadas quando somem."""
    list_display = ('user', 'service', 'created_at', 'updated_at')
    search_fields = ('user__name', 'user__email')
    fields = ('user', 'endpoint', 'created_at', 'updated_at')
    readonly_fields = fields

    @admin.display(description='Serviço')
    def service(self, obj):
        return urlsplit(obj.endpoint).hostname

    def has_add_permission(self, request):
        return False
