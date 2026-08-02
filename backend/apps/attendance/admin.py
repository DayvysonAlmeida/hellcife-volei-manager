from django.contrib import admin
from .models import GameDay, Attendance


class AttendanceInline(admin.TabularInline):
    model = Attendance
    extra = 0
    autocomplete_fields = ['player']


@admin.register(GameDay)
class GameDayAdmin(admin.ModelAdmin):
    list_display = ['date', 'description', 'location', 'total_present', 'total_players']
    search_fields = ['description', 'location']
    ordering = ['-date']
    date_hierarchy = 'date'
    inlines = [AttendanceInline]


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['player', 'gameday', 'present', 'checked_at']
    list_editable = ['present']
    list_filter = ['present', 'gameday']
    list_select_related = ['player', 'gameday']
    search_fields = ['player__name', 'player__nickname', 'gameday__description']
    autocomplete_fields = ['player', 'gameday']
    date_hierarchy = 'checked_at'
