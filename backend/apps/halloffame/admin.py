from django.contrib import admin
from .models import HallOfFameEntry


@admin.register(HallOfFameEntry)
class HallOfFameAdmin(admin.ModelAdmin):
    list_display = ['get_category_display', 'player', 'year', 'awarded_by']
    list_filter = ['category', 'year']
    ordering = ['-year']
