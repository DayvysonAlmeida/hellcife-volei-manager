from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HallOfFameViewSet, RegulationTextViewSet

router = DefaultRouter()
router.register('', HallOfFameViewSet, basename='hall-of-fame')

regulation_router = DefaultRouter()
regulation_router.register('', RegulationTextViewSet, basename='regulation')

# 'regulation/' precisa vir antes do router do Hall da Fama: a rota de detalhe
# dele (^<pk>/$) capturaria 'regulation/' como se fosse um pk.
urlpatterns = [
    path('regulation/', include(regulation_router.urls)),
    path('', include(router.urls)),
]
