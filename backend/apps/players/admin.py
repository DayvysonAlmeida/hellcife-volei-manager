from django.contrib import admin
from django.contrib import messages
from .models import Player, StarHistory, Badge, PlayerBadge


@admin.action(description='Marcar selecionados como Ativos')
def make_active(modeladmin, request, queryset):
    updated = queryset.update(status='active', consecutive_absences=0)
    modeladmin.message_user(request, f'{updated} jogadores foram marcados como ativos e tiveram faltas zeradas.', messages.SUCCESS)


@admin.action(description='Marcar selecionados como Inativos')
def make_inactive(modeladmin, request, queryset):
    updated = queryset.update(status='inactive')
    modeladmin.message_user(request, f'{updated} jogadores foram inativados.', messages.WARNING)


@admin.action(description='Zerar faltas consecutivas')
def reset_absences(modeladmin, request, queryset):
    updated = queryset.update(consecutive_absences=0)
    modeladmin.message_user(request, f'Faltas zeradas para {updated} jogadores.', messages.SUCCESS)


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ['name', 'nickname', 'main_position', 'status', 'is_guest', 'big_stars', 'consecutive_absences']
    list_editable = ['status', 'is_guest']
    list_filter = ['status', 'is_guest', 'main_position', 'gender']
    search_fields = ['name', 'nickname', 'phone', 'invited_by']
    ordering = ['name']
    actions = [make_active, make_inactive, reset_absences]
    
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
            'fields': ('status', 'is_guest', 'invited_by', 'consecutive_absences')
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

