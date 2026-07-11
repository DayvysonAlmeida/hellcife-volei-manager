from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count

from .models import Player
from .serializers import PlayerListSerializer, PlayerDetailSerializer, PlayerWriteSerializer
from .filters import PlayerFilter
from apps.core.permissions import IsAdminOrModerator
from apps.matches.models import MatchPlayer
from apps.attendance.models import Attendance, GameDay


class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all().prefetch_related('evaluations')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PlayerFilter
    search_fields = ['name', 'nickname', 'shirt_number']
    ordering_fields = ['name', 'shirt_number', 'created_at']
    ordering = ['name']

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
        players = Player.objects.filter(status='active').prefetch_related('evaluations')
        if position:
            players = players.filter(main_position=position)

        player_data = []
        for p in players:
            last_eval = p.evaluations.order_by('-date').first()
            if last_eval:
                player_data.append({
                    'id': p.id,
                    'name': p.name,
                    'nickname': p.nickname,
                    'main_position': p.main_position,
                    'main_position_display': p.get_main_position_display(),
                    'avatar_url': p.avatar_url,
                    'shirt_number': p.shirt_number,
                    'overall': last_eval.overall,
                })

        player_data.sort(key=lambda x: x['overall'], reverse=True)
        return Response(player_data)

    @action(detail=True, methods=['get'], url_path='stats')
    def stats(self, request, pk=None):
        player = self.get_object()

        match_players = MatchPlayer.objects.filter(player=player)
        total_matches = match_players.count()
        mvps = match_players.filter(mvp=True).count()

        # Vitórias e derrotas calculadas via resultados de partidas
        wins = 0
        losses = 0
        for mp in match_players.select_related('match_team', 'match'):
            match = mp.match
            if mp.match_team:
                opponent_scores = match.match_teams.exclude(id=mp.match_team.id)
                max_opponent = max((t.score for t in opponent_scores), default=0)
                if mp.match_team.score > max_opponent:
                    wins += 1
                elif mp.match_team.score < max_opponent:
                    losses += 1

        win_rate = round(wins / total_matches * 100, 1) if total_matches > 0 else 0

        # Presença
        total_gamedays = GameDay.objects.count()
        attended = Attendance.objects.filter(player=player, present=True).count()
        attendance_rate = round(attended / total_gamedays * 100, 1) if total_gamedays > 0 else 0

        # Histórico de overall
        evaluations = player.evaluations.order_by('date').values('date', 'overall')

        return Response({
            'player_id': player.id,
            'total_matches': total_matches,
            'wins': wins,
            'losses': losses,
            'draws': total_matches - wins - losses,
            'win_rate': win_rate,
            'mvps': mvps,
            'total_gamedays': total_gamedays,
            'attended_gamedays': attended,
            'attendance_rate': attendance_rate,
            'overall_history': list(evaluations),
        })
