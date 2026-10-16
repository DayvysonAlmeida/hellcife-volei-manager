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
                ),
                'removed_players',
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

    @action(detail=True, methods=['post'], url_path='lock')
    def lock(self, request, pk=None):
        """Tranca a geração de times e o circuito inteiro, impedindo alterações."""
        generation = self.get_object()
        
        # Tranca a geração atual
        generation.is_locked = True
        generation.save(update_fields=['is_locked'])
        
        # Encerra o GameDay e tranca todas as outras gerações associadas
        if generation.gameday:
            generation.gameday.is_closed = True
            generation.gameday.save(update_fields=['is_closed'])
            # Tranca outras gerações do mesmo circuito
            generation.gameday.team_generations.filter(is_locked=False).update(is_locked=True)
            
            # Sincroniza faltas usando a fonte da verdade única
            from apps.attendance.views import sync_absences_logic
            sync_absences_logic()
            
        return Response({'detail': 'Pelada e Circuito encerrados com sucesso.'})

    def _recalculate_generation_overalls(self, generation):
        from .algorithm import get_players_with_overall, calculate_balance_score
        
        teams_players_list = []
        
        for team in generation.teams.all():
            player_ids = list(team.team_players.values_list('player_id', flat=True))
            if not player_ids:
                team.avg_overall = 0.0
                team.save(update_fields=['avg_overall'])
                continue
                
            players_data = get_players_with_overall(player_ids=player_ids)
            
            # Extract overalls
            if players_data:
                avg = sum(p['overall'] for p in players_data) / len(players_data)
                team.avg_overall = round(avg, 2)
                teams_players_list.append(players_data)
            else:
                team.avg_overall = 0.0
                
            team.save(update_fields=['avg_overall'])
            
        # Recalculate balance score
        if len(teams_players_list) >= 2:
            generation.balance_score = calculate_balance_score(teams_players_list)
        else:
            generation.balance_score = 0.0
        generation.save(update_fields=['balance_score'])

    @action(detail=True, methods=['patch'], url_path='move-player')
    def move_player(self, request, pk=None):
        """Move um jogador de um time para outro dentro da geração."""
        generation = self.get_object()
        
        if generation.is_locked:
            return Response({'detail': 'Esta geração de times está trancada e não pode ser alterada.'}, status=status.HTTP_400_BAD_REQUEST)

        player_id = request.data.get('player_id')
        target_team_id = request.data.get('target_team_id')

        try:
            tp = TeamPlayer.objects.get(team__generation=generation, player_id=player_id)
            tp.team_id = target_team_id
            tp.save()
            self._recalculate_generation_overalls(generation)
            return Response({'detail': 'Jogador movido com sucesso.'})
        except TeamPlayer.DoesNotExist:
            return Response({'detail': 'Jogador não encontrado nesta geração.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='add-player')
    def add_player(self, request, pk=None):
        """Adiciona um jogador a um time de uma geração em andamento."""
        generation = self.get_object()
        
        if generation.is_locked:
            return Response({'detail': 'Esta geração de times está trancada e não pode ser alterada.'}, status=status.HTTP_400_BAD_REQUEST)

        player_id = request.data.get('player_id')
        team_id = request.data.get('team_id')

        if not player_id or not team_id:
            return Response({'detail': 'ID do jogador e do time são obrigatórios.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verifica se o jogador já não está na geração
        if TeamPlayer.objects.filter(team__generation=generation, player_id=player_id).exists():
            return Response({'detail': 'Jogador já está participando desta pelada.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            team = generation.teams.get(id=team_id)
            # Pega a maior ordem no time
            max_order = TeamPlayer.objects.filter(team=team).count()
            
            TeamPlayer.objects.create(
                team=team,
                player_id=player_id,
                order_in_team=max_order
            )
            generation.removed_players.remove(player_id)
            
            # Sincroniza com a Quadra: se ele foi adicionado no time manualmente, ele está na quadra
            if generation.gameday_id:
                from apps.attendance.models import CourtCheckin
                CourtCheckin.objects.get_or_create(gameday_id=generation.gameday_id, player_id=player_id)
                
            self._recalculate_generation_overalls(generation)
            return Response({'detail': 'Jogador adicionado com sucesso ao time.'})
        except Team.DoesNotExist:
            return Response({'detail': 'Time não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='add-team')
    def add_team(self, request, pk=None):
        """Adiciona um time vazio a esta geração."""
        generation = self.get_object()
        if generation.is_locked:
            return Response({'detail': 'Esta geração está trancada.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Encontra o próximo nome/letra disponível (Time A, Time B, etc)
        existing_teams = generation.teams.count()
        import string
        if existing_teams < 26:
            name = f'Time {string.ascii_uppercase[existing_teams]}'
        else:
            name = f'Time {existing_teams + 1}'

        # Cores aleatórias ou pré-definidas? Vamos usar uma cor padrão cinza para times novos, ou gerar dinâmico.
        Team.objects.create(
            generation=generation,
            name=name,
            color='gray',
            color_hex='#9ca3af',
            avg_overall=0.0,
            order=existing_teams
        )
        return Response({'detail': 'Novo time adicionado com sucesso!'})

    @action(detail=True, methods=['delete'], url_path=r'remove-team/(?P<team_id>\d+)')
    def remove_team(self, request, pk=None, team_id=None):
        """Remove um time vazio ou com jogadores (deletando os vinculos)."""
        generation = self.get_object()
        if generation.is_locked:
            return Response({'detail': 'Esta geração está trancada.'}, status=status.HTTP_400_BAD_REQUEST)

        team = Team.objects.filter(generation=generation, id=team_id).first()
        if not team:
            return Response({'detail': 'Time não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        team.delete()
        return Response({'detail': 'Time removido com sucesso!'})

    @action(detail=True, methods=['post'], url_path='auto-allocate')
    def auto_allocate(self, request, pk=None):
        """Pega os jogadores que chegaram (CourtCheckin) mas não estão em nenhum time desta geração e os distribui."""
        generation = self.get_object()
        if generation.is_locked:
            return Response({'detail': 'Esta geração de times está trancada e não pode ser alterada.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not generation.gameday_id:
            return Response({'detail': 'Geração não possui dia de jogo vinculado para verificar presentes.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Obter todos que fizeram court checkin
        from apps.attendance.models import CourtCheckin
        present_player_ids = set(CourtCheckin.objects.filter(gameday_id=generation.gameday_id).values_list('player_id', flat=True))

        # 2. Obter todos que já estão em um time da geração
        assigned_player_ids = set(TeamPlayer.objects.filter(team__generation=generation).values_list('player_id', flat=True))

        # 3. Descobrir quem falta (quem saiu da pelada não volta automaticamente)
        removed_player_ids = set(generation.removed_players.values_list('id', flat=True))
        waiting_player_ids = list(present_player_ids - assigned_player_ids - removed_player_ids)
        if not waiting_player_ids:
            return Response({'detail': 'Nenhum jogador na quadra aguardando alocação.'}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Usar a inteligência para pegar os overalls
        from .algorithm import get_players_with_overall, smart_draft
        from django.db.models import Count
        from .models import TEAM_COLORS, TEAM_COLOR_HEX
        import string

        # Pegar times incompletos (que tem menos que a modalidade)
        incomplete_teams = list(generation.teams.annotate(player_count=Count('team_players')).filter(player_count__lt=generation.modality).order_by('order'))
        players_in_incomplete = list(TeamPlayer.objects.filter(team__in=incomplete_teams).values_list('player_id', flat=True))

        # Pool de jogadores a distribuir = quem tava aguardando + quem já tava nos times incompletos
        pool_player_ids = waiting_player_ids + players_in_incomplete
        pool_players_data = get_players_with_overall(player_ids=pool_player_ids)

        if not pool_players_data:
            return Response({'detail': 'Não foi possível buscar dados dos jogadores.'}, status=status.HTTP_400_BAD_REQUEST)

        # 5. Distribuir em novos times
        new_teams_draft = smart_draft(pool_players_data, generation.modality)
        
        # Limpar os times incompletos para reescrever
        TeamPlayer.objects.filter(team__in=incomplete_teams).delete()
        
        existing_teams_count = generation.teams.count()
        created_count = 0
        
        for i, team_players in enumerate(new_teams_draft):
            if not team_players:
                continue
            
            # Se ainda temos times incompletos para reaproveitar, usamos ele
            if i < len(incomplete_teams):
                team = incomplete_teams[i]
            else:
                # Criar novo time
                order = existing_teams_count + created_count
                name = f'Time {TEAM_COLORS[order % len(TEAM_COLORS)]}'
                    
                team = Team.objects.create(
                    generation=generation,
                    name=name,
                    color=TEAM_COLORS[order % len(TEAM_COLORS)],
                    color_hex=TEAM_COLOR_HEX[order % len(TEAM_COLOR_HEX)],
                    avg_overall=0.0,
                    order=order
                )
                created_count += 1
                
            for j, p_data in enumerate(team_players):
                TeamPlayer.objects.create(
                    team=team,
                    player_id=p_data['id'],
                    order_in_team=j
                )
            
        self._recalculate_generation_overalls(generation)
        return Response({'detail': f'{len(waiting_player_ids)} jogadores alocados em {created_count} novo(s) time(s).'})

    @action(detail=True, methods=['post'], url_path='remove-player')
    def remove_player(self, request, pk=None):
        """Remove um jogador de uma geração em andamento."""
        generation = self.get_object()
        
        if generation.is_locked:
            return Response({'detail': 'Esta geração de times está trancada e não pode ser alterada.'}, status=status.HTTP_400_BAD_REQUEST)

        player_id = request.data.get('player_id')

        if not player_id:
            return Response({'detail': 'ID do jogador é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            tp = TeamPlayer.objects.get(team__generation=generation, player_id=player_id)
            tp.delete()

            # Não removemos o CourtCheckin: o jogador esteve na quadra e não pode levar falta.
            # Registramos que saiu para o Embaralhar/Alocar não o trazerem de volta.
            generation.removed_players.add(player_id)

            self._recalculate_generation_overalls(generation)
            return Response({'detail': 'Jogador removido do time. Presença na quadra mantida.'})
        except TeamPlayer.DoesNotExist:
            return Response({'detail': 'Jogador não encontrado nesta geração.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='restore-player')
    def restore_player(self, request, pk=None):
        """Jogador que tinha saído volta para a pelada (entra no próximo Embaralhar/Alocar)."""
        generation = self.get_object()
        if generation.is_locked:
            return Response({'detail': 'Esta geração de times está trancada e não pode ser alterada.'}, status=status.HTTP_400_BAD_REQUEST)

        player_id = request.data.get('player_id')
        if not player_id or not generation.removed_players.filter(id=player_id).exists():
            return Response({'detail': 'Este jogador não está na lista de quem saiu.'}, status=status.HTTP_400_BAD_REQUEST)

        generation.removed_players.remove(player_id)
        return Response({'detail': 'Jogador de volta! Ele entra no próximo Embaralhar ou Alocar.'})

    @action(detail=True, methods=['post'], url_path='shuffle')
    def shuffle(self, request, pk=None):
        """Refaz o sorteio com quem está na quadra, sem trazer de volta quem saiu da pelada (Embaralhar)."""
        generation = self.get_object()
        if generation.is_locked:
            return Response({'detail': 'Esta geração de times está trancada e não pode ser alterada.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not generation.gameday_id:
            return Response({'detail': 'Geração não possui dia de jogo vinculado para verificar presentes.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Obter todos que fizeram court checkin
        from apps.attendance.models import CourtCheckin
        present_player_ids = list(
            CourtCheckin.objects.filter(gameday_id=generation.gameday_id)
            .exclude(player__in=generation.removed_players.all())
            .values_list('player_id', flat=True)
        )

        if not present_player_ids:
            return Response({'detail': 'Nenhum jogador na quadra para embaralhar.'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Obter dados dos jogadores
        from .algorithm import get_players_with_overall, smart_draft
        players_data = get_players_with_overall(player_ids=present_player_ids)

        if not players_data:
            return Response({'detail': 'Não foi possível buscar dados dos jogadores.'}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Distribuir em novos times
        new_teams_draft = smart_draft(players_data, generation.modality)
        
        # 4. Limpar todos os vínculos atuais (TeamPlayer)
        TeamPlayer.objects.filter(team__generation=generation).delete()
        
        # 5. Reescrever os times (reaproveitando existentes ou criando/deletando)
        existing_teams = list(generation.teams.all().order_by('order'))
        from .models import TEAM_COLORS, TEAM_COLOR_HEX
        
        for i, team_players in enumerate(new_teams_draft):
            if not team_players:
                continue
            
            if i < len(existing_teams):
                team = existing_teams[i]
                team.avg_overall = 0.0 # reset, will be recalculated
                team.save(update_fields=['avg_overall'])
            else:
                # Create new team
                name = f'Time {TEAM_COLORS[i % len(TEAM_COLORS)]}'
                team = Team.objects.create(
                    generation=generation,
                    name=name,
                    color=TEAM_COLORS[i % len(TEAM_COLORS)],
                    color_hex=TEAM_COLOR_HEX[i % len(TEAM_COLOR_HEX)],
                    avg_overall=0.0,
                    order=i
                )
                
            for j, p_data in enumerate(team_players):
                TeamPlayer.objects.create(
                    team=team,
                    player_id=p_data['id'],
                    order_in_team=j
                )
                
        # Deletar times excedentes
        if len(new_teams_draft) < len(existing_teams):
            excess_teams = existing_teams[len(new_teams_draft):]
            for ext in excess_teams:
                ext.delete()
            
        self._recalculate_generation_overalls(generation)
        return Response({'detail': f'{len(present_player_ids)} jogadores embaralhados com sucesso!'})
