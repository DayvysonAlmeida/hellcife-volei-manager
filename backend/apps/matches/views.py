from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.core.cache import cache
from django.db import IntegrityError, transaction

from .models import Match, MatchTeam, MatchPlayer
from .serializers import MatchSerializer, MatchListSerializer, MatchWriteSerializer, MatchTeamSerializer
from apps.core.permissions import IsAdminOrModerator, IsAdminUser


AWARD_FIELDS = ['mvp', 'best_attacker', 'best_server', 'best_defender', 'best_setter', 'best_libero', 'best_blocker', 'best_opposite']


def _refresh_elo():
    """O Elo de cada um depende dos outros: qualquer mudança em partida refaz a temporada inteira."""
    from apps.players.elo_service import recalculate_all
    recalculate_all()
    cache.delete('dashboard_data')


def _create_match_teams(match, teams_data):
    """Cria os times da partida (com vencedor/empate) e seus jogadores."""
    scores = [t.get('score', 0) for t in teams_data]
    max_score = max(scores, default=0)
    is_draw = scores.count(max_score) > 1  # Empate: mais de 1 time com a pontuação máxima
    for team_data in teams_data:
        mt = MatchTeam.objects.create(
            match=match,
            team_name=team_data.get('team_name', ''),
            color_hex=team_data.get('color_hex', ''),
            score=team_data.get('score', 0),
            winner=not is_draw and team_data.get('score', 0) == max_score,
            team_id=team_data.get('team_id'),
        )
        _create_match_players(match, mt, team_data)


def _create_match_players(match, match_team, team_data):
    """Cria os jogadores de um time da partida (prêmios e empréstimos) em uma única query."""
    award_ids = {field: set(team_data.get(f'{field}_ids', [])) for field in AWARD_FIELDS}
    borrowed_ids = set(team_data.get('borrowed_ids', []))
    MatchPlayer.objects.bulk_create([
        MatchPlayer(
            match=match,
            player_id=player_id,
            match_team=match_team,
            is_borrowed=player_id in borrowed_ids,
            **{field: player_id in ids for field, ids in award_ids.items()},
        )
        for player_id in team_data.get('player_ids', [])
    ])


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

    def perform_update(self, serializer):
        serializer.save()
        _refresh_elo()  # a data pode ter mudado, e com ela a ordem das partidas

    def perform_destroy(self, instance):
        instance.delete()
        _refresh_elo()

    def get_queryset(self):
        qs = super().get_queryset()
        player_id = self.request.query_params.get('player_id')
        if player_id:
            qs = qs.filter(match_teams__match_players__player_id=player_id).distinct()
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return MatchListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return MatchWriteSerializer
        return MatchSerializer

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAdminUser()]
        if self.action in ['create', 'update', 'partial_update', 'add_result']:
            return [IsAdminOrModerator()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['post'], url_path='result')
    def add_result(self, request, pk=None):
        """Registra resultado de uma partida com times e placares."""
        match = self.get_object()
        teams_data = request.data.get('teams', [])

        # Tudo ou nada: se algo falhar, o resultado anterior continua intacto
        with transaction.atomic():
            MatchTeam.objects.filter(match=match).delete()
            MatchPlayer.objects.filter(match=match).delete()
            _create_match_teams(match, teams_data)

        # Invalidar cache do dashboard
        cache.delete('dashboard_data')

        from apps.core.utils.ranking_monitor import check_rank_changes
        check_rank_changes()

        _refresh_elo()
        return Response({'detail': 'Resultado registrado com sucesso.'})

    @action(detail=False, methods=['post'], url_path='quick')
    def quick_create(self, request):
        """Cria uma partida e registra o resultado em uma única chamada (usado no Chaveamento)"""
        match_data = request.data.get('match')
        teams_data = request.data.get('teams', [])

        if not match_data or not teams_data:
            return Response({'detail': 'Dados de partida e times são obrigatórios.'}, status=status.HTTP_400_BAD_REQUEST)

        # O mesmo jogo da fila salvo de novo (ex.: dois celulares na mesma quadra) devolve a partida que já existe
        bracket_key = str(request.data.get('bracket_key') or '')[:40] or None
        if bracket_key:
            existing = Match.objects.filter(bracket_key=bracket_key).first()
            if existing:
                return Response(MatchSerializer(existing).data, status=status.HTTP_200_OK)

        serializer = MatchWriteSerializer(data=match_data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        # Partida, times e jogadores numa transação só: se algo falhar, não sobra partida sem jogadores
        try:
            with transaction.atomic():
                match = serializer.save(bracket_key=bracket_key)
                _create_match_teams(match, teams_data)
        except IntegrityError:
            # Outro celular salvou o mesmo jogo no mesmo instante
            existing = Match.objects.filter(bracket_key=bracket_key).first() if bracket_key else None
            if not existing:
                raise
            return Response(MatchSerializer(existing).data, status=status.HTTP_200_OK)

        # Invalidar cache do dashboard
        cache.delete('dashboard_data')

        from apps.core.utils.ranking_monitor import check_rank_changes
        check_rank_changes()

        # Verificar e premiar Badges Automáticos para todos os jogadores da partida
        from apps.players.services import check_and_award_badges
        from apps.players.models import Player
        player_ids = set()
        for t in teams_data:
            player_ids.update(t.get('player_ids', []))
        for pid in player_ids:
            try:
                p = Player.objects.get(id=pid)
                check_and_award_badges(p)
            except Player.DoesNotExist:
                pass

        _refresh_elo()
        match.refresh_from_db()
        return Response(MatchSerializer(match).data, status=status.HTTP_201_CREATED)
