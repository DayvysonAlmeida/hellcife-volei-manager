from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import HallOfFameEntry
from .serializers import HallOfFameSerializer
from apps.core.permissions import IsAdminOrModerator


class HallOfFameViewSet(viewsets.ModelViewSet):
    queryset = HallOfFameEntry.objects.all().select_related('player', 'awarded_by')
    serializer_class = HallOfFameSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['category', 'year']
    ordering_fields = ['year', 'category']
    ordering = ['-year']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrModerator()]
        return [IsAuthenticated()]
