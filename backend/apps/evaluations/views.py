import json
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import Evaluation, EvaluationConfig, EvaluationHistory
from .serializers import EvaluationSerializer, EvaluationConfigSerializer, EvaluationHistorySerializer
from apps.core.permissions import IsAdminOrModerator


class EvaluationViewSet(viewsets.ModelViewSet):
    queryset = Evaluation.objects.all().select_related('player', 'evaluator')
    serializer_class = EvaluationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['player', 'evaluator']
    search_fields = ['player__name', 'player__nickname']
    ordering_fields = ['date', 'overall', 'created_at']
    ordering = ['-date']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrModerator()]
        return [IsAuthenticated()]

    def perform_update(self, serializer):
        # Salva histórico antes de atualizar
        old = self.get_object()
        old_data = EvaluationSerializer(old).data
        instance = serializer.save()
        new_data = EvaluationSerializer(instance).data
        EvaluationHistory.objects.create(
            evaluation=instance,
            changed_by=self.request.user,
            previous_data=old_data,
            new_data=new_data,
        )

    @action(detail=False, methods=['get'], url_path='by-player/(?P<player_id>[^/.]+)')
    def by_player(self, request, player_id=None):
        evaluations = Evaluation.objects.filter(player_id=player_id).order_by('-date')
        serializer = self.get_serializer(evaluations, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='radar/(?P<player_id>[^/.]+)')
    def radar(self, request, player_id=None):
        """Retorna dados para gráfico radar do último overall de um jogador."""
        eval_ = Evaluation.objects.filter(player_id=player_id).order_by('-date').first()
        if not eval_:
            return Response({'detail': 'Nenhuma avaliação encontrada.'}, status=404)
        return Response({
            'player_id': player_id,
            'date': eval_.date,
            'overall': eval_.overall,
            'skills': {
                'Saque': eval_.serve,
                'Recepção': eval_.reception,
                'Passe': eval_.passing,
                'Levantamento': eval_.setting,
                'Ataque': eval_.attack,
                'Bloqueio': eval_.block,
                'Defesa': eval_.defense,
                'Recuperação': eval_.recovery,
                'Posicionamento': eval_.positioning,
                'Comunicação': eval_.communication,
                'Int. Tática': eval_.tactical_iq,
                'Condicionamento': eval_.conditioning,
                'Regularidade': eval_.consistency,
            }
        })


class EvaluationConfigViewSet(viewsets.ModelViewSet):
    queryset = EvaluationConfig.objects.all()
    serializer_class = EvaluationConfigSerializer
    permission_classes = [IsAdminOrModerator]

    @action(detail=True, methods=['post'], url_path='set-active')
    def set_active(self, request, pk=None):
        EvaluationConfig.objects.update(is_active=False)
        config = self.get_object()
        config.is_active = True
        config.save()
        return Response({'detail': f'Configuração "{config.name}" definida como ativa.'})
