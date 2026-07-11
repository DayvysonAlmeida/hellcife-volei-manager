from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'name', 'profile', 'is_active', 'date_joined']
    list_filter = ['profile', 'is_active']
    search_fields = ['email', 'name']
    ordering = ['name']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Informações pessoais', {'fields': ('name', 'avatar_url')}),
        ('Permissões', {'fields': ('profile', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Datas', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'name', 'profile', 'password1', 'password2'),
        }),
    )
    readonly_fields = ['date_joined']
