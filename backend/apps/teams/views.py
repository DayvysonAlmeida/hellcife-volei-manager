from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Subquery, OuterRef, FloatField, Avg, Prefetch
from django.db.models.functions import Coalesce

from .models import TeamGeneration, Team, TeamPlayer
from .serializers import TeamGenerationSerializer, TeamSerializer, GenerateTeamsInputSerializer
from .algorithm import generate_teams
from apps.core.permissions import IsAdminOrModerator
from apps.evaluations.models import Evaluation
from apps.players.models import Player


class TeamGenerationViewSet(viewsets.ModelViewSet):
    serializer_class = TeamGenerationSerializer
    permission_classes = [IsAdminOrModerator]

    def get_queryset(self):
        # Prefetch otimizado: traz player + evaluations em poucos JOINs
        qs = (
            TeamGeneration.objects.all()
            .select_related('created_by', 'gameday')
            .prefetch_related(
                Prefetch(
                    'teams__team_players__player',
                    queryset=Player.objects.prefetch_related('evaluations')
                )
            )
        )
        gameday_id = self.request.query_params.get('gameday_id')
        if gameday_id:
            qs = qs.filter(gameday_id=gameday_id)
        return qs

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

        # Se solicitado, persiste no banco (apenas por compatibilidade)
        if data.get('save'):
            generation = self._save_generation(
                request.user, 
                data['modality'], 
                data.get('gameday_id'), 
                data.get('notes', ''), 
                result
            )
            result['generation_id'] = generation.id

        return Response(result)

    def _save_generation(self, user, modality, gameday_id, notes, result_data):
        generation = TeamGeneration.objects.create(
            gameday_id=gameday_id,
            modality=modality,
            created_by=user,
            notes=notes,
            balance_score=result_data['balance_score'],
        )
        for team_data in result_data['teams']:
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
        return generation

    @action(detail=False, methods=['post'], url_path='save-generated')
    def save_generated(self, request):
        """Salva exatamente os times que foram enviados (após visualização pelo usuário)."""
        data = request.data
        modality = data.get('modality')
        gameday_id = data.get('gameday_id')
        notes = data.get('notes', '')
        result = data.get('result')

        if not result or not modality:
            return Response({'detail': 'Dados inválidos.'}, status=status.HTTP_400_BAD_REQUEST)

        generation = self._save_generation(request.user, modality, gameday_id, notes, result)
        
        return Response({
            'detail': 'Times salvos com sucesso!',
            'generation_id': generation.id
        })

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

            # Recalcula overalls com Subquery (sem loop N+1)
            latest_eval_subquery = Subquery(
                Evaluation.objects.filter(
                    player=OuterRef('player')
                ).order_by('-date').values('overall')[:1],
                output_field=FloatField()
            )

            for team in generation.teams.all():
                avg = (
                    TeamPlayer.objects.filter(team=team)
                    .annotate(
                        player_overall=Coalesce(latest_eval_subquery, 5.0)
                    )
                    .aggregate(avg_overall=Avg('player_overall'))
                )
                team.avg_overall = round(avg['avg_overall'] or 0, 2)
                team.save(update_fields=['avg_overall'])

            return Response({'detail': 'Jogador movido com sucesso.'})
        except TeamPlayer.DoesNotExist:
            return Response({'detail': 'Jogador não encontrado nesta geração.'}, status=404)
