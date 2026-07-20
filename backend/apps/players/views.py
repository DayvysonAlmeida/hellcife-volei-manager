from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q, Subquery, OuterRef, FloatField, Case, When, IntegerField
from django.db.models.functions import Coalesce

from .models import Player
from .serializers import PlayerListSerializer, PlayerDetailSerializer, PlayerWriteSerializer
from .filters import PlayerFilter
from apps.core.permissions import IsAdminOrModerator
from apps.evaluations.models import Evaluation
from apps.matches.models import MatchPlayer
from apps.attendance.models import Attendance, GameDay


# Subquery reutilizável para pegar o overall mais recente
def latest_overall_subquery():
    return Subquery(
        Evaluation.objects.filter(
            player=OuterRef('pk')
        ).order_by('-date').values('overall')[:1],
        output_field=FloatField()
    )


class PlayerViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PlayerFilter
    search_fields = ['name', 'nickname', 'shirt_number']
    ordering_fields = ['name', 'shirt_number', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        qs = Player.objects.all()

        if 'include_guests' in self.request.query_params:
            pass
        elif 'is_guest' not in self.request.query_params:
            qs = qs.filter(is_guest=False)

        # Na listagem, anotar o overall mais recente via subquery para eliminar N+1.
        # O serializer usa a annotation quando disponível, evitando 1 query por jogador.
        if self.action == 'list':
            qs = qs.annotate(
                annotated_overall=latest_overall_subquery()
            )
        else:
            # Para outras actions, prefetch para uso em PlayerDetailSerializer
            qs = qs.prefetch_related('evaluations')

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return PlayerListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return PlayerWriteSerializer
        return PlayerDetailSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrModerator()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'], url_path='ranking')
    def ranking(self, request):
        position = request.query_params.get('position')

        # Uma única query com annotations para overall, stats de partidas
        players = (
            Player.objects.filter(status='active')
            .annotate(
                annotated_overall=Coalesce(latest_overall_subquery(), 0.0),
                total_matches=Count('match_appearances', distinct=True),
                mvps=Count('match_appearances', filter=Q(match_appearances__mvp=True), distinct=True),
                best_attackers=Count('match_appearances', filter=Q(match_appearances__best_attacker=True), distinct=True),
                best_servers=Count('match_appearances', filter=Q(match_appearances__best_server=True), distinct=True),
                best_defenders=Count('match_appearances', filter=Q(match_appearances__best_defender=True), distinct=True),
                wins=Count('match_appearances', filter=Q(match_appearances__match_team__winner=True), distinct=True),
            )
            .filter(annotated_overall__gt=0)  # Apenas jogadores com avaliação
        )

        if position:
            players = players.filter(main_position=position)

        # Ordena por overall e retorna tudo em 1 query
        players = players.order_by('-annotated_overall')

        player_data = []
        for p in players:
            win_rate = (p.wins / p.total_matches * 100) if p.total_matches > 0 else 0
            avatar_url = f"/media/{p.avatar}" if p.avatar else None

            player_data.append({
                'id': p.id,
                'name': p.name,
                'nickname': p.nickname,
                'main_position': p.main_position,
                'main_position_display': p.get_main_position_display(),
                'avatar_url': avatar_url,
                'shirt_number': p.shirt_number,
                'overall': round(p.annotated_overall, 2),
                'stats': {
                    'matches': p.total_matches,
                    'win_rate': round(win_rate, 1),
                    'mvp': p.mvps,
                    'best_attacker': p.best_attackers,
                    'best_server': p.best_servers,
                    'best_defender': p.best_defenders,
                }
            })

        return Response(player_data)

    @action(detail=True, methods=['get'], url_path='stats')
    def stats(self, request, pk=None):
        player = self.get_object()

        # Usa annotations ao invés de loop Python para calcular vitórias/derrotas
        match_stats = MatchPlayer.objects.filter(player=player).aggregate(
            total_matches=Count('id'),
            mvps=Count('id', filter=Q(mvp=True)),
            wins=Count('id', filter=Q(match_team__winner=True)),
            losses=Count('id', filter=Q(
                match_team__isnull=False,
                match_team__winner=False,
            )),
        )

        total_matches = match_stats['total_matches']
        wins = match_stats['wins']
        losses = match_stats['losses']
        mvps = match_stats['mvps']
        draws = total_matches - wins - losses
        win_rate = round(wins / total_matches * 100, 1) if total_matches > 0 else 0

        # Presença (2 queries simples)
        total_gamedays = GameDay.objects.count()
        attended = Attendance.objects.filter(player=player, present=True).count()
        attendance_rate = round(attended / total_gamedays * 100, 1) if total_gamedays > 0 else 0

        # Histórico de overall (1 query)
        evaluations = player.evaluations.order_by('date').values('date', 'overall')

        return Response({
            'player_id': player.id,
            'total_matches': total_matches,
            'wins': wins,
            'losses': losses,
            'draws': draws,
            'win_rate': win_rate,
            'mvps': mvps,
            'total_gamedays': total_gamedays,
            'attended_gamedays': attended,
            'attendance_rate': attendance_rate,
            'overall_history': list(evaluations),
        })
