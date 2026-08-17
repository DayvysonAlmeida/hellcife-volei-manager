from django.contrib import admin
from .models import GameDay, Attendance


from django.db.models import Exists, OuterRef
from .models import CourtCheckin

class AttendanceInline(admin.TabularInline):
    model = Attendance
    extra = 0
    autocomplete_fields = ['player']
    ordering = ['-present', 'player__name']  # <-- Organiza os presentes no TOPO!


@admin.register(GameDay)
class GameDayAdmin(admin.ModelAdmin):
    list_display = ['date', 'description', 'location', 'total_present', 'total_players']
    search_fields = ['description', 'location']
    ordering = ['-date']
    date_hierarchy = 'date'
    inlines = [AttendanceInline]


@admin.action(description='Marcar selecionadas como JUSTIFICADAS')
def justify_attendances(modeladmin, request, queryset):
    from django.contrib import messages
    updated = queryset.update(is_justified=True)
    modeladmin.message_user(request, f'{updated} presenças foram marcadas como justificadas.', messages.SUCCESS)

@admin.action(description='Remover justificativa das selecionadas')
def unjustify_attendances(modeladmin, request, queryset):
    from django.contrib import messages
    updated = queryset.update(is_justified=False)
    modeladmin.message_user(request, f'{updated} justificativas foram removidas.', messages.WARNING)


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['player', 'gameday', 'present', 'court_checkin_status', 'was_no_show', 'is_justified', 'checked_at']
    list_editable = ['present', 'was_no_show', 'is_justified']
    list_filter = ['present', 'gameday']
    list_select_related = ['player', 'gameday']
    search_fields = ['player__name', 'player__nickname', 'gameday__description']
    autocomplete_fields = ['player', 'gameday']
    date_hierarchy = 'checked_at'
    actions = [justify_attendances, unjustify_attendances]

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Anota se o jogador possui um CourtCheckin para este mesmo gameday
        checkin_exists = CourtCheckin.objects.filter(
            gameday=OuterRef('gameday'),
            player=OuterRef('player')
        )
        return qs.annotate(arrived_at_court=Exists(checkin_exists))

    def court_checkin_status(self, obj):
        return obj.arrived_at_court
    court_checkin_status.boolean = True
    court_checkin_status.short_description = 'Na Quadra?'
    court_checkin_status.admin_order_field = 'arrived_at_court'
