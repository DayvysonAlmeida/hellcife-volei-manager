from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from .models import Notification, GlobalAnnouncement, PushSubscription
from .push import MAX_SUBSCRIPTIONS_PER_USER, push_enabled
from .serializers import NotificationSerializer, PushSubscriptionSerializer

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

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
            defaults={'user': request.user, 'p256dh': data['keys']['p256dh'], 'auth': data['keys']['auth']},
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
