from django.contrib import admin
from .models import GameDay, Attendance


@admin.register(GameDay)
class GameDayAdmin(admin.ModelAdmin):
    list_display = ['date', 'description', 'location', 'total_present', 'total_players']
    ordering = ['-date']


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['player', 'gameday', 'present', 'checked_at']
    list_filter = ['present', 'gameday']
    search_fields = ['player__name']
