from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomTokenObtainPairView, MeView, UserViewSet,
    ForgotPasswordView, ResetPasswordView, ChangePasswordView
)
from apps.players.signup import ConfirmEmailView, ResendConfirmationView, SignupView

router = DefaultRouter()
router.register('users', UserViewSet, basename='users')

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot_password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset_password'),
    # Cadastro de novos integrantes pelo app
    path('signup/', SignupView.as_view(), name='signup'),
    path('confirm-email/', ConfirmEmailView.as_view(), name='confirm_email'),
    path('resend-confirmation/', ResendConfirmationView.as_view(), name='resend_confirmation'),
    path('', include(router.urls)),
]
