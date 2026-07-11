from django.contrib import admin
from .models import Player


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ['name', 'nickname', 'shirt_number', 'main_position', 'status', 'latest_overall']
    list_filter = ['main_position', 'status', 'dominant_hand']
    search_fields = ['name', 'nickname']
    ordering = ['name']
