from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PlanViewSet, UserSubscriptionViewSet, AsaasWebhookView

router = DefaultRouter()
router.register(r'plans', PlanViewSet, basename='plan')
router.register(r'user-subscriptions', UserSubscriptionViewSet, basename='user-subscription')

urlpatterns = [
    path('', include(router.urls)),
    path('webhook/asaas/', AsaasWebhookView.as_view(), name='asaas-webhook'),
]
