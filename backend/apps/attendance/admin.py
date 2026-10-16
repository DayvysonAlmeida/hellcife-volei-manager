from django.contrib import admin, messages
from django.db.models import Exists, OuterRef

from apps.players.models import Player
from .models import GameDay, Attendance, AttendancePayment, CourtCheckin


class AttendanceInline(admin.TabularInline):
    model = Attendance
    extra = 0
    autocomplete_fields = ['player']
    ordering = ['-present', 'player__name']  # presentes no topo


@admin.register(GameDay)
class GameDayAdmin(admin.ModelAdmin):
    list_display = ['date', 'description', 'location', 'total_present', 'total_players']
    search_fields = ['description', 'location']
    ordering = ['-date']
    date_hierarchy = 'date'
    inlines = [AttendanceInline]


@admin.action(description='Marcar selecionadas como JUSTIFICADAS')
def justify_attendances(modeladmin, request, queryset):
    updated = queryset.update(is_justified=True)
    modeladmin.message_user(request, f'{updated} presenças foram marcadas como justificadas.', messages.SUCCESS)


@admin.action(description='Remover justificativa das selecionadas')
def unjustify_attendances(modeladmin, request, queryset):
    updated = queryset.update(is_justified=False)
    modeladmin.message_user(request, f'{updated} justificativas foram removidas.', messages.WARNING)


@admin.action(description='Marcar NA QUADRA (Tiragem de Falta)')
def court_checkin_add(modeladmin, request, queryset):
    from .views import sync_absences_logic

    arrived = []
    for att in queryset.select_related('gameday', 'player'):
        _, created = CourtCheckin.objects.get_or_create(gameday=att.gameday, player=att.player)
        if created:
            arrived.append(att.player_id)
    Player.reactivate_inactive(arrived)
    sync_absences_logic()  # recalcula no-shows e faltas de quem entrou na quadra
    modeladmin.message_user(request, f'{len(arrived)} jogadores marcados na quadra. Faltas recalculadas.', messages.SUCCESS)


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['player', 'gameday', 'present', 'court_checkin_status', 'was_no_show', 'is_justified', 'checked_at']
    # was_no_show fica só leitura: o recálculo de faltas sobrescreve esse campo
    list_editable = ['present', 'is_justified']
    list_filter = ['present', 'gameday']
    list_select_related = ['player', 'gameday']
    search_fields = ['player__name', 'player__nickname', 'gameday__description']
    autocomplete_fields = ['player', 'gameday']
    date_hierarchy = 'checked_at'
    actions = [justify_attendances, unjustify_attendances, court_checkin_add]

    def get_queryset(self, request):
        checkin_exists = CourtCheckin.objects.filter(gameday=OuterRef('gameday'), player=OuterRef('player'))
        return super().get_queryset(request).annotate(arrived_at_court=Exists(checkin_exists))

    @admin.display(boolean=True, description='Na Quadra?', ordering='arrived_at_court')
    def court_checkin_status(self, obj):
        return obj.arrived_at_court


@admin.register(CourtCheckin)
class CourtCheckinAdmin(admin.ModelAdmin):
    list_display = ['player', 'gameday', 'arrived_at']
    list_filter = ['gameday', 'arrived_at']
    search_fields = ['player__name']
    autocomplete_fields = ['player', 'gameday']
    ordering = ['-gameday__date', 'arrived_at']


@admin.register(AttendancePayment)
class AttendancePaymentAdmin(admin.ModelAdmin):
    list_display = ['attendance', 'amount', 'method', 'status', 'paid_at', 'confirmed_by']
    list_filter = ['method', 'status']
    search_fields = ['attendance__player__name', 'asaas_payment_id']
    list_select_related = ['attendance__player', 'attendance__gameday', 'confirmed_by']
    date_hierarchy = 'paid_at'
    raw_id_fields = ['attendance']
