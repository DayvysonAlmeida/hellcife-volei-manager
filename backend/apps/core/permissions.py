from rest_framework.permissions import BasePermission


def is_staff_profile(user):
    """Admin ou moderador: a staff do clube."""
    return getattr(user, 'profile', None) in ('admin', 'moderator')


class ApiDocsPermission(BasePermission):
    """Mapa da API: livre em desenvolvimento; em produção, só para o admin (não fica exposto na internet)."""
    def has_permission(self, request, view):
        from django.conf import settings
        return settings.DEBUG or getattr(request.user, 'profile', None) == 'admin'


class IsAdminUser(BasePermission):
    """Apenas administradores têm acesso."""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.profile == 'admin'


class IsAdminOrModerator(BasePermission):
    """Administradores e Moderadores têm acesso."""
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.profile in ('admin', 'moderator')
        )


class IsOwnerOrAdmin(BasePermission):
    """Dono do recurso ou admin."""
    def has_object_permission(self, request, view, obj):
        if request.user.profile == 'admin':
            return True
        return hasattr(obj, 'user') and obj.user == request.user
