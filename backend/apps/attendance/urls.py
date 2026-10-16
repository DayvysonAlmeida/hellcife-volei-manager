from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GameDayViewSet, AttendanceViewSet, CourtCheckinViewSet, CircuitFinanceViewSet

router = DefaultRouter()
router.register('gamedays', GameDayViewSet, basename='gamedays')
router.register('records', AttendanceViewSet, basename='attendance-records')
router.register('court-checkins', CourtCheckinViewSet, basename='court-checkins')
router.register('finance', CircuitFinanceViewSet, basename='circuit-finance')

urlpatterns = [
    path('', include(router.urls)),
]
