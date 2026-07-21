from django.contrib import admin
from .models import GameDay, Attendance


@admin.register(GameDay)
class GameDayAdmin(admin.ModelAdmin):
    list_display = ['date', 'description', 'location', 'total_present', 'total_players']
    search_fields = ['description', 'location']
    ordering = ['-date']


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['player', 'gameday', 'present', 'checked_at']
    list_filter = ['present', 'gameday']
    list_select_related = ['player', 'gameday']
    search_fields = ['player__name', 'player__nickname']
    autocomplete_fields = ['player', 'gameday']
