from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Subquery, OuterRef, FloatField, Avg, Prefetch
from django.db.models.functions import Coalesce

from apps.attendance.models import GameDay
from .models import TeamGeneration, Team, TeamPlayer, next_court, taken_player_ids
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
                'gameday__court_checkins__player',  # para a lista de quem está aguardando
                # quem já está nas outras quadras do circuito não está aguardando
                'gameday__team_generations__teams__team_players',
                'gameday__team_generations__removed_players',
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
        """
        Gera times balanceados (preview ou salvando).
        Com o circuito já em andamento, só entra quem ainda não está em nenhuma quadra dele (abrir uma quadra
        nova com quem está aguardando). Com `courts` > 1, os times saem distribuídos entre as quadras.
        """
        serializer = GenerateTeamsInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        exclude = set()
        if data.get('gameday_id'):
            gameday = (
                GameDay.objects.filter(id=data['gameday_id'])
                .prefetch_related('team_generations__teams__team_players', 'team_generations__removed_players')
                .first()
            )
            if gameday:
                exclude = taken_player_ids(gameday)

        result = generate_teams(
            modality=data['modality'],
            gameday_id=data.get('gameday_id'),
            player_ids=data.get('player_ids'),
            exclude_player_ids=exclude,
            courts=data['courts'],
        )

        if 'error' in result:
            return Response({'detail': result['error']}, status=status.HTTP_400_BAD_REQUEST)

        # Se solicitado, persiste no banco (apenas por compatibilidade)
        if data.get('save'):
            generations = self._save_result(
                request.user, data['modality'], data.get('gameday_id'), data.get('notes', ''), result
            )
            result['generation_id'] = generations[0].id

        return Response(result)

    def _save_generation(self, user, modality, gameday_id, notes, result_data, court=1):
        generation = TeamGeneration.objects.create(
            gameday_id=gameday_id,
            modality=modality,
            court=court,
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

    def _save_result(self, user, modality, gameday_id, notes, result):
        """Salva um sorteio por quadra, numerando a partir da próxima quadra livre do circuito."""
        from .algorithm import calculate_balance_score

        by_court = {}
        for team in result['teams']:
            by_court.setdefault(team.get('court') or 1, []).append(team)

        first_court = next_court(gameday_id)
        generations = []
        with transaction.atomic():
            for offset, (_, teams) in enumerate(sorted(by_court.items())):
                if len(by_court) == 1:
                    balance = result.get('balance_score', 0)
                else:
                    # Equilíbrio de cada quadra (sem o score de algum jogador, usa o overall)
                    balance = calculate_balance_score([
                        [{'composite_score': p.get('composite_score', p.get('overall', 0))} for p in t['players']]
                        for t in teams
                    ])
                generations.append(self._save_generation(
                    user, modality, gameday_id, notes, {'teams': teams, 'balance_score': balance},
                    court=first_court + offset,
                ))
        return generations

    @action(detail=False, methods=['post'], url_path='save-generated')
    def save_generated(self, request):
        """Salva exatamente os times que foram enviados (após visualização pelo usuário), um sorteio por quadra."""
        data = request.data
        modality = data.get('modality')
        gameday_id = data.get('gameday_id')
        notes = data.get('notes', '')
        result = data.get('result')

        if not result or not modality or not result.get('teams'):
            return Response({'detail': 'Dados inválidos.'}, status=status.HTTP_400_BAD_REQUEST)

        generations = self._save_result(request.user, modality, gameday_id, notes, result)
        
        return Response({
            'detail': 'Times salvos com sucesso!',
            'generation_id': generations[0].id,
            'generation_ids': [g.id for g in generations],
        })

    @action(detail=True, methods=['post'], url_path='lock')
    def lock(self, request, pk=None):
        """
        Encerra esta quadra (tranca os times). O circuito só é encerrado quando a última quadra dele termina;
        com uma quadra só, encerrar a pelada encerra o circuito, como sempre.
        """
        generation = self.get_object()
        
        generation.is_locked = True
        generation.save(update_fields=['is_locked'])
        
        if generation.gameday and not generation.gameday.team_generations.filter(is_locked=False).exists():
            generation.gameday.is_closed = True
            generation.gameday.save(update_fields=['is_closed'])
            
            # Sincroniza faltas usando a fonte da verdade única
            from apps.attendance.views import sync_absences_logic
            sync_absences_logic()
            return Response({'detail': 'Pelada e Circuito encerrados com sucesso.', 'circuit_closed': True})

        if generation.gameday:
            return Response({
                'detail': f'Quadra {generation.court} encerrada. O circuito fecha quando a última quadra terminar.',
                'circuit_closed': False,
            })
        return Response({'detail': 'Pelada encerrada com sucesso.', 'circuit_closed': False})

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
        """Move um jogador para outro time desta quadra ou de outra quadra aberta do mesmo circuito."""
        generation = self.get_object()
        
        if generation.is_locked:
            return Response({'detail': 'Esta geração de times está trancada e não pode ser alterada.'}, status=status.HTTP_400_BAD_REQUEST)

        player_id = request.data.get('player_id')
        target_team_id = request.data.get('target_team_id')

        try:
            tp = TeamPlayer.objects.get(team__generation=generation, player_id=player_id)
        except TeamPlayer.DoesNotExist:
            return Response({'detail': 'Jogador não encontrado nesta geração.'}, status=status.HTTP_404_NOT_FOUND)

        # Destino: time desta geração ou de outra quadra do mesmo circuito (nunca de outro circuito)
        targets = Team.objects.filter(id=target_team_id).select_related('generation')
        if generation.gameday_id:
            targets = targets.filter(generation__gameday_id=generation.gameday_id)
        else:
            targets = targets.filter(generation=generation)
        target = targets.first()
        if not target:
            return Response({'detail': 'Time de destino não encontrado neste circuito.'}, status=status.HTTP_404_NOT_FOUND)
        if target.generation.is_locked:
            return Response({'detail': 'A quadra de destino já foi encerrada.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            tp.team = target
            tp.order_in_team = target.team_players.count()
            tp.save()
            target.generation.removed_players.remove(player_id)
            self._recalculate_generation_overalls(generation)
            if target.generation_id != generation.id:
                self._recalculate_generation_overalls(target.generation)

        if target.generation_id != generation.id:
            return Response({'detail': f'Jogador movido para o {target.name} da Quadra {target.generation.court}.'})
        return Response({'detail': 'Jogador movido com sucesso.'})

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

        # Cada atleta numa quadra só: quem joga em outra quadra aberta do circuito troca pelo "mover"
        if generation.gameday_id:
            other = TeamPlayer.objects.filter(
                team__generation__gameday_id=generation.gameday_id, team__generation__is_locked=False, player_id=player_id,
            ).exclude(team__generation=generation).select_related('team__generation').first()
            if other:
                return Response(
                    {'detail': f'Jogador está na Quadra {other.team.generation.court}. Use "mover" para trocar de quadra.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

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
                _, arrived = CourtCheckin.objects.get_or_create(gameday_id=generation.gameday_id, player_id=player_id)
                if arrived:
                    Player.reactivate_inactive([player_id])

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
        """
        Completar: coloca quem chegou à quadra nos times, na ordem de chegada.
        Quem já está num time continua nele: primeiro enchem os times incompletos (na ordem dos times),
        depois quem sobra começa times novos, que vão se completando com os próximos que chegarem.
        Para equilibrar o nível de todo mundo de novo, o caminho é o Embaralhar.
        """
        generation = self.get_object()
        if generation.is_locked:
            return Response({'detail': 'Esta geração de times está trancada e não pode ser alterada.'}, status=status.HTTP_400_BAD_REQUEST)

        if not generation.gameday_id:
            return Response({'detail': 'Geração não possui dia de jogo vinculado para verificar presentes.'}, status=status.HTTP_400_BAD_REQUEST)

        waiting = [c.player for c in generation.waiting_checkins()]
        if not waiting:
            return Response({'detail': 'Nenhum jogador na quadra aguardando alocação.'}, status=status.HTTP_400_BAD_REQUEST)

        from .models import TEAM_COLORS, TEAM_COLOR_HEX

        teams = list(generation.teams.all())
        placed = {}  # time -> nomes de quem entrou nele
        new_teams = set()

        with transaction.atomic():
            def add(team, size, player):
                TeamPlayer.objects.create(team=team, player=player, order_in_team=size)
                placed.setdefault(team, []).append(player.display_name)

            # 1. Enche os times incompletos
            for team in teams:
                size = len(team.team_players.all())
                while size < generation.modality and waiting:
                    add(team, size, waiting.pop(0))
                    size += 1

            # 2. Quem sobra começa times novos, com uma cor que ainda não está em uso
            used_colors = {t.color for t in teams}
            next_order = max((t.order for t in teams), default=-1) + 1
            while waiting:
                free = [i for i, c in enumerate(TEAM_COLORS) if c not in used_colors]
                color = free[0] if free else next_order % len(TEAM_COLORS)
                used_colors.add(TEAM_COLORS[color])
                team = Team.objects.create(
                    generation=generation,
                    name=f'Time {TEAM_COLORS[color]}',
                    color=TEAM_COLORS[color],
                    color_hex=TEAM_COLOR_HEX[color],
                    avg_overall=0.0,
                    order=next_order,
                )
                next_order += 1
                new_teams.add(team)
                for size in range(generation.modality):
                    if not waiting:
                        break
                    add(team, size, waiting.pop(0))

            self._recalculate_generation_overalls(generation)

        summary = '; '.join(
            f"{', '.join(names)} → {team.name}{' (novo)' if team in new_teams else ''}"
            for team, names in placed.items()
        )
        return Response({'detail': summary})

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
        """Refaz o sorteio desta quadra com quem está nela e quem está aguardando, sem trazer de volta quem saiu (Embaralhar)."""
        generation = self.get_object()
        if generation.is_locked:
            return Response({'detail': 'Esta geração de times está trancada e não pode ser alterada.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not generation.gameday_id:
            return Response({'detail': 'Geração não possui dia de jogo vinculado para verificar presentes.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Quem está nesta quadra + quem chegou e ainda não está em nenhuma quadra (nunca quem joga em
        #    outra quadra do circuito, nem quem saiu da pelada). Com uma quadra só, é todo mundo na quadra.
        present_player_ids = [tp.player_id for team in generation.teams.all() for tp in team.team_players.all()]
        present_player_ids += [c.player_id for c in generation.waiting_checkins()]

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
