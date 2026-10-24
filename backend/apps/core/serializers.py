from rest_framework import exceptions, serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['name'] = user.name
        token['profile'] = user.profile
        token['email'] = user.email
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        # Cadastro pelo app: só entra depois de clicar no link do e-mail (a senha já foi conferida acima)
        if not self.user.email_confirmed:
            raise exceptions.PermissionDenied({
                'detail': 'Confirme o seu e-mail para entrar: clique no link que enviamos.',
                'code': 'email_not_confirmed',
            })
        data['user'] = UserSerializer(self.user).data
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'profile', 'avatar_url', 'is_active', 'date_joined']
        read_only_fields = ['id', 'date_joined']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'name', 'profile', 'avatar_url', 'password', 'password_confirm']

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'As senhas não conferem.'})
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


def check_admin_removal(user, by):
    """Ninguém tira o próprio acesso de admin, e o clube nunca fica sem nenhum admin ativo."""
    if user.profile != 'admin':
        return
    if by and by.pk == user.pk:
        raise serializers.ValidationError({'profile': 'Você não pode tirar o seu próprio acesso de admin.'})
    if not User.objects.filter(profile='admin', is_active=True).exclude(pk=user.pk).exists():
        raise serializers.ValidationError({'profile': 'O clube precisa de pelo menos um admin.'})


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['name', 'profile', 'avatar_url', 'is_active']

    def validate(self, attrs):
        if attrs.get('profile', self.instance.profile) != 'admin' or attrs.get('is_active') is False:
            check_admin_removal(self.instance, getattr(self.context.get('request'), 'user', None))
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)  # mesma regra do cadastro
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'As senhas não são iguais.'})
        return data


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

class ResetPasswordSerializer(serializers.Serializer):
    uidb64 = serializers.CharField(write_only=True)
    token = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)  # mesma regra do cadastro
    
    def validate(self, data):
        try:
            uid = force_str(urlsafe_base64_decode(data['uidb64']))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError({"token": "Token inválido ou expirado."})
            
        if not default_token_generator.check_token(user, data['token']):
            raise serializers.ValidationError({"token": "Token inválido ou expirado."})
            
        return data
