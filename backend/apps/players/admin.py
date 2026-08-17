from django.contrib import admin
from django.contrib import messages
from .models import Player, StarHistory


@admin.action(description='Marcar selecionados como Ativos')
def make_active(modeladmin, request, queryset):
    updated = queryset.update(status='active', consecutive_absences=0)
    modeladmin.message_user(request, f'{updated} jogadores foram marcados como ativos e tiveram faltas zeradas.', messages.SUCCESS)


@admin.action(description='Marcar selecionados como Inativos')
def make_inactive(modeladmin, request, queryset):
    updated = queryset.update(status='inactive')
    modeladmin.message_user(request, f'{updated} jogadores foram inativados.', messages.WARNING)


@admin.action(description='Zerar faltas consecutivas (com Ponto de Reset)')
def reset_consecutive_absences(modeladmin, request, queryset):
    from django.utils import timezone
    updated = queryset.update(
        consecutive_absences=0,
        absences_reset_date=timezone.now().date()
    )
    modeladmin.message_user(request, f'Faltas zeradas e data de reset cravada para {updated} jogadores.', messages.SUCCESS)


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ['name', 'nickname', 'main_position', 'status', 'is_guest', 'big_stars', 'consecutive_absences']
    list_editable = ['status', 'is_guest']
    list_filter = ['status', 'is_guest', 'main_position', 'gender']
    search_fields = ['name', 'nickname', 'phone', 'invited_by']
    ordering = ['name']
    actions = [make_active, make_inactive, reset_consecutive_absences]
    
    fieldsets = (
        ('Identificação', {
            'fields': ('name', 'nickname', 'shirt_number', 'user', 'avatar')
        }),
        ('Atributos Físicos', {
            'fields': ('age', 'height', 'weight', 'gender', 'dominant_hand')
        }),
        ('Posições', {
            'fields': ('main_position', 'secondary_position')
        }),
        ('Status & Controles', {
            'fields': ('status', 'is_guest', 'invited_by', 'consecutive_absences', 'absences_reset_date')
        }),
        ('Sistema de Estrelas (Atuais)', {
            'fields': ('big_stars', 'mini_stars', 'mvp_stars', 'attack_stars', 'defense_stars', 'setter_stars', 'pass_stars', 'block_stars')
        }),
        ('Totais Históricos', {
            'fields': ('total_mvp', 'total_attack', 'total_defense', 'total_setter', 'total_pass', 'total_block'),
            'classes': ('collapse',)
        }),
        ('Contatos & Observações', {
            'fields': ('phone', 'instagram', 'notes')
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('evaluations')

    def save_model(self, request, obj, form, change):
        if 'absences_reset_date' in form.changed_data and obj.absences_reset_date:
            from django.utils import timezone
            # Se o admin mudou a data de reset manualmente para hoje ou para o passado,
            # já zera a contagem de faltas na hora para refletir no painel!
            if obj.absences_reset_date <= timezone.now().date():
                obj.consecutive_absences = 0
        super().save_model(request, obj, form, change)


@admin.register(StarHistory)
class StarHistoryAdmin(admin.ModelAdmin):
    list_display = ['player', 'category', 'action', 'count', 'created_at']
    list_filter = ['category', 'action', 'created_at']
    search_fields = ['player__name', 'player__nickname']
    ordering = ['-created_at']
    list_select_related = ['player']
    autocomplete_fields = ['player']
    date_hierarchy = 'created_at'

