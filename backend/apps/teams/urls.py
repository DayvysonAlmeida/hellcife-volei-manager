from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TeamGenerationViewSet

router = DefaultRouter()
router.register('', TeamGenerationViewSet, basename='team-generations')

urlpatterns = [
    path('', include(router.urls)),
]
