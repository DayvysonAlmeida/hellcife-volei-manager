from django.contrib import admin
from .models import Evaluation, EvaluationHistory
@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display = ['player', 'date', 'overall', 'evaluator']
    list_select_related = ['player', 'evaluator']
    list_filter = ['date']
    search_fields = ['player__name']
    ordering = ['-date']


@admin.register(EvaluationHistory)
class EvaluationHistoryAdmin(admin.ModelAdmin):
    list_display = ['evaluation', 'changed_by', 'changed_at']
    list_select_related = ['evaluation', 'changed_by']
    readonly_fields = ['evaluation', 'changed_by', 'changed_at', 'previous_data', 'new_data']
