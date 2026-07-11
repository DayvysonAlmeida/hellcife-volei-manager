from django.contrib import admin
from .models import TeamGeneration, Team, TeamPlayer


class TeamPlayerInline(admin.TabularInline):
    model = TeamPlayer
    extra = 0


class TeamInline(admin.TabularInline):
    model = Team
    extra = 0


@admin.register(TeamGeneration)
class TeamGenerationAdmin(admin.ModelAdmin):
    list_display = ['id', 'get_modality_display', 'gameday', 'balance_score', 'created_at']
    inlines = [TeamInline]


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ['name', 'generation', 'avg_overall', 'color']
    inlines = [TeamPlayerInline]
