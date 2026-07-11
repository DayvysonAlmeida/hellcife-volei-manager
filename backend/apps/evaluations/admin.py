from django.contrib import admin
from .models import Evaluation, EvaluationConfig, EvaluationHistory


@admin.register(EvaluationConfig)
class EvaluationConfigAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'updated_at']


@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display = ['player', 'date', 'overall', 'evaluator']
    list_filter = ['date']
    search_fields = ['player__name']
    ordering = ['-date']


@admin.register(EvaluationHistory)
class EvaluationHistoryAdmin(admin.ModelAdmin):
    list_display = ['evaluation', 'changed_by', 'changed_at']
    readonly_fields = ['evaluation', 'changed_by', 'changed_at', 'previous_data', 'new_data']
