from django.contrib import admin
from .models import Evaluation, EvaluationHistory


@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display = ['player', 'date', 'overall', 'attack', 'defense', 'serve', 'evaluator']
    list_select_related = ['player', 'evaluator']
    list_filter = ['date']
    search_fields = ['player__name', 'player__nickname']
    autocomplete_fields = ['player']
    ordering = ['-date']
    date_hierarchy = 'date'
    
    fieldsets = (
        ('Informações', {
            'fields': ('player', 'evaluator', 'date', 'notes')
        }),
        ('Fundamentos Principais', {
            'fields': ('serve', 'reception', 'passing', 'setting', 'attack', 'block', 'defense')
        }),
        ('Atributos Secundários', {
            'fields': ('recovery', 'positioning', 'communication', 'tactical_iq', 'conditioning', 'consistency')
        }),
        ('Resultado', {
            'fields': ('overall',),
        }),
    )
    readonly_fields = ['overall']


@admin.register(EvaluationHistory)
class EvaluationHistoryAdmin(admin.ModelAdmin):
    list_display = ['evaluation', 'changed_by', 'changed_at']
    list_select_related = ['evaluation', 'changed_by']
    readonly_fields = ['evaluation', 'changed_by', 'changed_at', 'previous_data', 'new_data']
