from django.contrib import admin
from django.contrib import messages
from django.utils import timezone
from .models import Player, StarHistory, Badge, PlayerBadge, Season, SeasonStanding


@admin.action(description='Marcar selecionados como Ativos')
def make_active(modeladmin, request, queryset):
    # Ponto de Reset: senão o recálculo de faltas inativa de novo pelo histórico
    updated = queryset.update(status='active', consecutive_absences=0, absences_reset_date=timezone.localdate())
    modeladmin.message_user(request, f'{updated} jogadores foram marcados como ativos e tiveram faltas zeradas.', messages.SUCCESS)


@admin.action(description='Marcar selecionados como Inativos')
def make_inactive(modeladmin, request, queryset):
    updated = queryset.update(status='inactive')
    modeladmin.message_user(request, f'{updated} jogadores foram inativados.', messages.WARNING)


@admin.action(description='Zerar faltas consecutivas (com Ponto de Reset)')
def reset_consecutive_absences(modeladmin, request, queryset):
    updated = queryset.update(consecutive_absences=0, absences_reset_date=timezone.localdate())
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
        # Data de reset hoje ou no passado: zera a contagem na hora para refletir no painel
        reset_date = obj.absences_reset_date
        if 'absences_reset_date' in form.changed_data and reset_date and reset_date <= timezone.localdate():
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


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display = ['name', 'condition_type', 'condition_value']
    list_filter = ['condition_type']
    search_fields = ['name', 'description']
    ordering = ['name']


@admin.register(PlayerBadge)
class PlayerBadgeAdmin(admin.ModelAdmin):
    list_display = ['player', 'badge', 'awarded_at']
    list_filter = ['badge', 'awarded_at']
    search_fields = ['player__name', 'badge__name']
    ordering = ['-awarded_at']
    autocomplete_fields = ['player']


@admin.register(Season)
class SeasonAdmin(admin.ModelAdmin):
    list_display = ['number', 'name', 'start_date', 'end_date', 'finalized_at']
    readonly_fields = ['number', 'start_date', 'end_date', 'finalized_at']
    fields = ['number', 'name', 'start_date', 'end_date', 'finalized_at', 'prize_notes']
    ordering = ['-number']


@admin.register(SeasonStanding)
class SeasonStandingAdmin(admin.ModelAdmin):
    list_display = ['season', 'player', 'elo', 'elo_tier', 'elo_rank', 'fire_rank', 'wins_rank', 'wins', 'matches']
    list_filter = ['season']
    search_fields = ['player__name', 'player__nickname']
    list_select_related = ['season', 'player']
    ordering = ['season', 'elo_rank']

    def has_add_permission(self, request):
        return False  # gerado automaticamente na virada da temporada
