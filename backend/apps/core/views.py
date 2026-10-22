from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import User
from .serializers import (
    CustomTokenObtainPairSerializer, UserSerializer,
    UserCreateSerializer, UserUpdateSerializer, ChangePasswordSerializer,
    ForgotPasswordSerializer, ResetPasswordSerializer
)
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from .permissions import IsAdminUser, IsAdminOrModerator


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def put(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'old_password': 'Senha atual incorreta.'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'detail': 'Senha alterada com sucesso.'})


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['profile', 'is_active']
    search_fields = ['name', 'email']
    ordering_fields = ['name', 'date_joined']
    ordering = ['name']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer


class ForgotPasswordView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = ForgotPasswordSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Não retornar erro para não expor se o email existe ou não
            return Response({'detail': 'Se o email existir, um link de recuperação será enviado.'})

        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        reset_link = f"{frontend_url}/reset-password?uid={uidb64}&token={token}"
        
        # Tentativa de envio de email real (em Produção, caso as variáveis de SMTP estejam configuradas)
        try:
            subject = 'Hellcife Vôlei - Recuperação de Senha'
            message = f"Olá {user.name},\n\nVocê solicitou a recuperação de senha. Clique no link abaixo para criar uma nova senha:\n\n{reset_link}\n\nSe você não solicitou isso, ignore este e-mail."
            
            # Email origin (FROM)
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'nao-responda@hellcife.com.br')
            
            send_mail(
                subject,
                message,
                from_email,
                [user.email],
                fail_silently=False,
            )
            print(f"✅ E-mail enviado com sucesso para {user.email}")
        except Exception as e:
            print(f"⚠️ ERRO AO ENVIAR O E-MAIL DE RECUPERAÇÃO (usuário {user.pk}): {e}")
            # O link troca a senha de quem pediu: só aparece no terminal em desenvolvimento.
            # Em produção, o print vai para o log do Cloud Run, e quem lê o log não pode receber esse link.
            if settings.DEBUG:
                print("="*50)
                print("🔒 RECUPERAÇÃO DE SENHA SOLICITADA (SMTP não configurado ou falhou)")
                print(f"Usuário: {user.name} ({user.email})")
                print(f"Link de Recuperação: {reset_link}")
                print("="*50)
        
        return Response({'detail': 'Se o email existir, um link de recuperação será enviado.'})


class ResetPasswordView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = ResetPasswordSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        uid = force_str(urlsafe_base64_decode(serializer.validated_data['uidb64']))
        user = User.objects.get(pk=uid)
        
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        
        return Response({'detail': 'Senha redefinida com sucesso!'})
