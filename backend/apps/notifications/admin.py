from django.contrib import admin
from .models import Notification, GlobalAnnouncement

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
