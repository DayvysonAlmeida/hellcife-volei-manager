"""
Cadastro de novos integrantes pelo app.

1. A pessoa se cadastra: a conta nasce com o e-mail não confirmado e o atleta "Aguardando aprovação"
   (fora das listas de presença, do sorteio e dos rankings, que só mostram atletas ativos).
2. Clica no link do e-mail (vale 48h, uma vez só). A staff recebe o aviso "Novo cadastro".
3. A staff aprova como atleta novo, vincula a um atleta que já existe sem acesso ao app, ou recusa.
"""
import logging
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core import signing
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.core.models import User
from apps.core.permissions import IsAdminOrModerator
from apps.notifications.models import Notification
from apps.notifications.services import notify
from .models import Player

logger = logging.getLogger(__name__)

CONFIRM_SALT = 'hellcife.signup.confirm-email'
CONFIRM_MAX_AGE = 48 * 60 * 60
MAX_AVATAR_BYTES = 5 * 1024 * 1024
# Mesma resposta exista ou não o e-mail: o cadastro não revela quem já tem conta
SIGNUP_DETAIL = 'Cadastro recebido! Enviamos um link para o seu e-mail: clique nele para confirmar.'
RESEND_DETAIL = 'Se houver um cadastro esperando confirmação com esse e-mail, enviamos um novo link.'


# Começo do arquivo de cada formato de foto aceito. O tipo informado pelo celular não basta: um SVG
# (que pode carregar código) chegaria dizendo ser "image/svg+xml".
IMAGE_SIGNATURES = (bytes([0xFF, 0xD8, 0xFF]), bytes([0x89]) + b'PNG' + bytes([0x0D, 0x0A, 0x1A, 0x0A]), b'GIF87a', b'GIF89a')
HEIF_BRANDS = (b'heic', b'heix', b'heif', b'hevc', b'mif1', b'msf1', b'avif')


def is_photo(upload):
    """JPEG, PNG, GIF, WebP ou HEIC/AVIF (fotos do iPhone e do Android), pelo conteúdo do arquivo."""
    head = upload.read(16)
    upload.seek(0)
    return (
        head.startswith(IMAGE_SIGNATURES)
        or (head[:4] == b'RIFF' and head[8:12] == b'WEBP')
        or (head[4:8] == b'ftyp' and head[8:12] in HEIF_BRANDS)
    )


def _frontend(path):
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def _send_email(user, subject, message, link=None):
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
    except Exception as exc:
        logger.warning('Falha ao enviar o e-mail do cadastro (usuário %s): %s', user.pk, exc)
        # O link dá acesso à conta: só aparece no terminal em desenvolvimento, nunca no log de produção
        if settings.DEBUG and link:
            print(f'Link do cadastro de {user.email}: {link}')


def confirmation_token(user):
    # O e-mail vai junto: se ele mudar, o link antigo deixa de valer
    return signing.dumps({'u': user.pk, 'e': user.email}, salt=CONFIRM_SALT)


def send_confirmation(user):
    link = _frontend(f'/confirmar-email?token={confirmation_token(user)}')
    _send_email(
        user, 'Hellcife Vôlei - Confirme seu cadastro',
        f'Olá, {user.name}!\n\nRecebemos o seu cadastro no Hellcife Vôlei. Clique no link abaixo para confirmar o seu '
        f'e-mail (ele vale por 48 horas):\n\n{link}\n\nDepois disso, a organização aprova o seu cadastro e você já pode '
        f'usar o app.\n\nSe não foi você, ignore este e-mail.',
        link,
    )


class SignupSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)                      # nome social: o que aparece no app
    legal_name = serializers.CharField(max_length=150, required=False, allow_blank=True)  # só a staff vê
    nickname = serializers.CharField(max_length=80, required=False, allow_blank=True)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, max_length=128, write_only=True)
    password_confirm = serializers.CharField(write_only=True)
    phone = serializers.CharField(max_length=20)
    gender = serializers.ChoiceField(choices=Player.GENDER_CHOICES)
    main_position = serializers.ChoiceField(choices=Player.POSITION_CHOICES)
    secondary_position = serializers.ChoiceField(choices=Player.POSITION_CHOICES, required=False, allow_blank=True)
    age = serializers.IntegerField(min_value=10, max_value=99, required=False, allow_null=True)
    height = serializers.DecimalField(
        max_digits=4, decimal_places=2, min_value=Decimal('1'), max_value=Decimal('2.5'), required=False, allow_null=True,
    )
    instagram = serializers.CharField(max_length=100, required=False, allow_blank=True)
    avatar = serializers.FileField(required=False, allow_null=True)
    accept_terms = serializers.BooleanField()
    website = serializers.CharField(required=False, allow_blank=True)  # isca para robôs: fica escondido no formulário

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError('Informe como você quer ser chamado no app.')
        return value

    def validate_email(self, value):
        return value.strip().lower()

    def validate_phone(self, value):
        digits = ''.join(c for c in value if c.isdigit())
        if not 10 <= len(digits) <= 13:
            raise serializers.ValidationError('Informe o WhatsApp com DDD.')
        return digits

    def validate_instagram(self, value):
        return value.strip().lstrip('@')

    def validate_avatar(self, value):
        if value and (value.size > MAX_AVATAR_BYTES or not is_photo(value)):
            raise serializers.ValidationError('A foto precisa ser uma imagem (JPG, PNG, WebP ou HEIC) de até 5 MB.')
        return value

    def validate_accept_terms(self, value):
        if not value:
            raise serializers.ValidationError('Para se cadastrar, aceite o regulamento e o uso dos seus dados.')
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'As senhas não são iguais.'})
        try:
            validate_password(attrs['password'])
        except Exception as exc:
            raise serializers.ValidationError({'password': list(getattr(exc, 'messages', [str(exc)]))})
        return attrs


class _PublicView(APIView):
    """Rotas abertas do cadastro: sem login (um token velho no navegador não atrapalha) e com limite de tentativas."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'signup'


class SignupView(_PublicView):
    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data.get('website'):
            return Response({'detail': SIGNUP_DETAIL}, status=status.HTTP_201_CREATED)  # robô: finge que deu certo

        existing = User.objects.filter(email__iexact=data['email']).first()
        if existing:
            if not existing.email_confirmed:
                send_confirmation(existing)  # tentou de novo antes de confirmar: manda o link outra vez
            else:
                _send_email(
                    existing, 'Hellcife Vôlei - Você já tem cadastro',
                    f'Olá, {existing.name}!\n\nAlguém tentou criar um cadastro com este e-mail, mas você já tem conta no '
                    f'Hellcife Vôlei. Para entrar, use "Esqueci minha senha" na tela de login.\n\nSe não foi você, ignore este e-mail.',
                )
            return Response({'detail': SIGNUP_DETAIL}, status=status.HTTP_201_CREATED)

        with transaction.atomic():
            user = User.objects.create_user(
                email=data['email'], password=data['password'], name=data['name'], profile='player', email_confirmed=False,
            )
            Player.objects.create(
                user=user,
                name=data['name'],
                legal_name=data.get('legal_name', '').strip(),
                nickname=data.get('nickname', '').strip() or None,
                phone=data['phone'],
                gender=data['gender'],
                main_position=data['main_position'],
                secondary_position=data.get('secondary_position') or None,
                age=data.get('age'),
                height=data.get('height'),
                instagram=data.get('instagram') or None,
                avatar=data.get('avatar'),
                status='pending',
                terms_accepted_at=timezone.now(),
            )
        send_confirmation(user)
        return Response({'detail': SIGNUP_DETAIL}, status=status.HTTP_201_CREATED)


class ResendConfirmationView(_PublicView):
    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        user = User.objects.filter(email__iexact=email, email_confirmed=False).first() if email else None
        if user:
            send_confirmation(user)
        return Response({'detail': RESEND_DETAIL})


class ConfirmEmailView(_PublicView):
    throttle_scope = 'confirm-email'

    def post(self, request):
        try:
            payload = signing.loads(str(request.data.get('token', '')), salt=CONFIRM_SALT, max_age=CONFIRM_MAX_AGE)
        except signing.SignatureExpired:
            return Response({'detail': 'Este link venceu. Peça um novo na tela de login.', 'code': 'expired'}, status=status.HTTP_400_BAD_REQUEST)
        except signing.BadSignature:
            return Response({'detail': 'Link inválido. Confira se copiou o link inteiro.', 'code': 'invalid'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(pk=payload.get('u'), email=payload.get('e')).first()
        if not user:
            return Response({'detail': 'Link inválido. Confira se copiou o link inteiro.', 'code': 'invalid'}, status=status.HTTP_400_BAD_REQUEST)
        if user.email_confirmed:
            return Response({'detail': 'Este link já foi usado. Entre com o seu e-mail e senha.', 'code': 'used'}, status=status.HTTP_400_BAD_REQUEST)

        user.email_confirmed = True
        user.save(update_fields=['email_confirmed'])
        player = Player.objects.filter(user=user, status='pending').first()
        if player:
            # Só agora a staff fica sabendo: cadastro com e-mail falso nunca chega até ela
            notify([
                Notification(
                    user=staff, title='Novo cadastro 🙋', type='system', url='/players?aba=pendentes',
                    message=f'{player.name} se cadastrou no app e está aguardando aprovação.',
                ) for staff in User.objects.filter(profile__in=('admin', 'moderator'), is_active=True)
            ])
        return Response({'detail': 'E-mail confirmado! Agora é só aguardar a organização aprovar o seu cadastro.'})


class PendingSignupSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)
    email_confirmed = serializers.BooleanField(source='user.email_confirmed', read_only=True)
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    main_position_display = serializers.CharField(source='get_main_position_display', read_only=True)
    secondary_position_display = serializers.CharField(source='get_secondary_position_display', read_only=True)
    avatar_url = serializers.CharField(read_only=True)

    class Meta:
        model = Player
        fields = [
            'id', 'name', 'legal_name', 'nickname', 'email', 'email_confirmed', 'phone', 'instagram',
            'gender', 'gender_display', 'main_position', 'main_position_display', 'secondary_position',
            'secondary_position_display', 'age', 'height', 'avatar_url', 'created_at',
        ]


class PendingSignupViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Cadastros esperando a staff: aprovar como atleta novo, vincular a um atleta que já existe ou recusar."""
    permission_classes = [IsAdminOrModerator]
    serializer_class = PendingSignupSerializer
    pagination_class = None

    def get_queryset(self):
        return Player.objects.filter(status='pending', user__isnull=False).select_related('user').order_by('created_at')

    @action(detail=False, methods=['get'])
    def candidates(self, request):
        """Atletas que ainda não têm acesso ao app: para o "É o atleta X" ligar a conta sem duplicar."""
        players = (Player.objects.filter(user__isnull=True, is_guest=False).exclude(status='pending')
                   .order_by('name').values('id', 'name', 'nickname', 'main_position', 'status'))
        return Response(list(players))

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        signup = self.get_object()
        user = signup.user
        target_id = request.data.get('player_id')
        with transaction.atomic():
            if target_id:
                # "É o atleta X": a conta passa para o atleta que já existe e o cadastro novo some (sem duplicar)
                target = (Player.objects.select_for_update()
                          .filter(pk=target_id, user__isnull=True, is_guest=False).exclude(status='pending').first())
                if not target:
                    return Response({'detail': 'Escolha um atleta que ainda não tem acesso ao app.'}, status=status.HTTP_400_BAD_REQUEST)
                signup.user = None
                signup.save(update_fields=['user'])
                target.user = user
                for field in ('legal_name', 'phone', 'instagram', 'age', 'height', 'avatar'):
                    if not getattr(target, field) and getattr(signup, field):
                        setattr(target, field, getattr(signup, field))
                target.terms_accepted_at = signup.terms_accepted_at
                target.save()
                signup.delete()
                player = target
            else:
                signup.status = 'active'
                signup.save(update_fields=['status'])
                player = signup
            # A staff conferiu a pessoa: o acesso vale mesmo que ela ainda não tenha clicado no link
            if not user.email_confirmed:
                user.email_confirmed = True
                user.save(update_fields=['email_confirmed'])

        notify([Notification(
            user=user, title='Cadastro aprovado! 🏐', type='system', url='/athlete',
            message='Bem-vindo ao Hellcife Vôlei! Seu cadastro foi aprovado e você já pode confirmar presença nos circuitos.',
        )])
        _send_email(
            user, 'Hellcife Vôlei - Cadastro aprovado',
            f'Olá, {player.display_name}!\n\nSeu cadastro no Hellcife Vôlei foi aprovado. Entre no app para confirmar '
            f'presença nos circuitos:\n\n{_frontend("/login")}\n\nTe vemos na quadra!',
        )
        return Response({'detail': f'{player.display_name} aprovado!', 'player_id': player.id})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        signup = self.get_object()
        user = signup.user
        _send_email(
            user, 'Hellcife Vôlei - Cadastro',
            f'Olá, {signup.name}!\n\nSeu cadastro no Hellcife Vôlei não foi aprovado. Se achar que foi um engano, fale com a organização.',
        )
        with transaction.atomic():
            signup.delete()
            user.delete()
        return Response({'detail': 'Cadastro recusado.'})
