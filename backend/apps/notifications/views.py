from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
import time
from datetime import timedelta

from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle
from django.conf import settings
from django.utils import timezone
from apps.core.permissions import is_staff_profile
from .models import Notification, GlobalAnnouncement, PushSubscription
from .push import MAX_SUBSCRIPTIONS_PER_USER, device_label, key_status, push_enabled, send_test_push
from .serializers import NotificationSerializer, PushSubscriptionSerializer

class PushTestThrottle(UserRateThrottle):
    rate = '12/hour'  # teste de notificação: o bastante para ajustar o celular, sem virar spam


LIST_LIMIT = 50   # o sininho busca a cada 30s: só as mais recentes
KEEP_READ_DAYS = 90


def _clean_old(user):
    """Avisos já lidos com mais de 90 dias somem (feito quando o usuário lê, não a cada busca)."""
    Notification.objects.filter(user=user, is_read=True, created_at__lt=timezone.now() - timedelta(days=KEEP_READ_DAYS)).delete()


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    http_method_names = ['get', 'post', 'delete', 'head', 'options']  # criar e editar aviso é só pelo servidor

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        notifications = self.get_queryset().order_by('-created_at')[:LIST_LIMIT]
        return Response(self.get_serializer(notifications, many=True).data)

    def create(self, request, *args, **kwargs):
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'notification marked as read'})

    @action(detail=False, methods=['post'])
    def read_all(self, request):
        notifications = self.get_queryset().filter(is_read=False)
        notifications.update(is_read=True)
        _clean_old(request.user)
        return Response({'status': 'all notifications marked as read'})

    @action(detail=False, methods=['post'])
    def global_announcement(self, request):
        if request.user.profile not in ['admin', 'moderator']:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        
        title = request.data.get('title')
        message = request.data.get('message')
        if not title or not message:
            return Response({'error': 'Title and message are required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        announcement = GlobalAnnouncement.objects.create(title=title, message=message)
        return Response({'status': 'Global announcement sent.', 'id': announcement.id}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='push/key')
    def push_key(self, request):
        """Chave pública do Web Push; nula quando o push está desligado no servidor."""
        return Response({'public_key': settings.VAPID_PUBLIC_KEY if push_enabled() else None})

    @action(detail=False, methods=['post'], url_path='push/subscribe')
    def push_subscribe(self, request):
        if not push_enabled():
            return Response({'error': 'Push desligado no servidor.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        serializer = PushSubscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # O endpoint é do aparelho: se outra conta entrar nele, a inscrição passa para ela
        PushSubscription.objects.update_or_create(
            endpoint=data['endpoint'],
            defaults={
                'user': request.user, 'p256dh': data['keys']['p256dh'], 'auth': data['keys']['auth'],
                'user_agent': request.META.get('HTTP_USER_AGENT', '')[:300],
            },
        )

        # Fica só com os aparelhos usados mais recentemente
        keep = list(
            request.user.push_subscriptions.order_by('-updated_at', '-id').values_list('id', flat=True)[:MAX_SUBSCRIPTIONS_PER_USER]
        )
        request.user.push_subscriptions.exclude(id__in=keep).delete()
        return Response({'status': 'subscribed'}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='push/unsubscribe')
    def push_unsubscribe(self, request):
        endpoint = request.data.get('endpoint')
        if endpoint:
            PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='push/status')
    def push_status(self, request):
        """Diagnóstico: o push está ligado e com chaves certas no servidor, e como estão os aparelhos desta conta."""
        return Response({
            'server': key_status(),
            'devices': [
                {
                    'endpoint': sub.endpoint, 'device': device_label(sub.user_agent), 'created_at': sub.created_at,
                    'last_success_at': sub.last_success_at, 'last_error': sub.last_error,
                } for sub in request.user.push_subscriptions.all()
            ],
        })

    @action(detail=False, methods=['post'], url_path='push/test', throttle_classes=[PushTestThrottle])
    def push_test(self, request):
        """
        Manda uma notificação de teste aos aparelhos desta conta. Com "delay" (até 15s) o servidor espera antes,
        para dar tempo de bloquear a tela do celular.
        """
        if key_status() != 'ok':
            return Response({'detail': 'O push está desligado ou com as chaves erradas no servidor.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if not request.user.push_subscriptions.exists():
            return Response({'detail': 'Nenhum aparelho inscrito. Ative as notificações neste aparelho primeiro.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            delay = max(0, min(15, int(request.data.get('delay', 0))))
        except (TypeError, ValueError):
            delay = 0
        time.sleep(delay)
        return Response({'results': send_test_push(request.user)})

    @action(detail=False, methods=['get'], url_path='push/stats')
    def push_stats(self, request):
        """Para a staff: quantos atletas recebem as notificações no celular, e quem ainda não ativou."""
        if not is_staff_profile(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        from .services import athlete_audience
        audience = athlete_audience().select_related('player_profile').order_by('name')
        with_push = set(PushSubscription.objects.filter(user__in=audience).values_list('user_id', flat=True))
        without = [u.name for u in audience if u.id not in with_push]
        return Response({'athletes': len(with_push) + len(without), 'with_push': len(with_push), 'without': without})
