from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),
    # API Schema
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    # Apps
    path('api/auth/', include('apps.core.urls')),
    path('api/players/', include('apps.players.urls')),
    path('api/evaluations/', include('apps.evaluations.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/teams/', include('apps.teams.urls')),
    path('api/matches/', include('apps.matches.urls')),
    path('api/hall-of-fame/', include('apps.halloffame.urls')),
    path('api/dashboard/', include('apps.core.dashboard_urls')),
    path('api/', include('apps.notifications.urls')),
    path('api/subscriptions/', include('apps.subscriptions.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
