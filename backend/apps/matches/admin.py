from django.contrib import admin
from .models import Match, MatchTeam, MatchPlayer


class MatchTeamInline(admin.TabularInline):
    model = MatchTeam
    extra = 0


class MatchPlayerInline(admin.TabularInline):
    model = MatchPlayer
    extra = 0


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ['date', 'location', 'get_modality_display', 'created_at']
    inlines = [MatchTeamInline, MatchPlayerInline]
    ordering = ['-date']
