from django.contrib import admin
from .models import GameDay, Attendance, AttendancePayment, CourtCheckin


class AttendanceInline(admin.TabularInline):
    model = Attendance
    extra = 0
    autocomplete_fields = ['player']


@admin.register(GameDay)
class GameDayAdmin(admin.ModelAdmin):
    list_display = ['date', 'description', 'location', 'total_present', 'total_players']
    search_fields = ['description', 'location']
    ordering = ['-date']
    date_hierarchy = 'date'
    inlines = [AttendanceInline]


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['player', 'gameday', 'present', 'checked_at']
    list_editable = ['present']
    list_filter = ['present', 'gameday']
    list_select_related = ['player', 'gameday']
    search_fields = ['player__name', 'player__nickname', 'gameday__description']
    autocomplete_fields = ['player', 'gameday']
    date_hierarchy = 'checked_at'


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
