from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import HallOfFameEntry, RegulationText
from .serializers import HallOfFameSerializer, RegulationTextSerializer
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


class RegulationTextViewSet(viewsets.ModelViewSet):
    """Endpoint para gerenciar o texto do regulamento.
    - GET: aberto (quem vai se cadastrar lê o regulamento antes de aceitar).
    - POST/PUT/PATCH: apenas admin/moderador; sempre gravam no registro único (id=1).
    - DELETE não é permitido.
    """
    queryset = RegulationText.objects.all()
    serializer_class = RegulationTextSerializer
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update']:
            return [IsAdminOrModerator()]
        return [AllowAny()]

    def get_object(self):
        obj, _ = RegulationText.objects.get_or_create(
            pk=1,
            defaults={'content': '<p>Conteúdo do regulamento ainda não foi definido.</p>'},
        )
        return obj

    def list(self, request, *args, **kwargs):
        return Response(self.get_serializer(self.get_object()).data)

    def retrieve(self, request, *args, **kwargs):
        return self.list(request)

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            self.get_object(), data=request.data, partial=kwargs.get('partial', False)
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)
