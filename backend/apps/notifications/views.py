from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Notification, GlobalAnnouncement
from .serializers import NotificationSerializer

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
