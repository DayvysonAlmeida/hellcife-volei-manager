from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import TeamGeneration, Team, TeamPlayer
from .serializers import TeamGenerationSerializer, TeamSerializer, GenerateTeamsInputSerializer
from .algorithm import generate_teams
from apps.core.permissions import IsAdminOrModerator


class TeamGenerationViewSet(viewsets.ModelViewSet):
    queryset = TeamGeneration.objects.all().prefetch_related('teams__team_players__player')
    serializer_class = TeamGenerationSerializer
    permission_classes = [IsAdminOrModerator]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAdminOrModerator()]

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request):
        """Gera times balanceados (preview ou salvando)."""
        serializer = GenerateTeamsInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        result = generate_teams(
            modality=data['modality'],
            gameday_id=data.get('gameday_id'),
            player_ids=data.get('player_ids'),
        )

        if 'error' in result:
            return Response({'detail': result['error']}, status=status.HTTP_400_BAD_REQUEST)

        # Se solicitado, persiste no banco
        if data.get('save'):
            generation = TeamGeneration.objects.create(
                gameday_id=data.get('gameday_id'),
                modality=data['modality'],
                created_by=request.user,
                notes=data.get('notes', ''),
                balance_score=result['balance_score'],
            )
            for team_data in result['teams']:
                team = Team.objects.create(
                    generation=generation,
                    name=team_data['name'],
                    color=team_data['color'],
                    color_hex=team_data['color_hex'],
                    avg_overall=team_data['avg_overall'],
                    order=team_data['order'],
                )
                for i, player_data in enumerate(team_data['players']):
                    TeamPlayer.objects.create(
                        team=team,
                        player_id=player_data['id'],
                        order_in_team=i,
                    )
            result['generation_id'] = generation.id

        return Response(result)

    @action(detail=True, methods=['patch'], url_path='move-player')
    def move_player(self, request, pk=None):
        """Move um jogador de um time para outro dentro da geração."""
        generation = self.get_object()
        player_id = request.data.get('player_id')
        target_team_id = request.data.get('target_team_id')

        try:
            tp = TeamPlayer.objects.get(team__generation=generation, player_id=player_id)
            tp.team_id = target_team_id
            tp.save()
            # Recalcula overalls
            for team in generation.teams.all():
                players = [tp.player for tp in team.team_players.all()]
                if players:
                    overalls = [p.latest_overall or 5.0 for p in players]
                    team.avg_overall = round(sum(overalls) / len(overalls), 2)
                    team.save()
            return Response({'detail': 'Jogador movido com sucesso.'})
        except TeamPlayer.DoesNotExist:
            return Response({'detail': 'Jogador não encontrado nesta geração.'}, status=404)
