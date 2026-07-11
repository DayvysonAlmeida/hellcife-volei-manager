from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EvaluationViewSet, EvaluationConfigViewSet

router = DefaultRouter()
router.register('configs', EvaluationConfigViewSet, basename='evaluation-configs')
router.register('', EvaluationViewSet, basename='evaluations')

urlpatterns = [
    path('', include(router.urls)),
]
