from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HallOfFameViewSet

router = DefaultRouter()
router.register('', HallOfFameViewSet, basename='hall-of-fame')

urlpatterns = [
    path('', include(router.urls)),
]
