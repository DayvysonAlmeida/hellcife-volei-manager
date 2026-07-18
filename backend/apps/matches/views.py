from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import Match, MatchTeam, MatchPlayer
from .serializers import MatchSerializer, MatchListSerializer, MatchWriteSerializer, MatchTeamSerializer
from apps.core.permissions import IsAdminOrModerator


class MatchViewSet(viewsets.ModelViewSet):
    queryset = Match.objects.all().select_related(
        'created_by', 'team_generation'
    ).prefetch_related(
        'match_teams__match_players__player'
    )
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['modality', 'gameday', 'team_generation']
    search_fields = ['location', 'notes']
    ordering_fields = ['date', 'created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return MatchListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return MatchWriteSerializer
        return MatchSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'add_result']:
            return [IsAdminOrModerator()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['post'], url_path='result')
    def add_result(self, request, pk=None):
        """Registra resultado de uma partida com times e placares."""
        match = self.get_object()
        teams_data = request.data.get('teams', [])

        # Limpa resultado anterior
        MatchTeam.objects.filter(match=match).delete()
        MatchPlayer.objects.filter(match=match).delete()

        max_score = max((t.get('score', 0) for t in teams_data), default=0)
        for team_data in teams_data:
            mt = MatchTeam.objects.create(
                match=match,
                team_name=team_data.get('team_name', ''),
                color_hex=team_data.get('color_hex', ''),
                score=team_data.get('score', 0),
                winner=team_data.get('score', 0) == max_score,
                team_id=team_data.get('team_id'),
            )
            # Adiciona jogadores ao time usando bulk_create (super rápido)
            match_players = []
            for player_id in team_data.get('player_ids', []):
                match_players.append(MatchPlayer(
                    match=match,
                    player_id=player_id,
                    match_team=mt,
                    mvp=player_id in team_data.get('mvp_ids', []),
                    best_attacker=player_id in team_data.get('best_attacker_ids', []),
                    best_server=player_id in team_data.get('best_server_ids', []),
                    best_defender=player_id in team_data.get('best_defender_ids', [])
                ))
            MatchPlayer.objects.bulk_create(match_players)

        return Response({'detail': 'Resultado registrado com sucesso.'})

    @action(detail=False, methods=['post'], url_path='quick')
    def quick_create(self, request):
        """Cria uma partida e registra o resultado em uma única chamada (usado no Chaveamento)"""
        match_data = request.data.get('match')
        teams_data = request.data.get('teams', [])

        if not match_data or not teams_data:
            return Response({'detail': 'Dados de partida e times são obrigatórios.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Cria a partida
        serializer = MatchWriteSerializer(data=match_data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        match = serializer.save()

        # 2. Cria os times e resultados
        max_score = max((t.get('score', 0) for t in teams_data), default=0)
        for team_data in teams_data:
            mt = MatchTeam.objects.create(
                match=match,
                team_name=team_data.get('team_name', ''),
                color_hex=team_data.get('color_hex', ''),
                score=team_data.get('score', 0),
                winner=team_data.get('score', 0) == max_score,
                team_id=team_data.get('team_id'),
            )
            # Adiciona jogadores ao time usando bulk_create (super rápido)
            match_players = []
            for player_id in team_data.get('player_ids', []):
                match_players.append(MatchPlayer(
                    match=match,
                    player_id=player_id,
                    match_team=mt,
                    mvp=player_id in team_data.get('mvp_ids', []),
                    best_attacker=player_id in team_data.get('best_attacker_ids', []),
                    best_server=player_id in team_data.get('best_server_ids', []),
                    best_defender=player_id in team_data.get('best_defender_ids', [])
                ))
            MatchPlayer.objects.bulk_create(match_players)

        return Response(MatchSerializer(match).data, status=status.HTTP_201_CREATED)
