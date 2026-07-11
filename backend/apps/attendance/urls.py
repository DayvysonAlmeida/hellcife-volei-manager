from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GameDayViewSet, AttendanceViewSet

router = DefaultRouter()
router.register('gamedays', GameDayViewSet, basename='gamedays')
router.register('records', AttendanceViewSet, basename='attendance-records')

urlpatterns = [
    path('', include(router.urls)),
]
