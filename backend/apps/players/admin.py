from django.contrib import admin
from .models import Player, StarHistory


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ['name', 'nickname', 'shirt_number', 'main_position', 'status', 'latest_overall']
    list_filter = ['main_position', 'status', 'dominant_hand']
    search_fields = ['name', 'nickname']
    ordering = ['name']

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('evaluations')


@admin.register(StarHistory)
class StarHistoryAdmin(admin.ModelAdmin):
    list_display = ['player', 'category', 'action', 'count', 'created_at']
    list_filter = ['category', 'action']
    search_fields = ['player__name', 'player__nickname']
    ordering = ['-created_at']
    list_select_related = ['player']
    autocomplete_fields = ['player']

