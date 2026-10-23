from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PlayerViewSet, BadgeViewSet
from .signup import PendingSignupViewSet

router = DefaultRouter()
router.register('badges', BadgeViewSet, basename='badges')
router.register('signups', PendingSignupViewSet, basename='signups')  # antes do '' para não virar /players/<id>/
router.register('', PlayerViewSet, basename='players')

urlpatterns = [
    path('', include(router.urls)),
]
