from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PlayerViewSet, BadgeViewSet

router = DefaultRouter()
router.register('badges', BadgeViewSet, basename='badges')
router.register('', PlayerViewSet, basename='players')

urlpatterns = [
    path('', include(router.urls)),
]
