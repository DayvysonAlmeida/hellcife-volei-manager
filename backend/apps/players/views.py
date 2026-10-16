from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q, Subquery, OuterRef, FloatField, Case, When, IntegerField
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import Player, StarHistory, Badge
from apps.notifications.models import Notification
from .serializers import (
    PlayerListSerializer, PlayerDetailSerializer, PlayerWriteSerializer,
    BadgeSerializer
)
from .filters import PlayerFilter
from .rankings import (
    fire_shark_positions, fire_shark_ranking, ranked_players, season_payload, stars_ranking, wins_positions, wins_ranking,
)
from apps.core.permissions import IsAdminOrModerator
from apps.evaluations.models import Evaluation
from apps.matches.models import MatchPlayer
from apps.attendance.models import Attendance, GameDay


def latest_overall_subquery():
    return Subquery(
        Evaluation.objects.filter(
            player=OuterRef('pk')
        ).order_by('-date', '-id').values('overall')[:1],
        output_field=FloatField()
    )


class PlayerViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PlayerFilter
    search_fields = ['name', 'nickname', 'shirt_number']
    ordering_fields = ['name', 'shirt_number', 'created_at', 'annotated_overall', 'main_position']
    ordering = ['name']

    def get_queryset(self):
        qs = Player.objects.all()

        if self.action == 'list':
            if 'include_guests' in self.request.query_params:
                pass
            elif 'is_guest' not in self.request.query_params:
                qs = qs.filter(is_guest=False)

            # Na listagem, anotar o overall mais recente via subquery para eliminar N+1.
            qs = qs.annotate(
                annotated_overall=latest_overall_subquery(),
                total_matches=Count('match_appearances', distinct=True),
                mvps=Count('match_appearances', filter=Q(match_appearances__mvp=True), distinct=True),
                best_attackers=Count('match_appearances', filter=Q(match_appearances__best_attacker=True), distinct=True),
                best_servers=Count('match_appearances', filter=Q(match_appearances__best_server=True), distinct=True),
                best_defenders=Count('match_appearances', filter=Q(match_appearances__best_defender=True), distinct=True),
                wins=Count('match_appearances', filter=Q(match_appearances__match_team__winner=True), distinct=True),
            )
            
            # Substituindo Window() por rank calculado via context, pois 
            # os filtros do Django quebram o OVER() particionando o rank pelas buscas.
            qs = qs.prefetch_related('match_appearances__match_team__match')
        else:
            # Para outras actions, prefetch para uso em PlayerDetailSerializer
            qs = qs.prefetch_related('evaluations', 'badges__badge')

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return PlayerListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return PlayerWriteSerializer
        return PlayerDetailSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == 'list':
            # Calcula o rank global absoluto imune a paginação e filtros (DenseRank)
            context['global_win_ranks'] = wins_positions()
            context['global_fire_sharks'] = fire_shark_positions()
        return context

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'update_stars']:
            return [IsAdminOrModerator()]
        return [IsAuthenticated()]

    def perform_update(self, serializer):
        """Ao reativar um jogador (inactive → active), zera as faltas consecutivas automaticamente."""
        instance = self.get_object()
        old_status = instance.status
        new_status = serializer.validated_data.get('status', old_status)

        extra_fields = {}
        if old_status != 'active' and new_status == 'active':
            extra_fields['consecutive_absences'] = 0
            # Ponto de Reset: senão o recálculo de faltas inativa de novo pelo histórico
            extra_fields['absences_reset_date'] = timezone.now().date()

        serializer.save(**extra_fields)

    @action(detail=True, methods=['patch'], url_path='update_stars')
    def update_stars(self, request, pk=None):
        """
        Atualiza os prêmios vitais de um atleta.
        """
        player = self.get_object()

        old_mvp = player.mvp_stars or 0
        old_attack = player.attack_stars or 0
        old_defense = player.defense_stars or 0
        old_setter = player.setter_stars or 0
        old_pass = player.pass_stars or 0
        old_block = player.block_stars or 0

        mvp = int(request.data.get('mvp_stars', old_mvp))
        attack = int(request.data.get('attack_stars', old_attack))
        defense = int(request.data.get('defense_stars', old_defense))
        setter = int(request.data.get('setter_stars', old_setter))
        pass_ = int(request.data.get('pass_stars', old_pass))
        block = int(request.data.get('block_stars', old_block))

        # Validação de range mínimo
        for name, val in [('mvp_stars', mvp), ('attack_stars', attack), ('defense_stars', defense), ('setter_stars', setter), ('pass_stars', pass_), ('block_stars', block)]:
            if val < 0:
                return Response(
                    {name: f'Deve ser maior ou igual a 0. Recebido: {val}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Calcula o delta das estrelas
        diff_mvp = mvp - old_mvp
        diff_attack = attack - old_attack
        diff_defense = defense - old_defense
        diff_setter = setter - old_setter
        diff_pass = pass_ - old_pass
        diff_block = block - old_block

        player.mvp_stars = mvp
        player.attack_stars = attack
        player.defense_stars = defense
        player.setter_stars = setter
        player.pass_stars = pass_
        player.block_stars = block

        prev_big_stars = player.big_stars or 0
        diff_points = (diff_mvp * 6) + diff_attack + diff_defense + diff_setter + diff_pass + diff_block
        
        new_mini = (player.mini_stars or 0) + diff_points
        if new_mini >= 15:
            player.big_stars = prev_big_stars + 1
            player.mini_stars = 0
            player.mvp_stars = 0
            player.attack_stars = 0
            player.defense_stars = 0
            player.setter_stars = 0
            player.pass_stars = 0
            player.block_stars = 0
        else:
            player.mini_stars = max(0, new_mini)

        new_big_stars = player.big_stars or 0

        # Atualiza totais se existirem para compatibilidade legada
        if hasattr(player, 'total_mvp'):
            player.total_mvp += max(0, diff_mvp)
            player.total_attack += max(0, diff_attack)
            player.total_defense += max(0, diff_defense)
            player.total_setter += max(0, diff_setter)
            player.total_pass += max(0, diff_pass)
            player.total_block += max(0, diff_block)

        update_fields = [
            'mvp_stars', 'attack_stars', 'defense_stars',
            'setter_stars', 'pass_stars', 'block_stars',
            'mini_stars', 'big_stars', 'updated_at'
        ]
        if hasattr(player, 'total_mvp'):
            update_fields.extend([
                'total_mvp', 'total_attack', 'total_defense',
                'total_setter', 'total_pass', 'total_block'
            ])

        # Salva as alterações
        player.save(update_fields=update_fields)

        # Cria os registros de histórico de estrelas
        history_to_create = []
        for diff, cat in [
            (diff_mvp, 'mvp'), (diff_attack, 'attack'), (diff_defense, 'defense'),
            (diff_setter, 'setter'), (diff_pass, 'pass'), (diff_block, 'block')
        ]:
            if diff != 0:
                history_to_create.append(StarHistory(
                    player=player, category=cat, 
                    action='add' if diff > 0 else 'remove', count=abs(diff)
                ))

        if new_big_stars > prev_big_stars:
            history_to_create.append(StarHistory(player=player, category='promotion', action='promote', count=new_big_stars - prev_big_stars))

        if history_to_create:
            StarHistory.objects.bulk_create(history_to_create)

        # Envia notificação se o jogador tiver usuário vinculado
        if player.user and hasattr(player, 'user'):
            notifications_to_create = []
            
            # Notifica mini estrelas adicionadas (somente para o próprio atleta)
            for diff, cat, label in [
                (diff_mvp, 'mvp', 'MVP'), (diff_attack, 'attack', 'Ataque'), (diff_defense, 'defense', 'Defesa'),
                (diff_setter, 'setter', 'Levantamento'), (diff_pass, 'pass', 'Passe'), (diff_block, 'block', 'Bloqueio')
            ]:
                if diff > 0:
                    notifications_to_create.append(Notification(
                        user=player.user,
                        title='Mini Estrela Recebida! ⭐',
                        message=f'Você recebeu {diff} mini estrela(s) de {label}. Continue mandando ver!',
                        type='prize'
                    ))

            # Notifica forja da Estrela Maior
            if new_big_stars > prev_big_stars:
                # 1. Notifica o próprio jogador
                notifications_to_create.append(Notification(
                    user=player.user,
                    title='ESTRELA FORJADA! 🌟',
                    message=f'Parabéns! Suas 15 mini estrelas formaram uma nova Estrela Completa! Agora você possui {new_big_stars} estrela(s).',
                    type='prize'
                ))
                
                # 2. Notifica todos os outros jogadores (Broadcast)
                from apps.core.models import User
                other_users = User.objects.filter(profile='player', is_active=True).exclude(id=player.user.id)
                for other_user in other_users:
                    notifications_to_create.append(Notification(
                        user=other_user,
                        title='Estrela Forjada no Circuito! 🌟',
                        message=f'O atleta {player.display_name} acabou de forjar uma nova Estrela Completa e chegou a {new_big_stars} estrela(s)!',
                        type='circuit'
                    ))

            if notifications_to_create:
                Notification.objects.bulk_create(notifications_to_create)

        # Invalida cache do dashboard para refletir nova pontuação
        from django.core.cache import cache
        cache.delete('dashboard_data')

        from apps.core.utils.ranking_monitor import check_rank_changes
        check_rank_changes()

        return Response({
            'id': player.id,
            'mvp_stars': player.mvp_stars,
            'attack_stars': player.attack_stars,
            'defense_stars': player.defense_stars,
            'setter_stars': player.setter_stars,
            'pass_stars': player.pass_stars,
            'block_stars': player.block_stars,
            'mini_stars': player.mini_stars,
            'big_stars': player.big_stars,
        })

    @action(detail=False, methods=['get'], url_path='dashboard-stats')
    def dashboard_stats(self, request):
        qs_wins = wins_ranking()[:10]
        
        top_wins = []
        for p in qs_wins:
            win_rate = (p.wins / p.total_matches * 100) if p.total_matches > 0 else 0
            top_wins.append({
                'id': p.id,
                'name': p.display_name,
                'avatar_url': p.avatar_url,
                'wins': p.wins,
                'total_matches': p.total_matches,
                'win_rate': round(win_rate, 1)
            })

        fire_sharks = [
            {
                'id': p.id,
                'name': p.display_name,
                'avatar_url': p.avatar_url,
                'wins': p.wins,
                'total_matches': p.total_matches,
                'win_rate': round(p.win_rate, 1),
                'score': round(p.fire_score, 1),
            }
            for p in fire_shark_ranking()[:10]
        ]

        qs_stars = stars_ranking()[:10]
        top_stars = []
        for p in qs_stars:
            top_stars.append({
                'id': p.id,
                'name': p.display_name,
                'avatar_url': p.avatar_url,
                'big_stars': p.big_stars,
                'mini_stars': p.mini_stars,
                'mvp_stars': p.mvp_stars,
                'attack_stars': p.attack_stars,
                'defense_stars': p.defense_stars,
                'setter_stars': p.setter_stars,
                'pass_stars': p.pass_stars,
                'block_stars': p.block_stars,
            })

        qs_recent = StarHistory.objects.filter(action__in=['add', 'promote']).select_related('player').order_by('-created_at')[:10]
        recent_stars = []
        for h in qs_recent:
            recent_stars.append({
                'id': h.id,
                'player_id': h.player_id,
                'player_name': h.player.display_name,
                'avatar_url': h.player.avatar_url,
                'category': h.category,
                'action': h.action,
                'count': h.count,
                'created_at': h.created_at.isoformat(),
            })

        categories = ['mvp', 'attack', 'defense', 'setter', 'pass', 'block']
        last_category_winners = {}
        for cat in categories:
            last = StarHistory.objects.filter(category=cat, action='add').select_related('player').order_by('-created_at').first()
            if last:
                last_category_winners[cat] = {
                    'player_id': last.player_id,
                    'player_name': last.player.display_name,
                    'avatar_url': last.player.avatar_url,
                    'created_at': last.created_at.isoformat()
                }

        return Response({
            'top_wins': top_wins,
            'top_stars': top_stars,
            'recent_stars': recent_stars,
            'last_category_winners': last_category_winners,
            'fire_sharks': fire_sharks,
            'season': season_payload(),
        })

    @action(detail=False, methods=['get'], url_path='seasons')
    def seasons(self, request):
        """Temporada atual e o pódio (Elo, Fire Shark e Gladiador) das temporadas encerradas."""
        from .models import Season, SeasonStanding

        current = season_payload()

        def podium(season, field):
            top = (SeasonStanding.objects.filter(season=season, **{f'{field}__isnull': False})
                   .select_related('player').order_by(field)[:3])
            return [{
                'position': getattr(s, field), 'player_id': s.player_id, 'name': s.player.display_name,
                'avatar_url': s.player.avatar_url, 'elo': s.elo, 'elo_tier': s.elo_tier, 'wins': s.wins,
                'matches': s.matches, 'fire_score': s.fire_score,
            } for s in top]

        past = [{
            'number': s.number, 'name': s.name, 'start_date': s.start_date, 'end_date': s.end_date,
            'prize_notes': s.prize_notes,
            'podium': {'elo': podium(s, 'elo_rank'), 'fire_shark': podium(s, 'fire_rank'), 'gladiator': podium(s, 'wins_rank')},
        } for s in Season.objects.filter(finalized_at__isnull=False).order_by('-number')]
        return Response({'current': current, 'past': past})

    @action(detail=False, methods=['get'], url_path='elo-tiers')
    def elo_tiers(self, request):
        """Faixas do Elo e regras do cálculo, para as telas nunca divergirem do servidor."""
        from .elo_service import ELO_K, ELO_K_PLACEMENT, ELO_MIN, ELO_START, ELO_TIERS, PLACEMENT_GAMES
        return Response({
            'tiers': ELO_TIERS,
            'rules': {'start': ELO_START, 'k': ELO_K, 'k_placement': ELO_K_PLACEMENT,
                      'placement_games': PLACEMENT_GAMES, 'min': ELO_MIN},
        })

    @action(detail=False, methods=['get'], url_path='stars-history')
    def stars_history(self, request):
        qs = StarHistory.objects.select_related('player').order_by('-created_at')[:50]
        data = []
        for h in qs:
            data.append({
                'id': h.id,
                'player_id': h.player_id,
                'player_name': h.player.display_name,
                'avatar_url': h.player.avatar_url,
                'category': h.category,
                'action': h.action,
                'count': h.count,
                'created_at': h.created_at.isoformat(),
            })
        return Response(data)

    @action(detail=False, methods=['get'], url_path='ranking')
    def ranking(self, request):
        position = request.query_params.get('position')
        show_all = request.query_params.get('all') == 'true'

        # Uma única query com annotations para overall, stats de partidas
        players = (
            ranked_players()  # ativos e sem convidados, como todos os rankings
            .annotate(
                annotated_overall=Coalesce(latest_overall_subquery(), 0.0),
                total_matches=Count('match_appearances', distinct=True),
                mvps=Count('match_appearances', filter=Q(match_appearances__mvp=True), distinct=True),
                best_attackers=Count('match_appearances', filter=Q(match_appearances__best_attacker=True), distinct=True),
                best_servers=Count('match_appearances', filter=Q(match_appearances__best_server=True), distinct=True),
                best_defenders=Count('match_appearances', filter=Q(match_appearances__best_defender=True), distinct=True),
                wins=Count('match_appearances', filter=Q(match_appearances__match_team__winner=True), distinct=True),
            )
        )
        
        # Filtra jogadores sem avaliação apenas se 'all' não for true
        if not show_all:
            players = players.filter(annotated_overall__gt=0)

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
        total_gamedays = GameDay.objects.filter(date__gte=player.created_at.date()).count()
        attended = Attendance.objects.filter(player=player, present=True).count()
        attendance_rate = round(attended / total_gamedays * 100, 1) if total_gamedays > 0 else 0

        # Histórico de overall (1 query)
        evaluations = player.evaluations.order_by('date').values('date', 'overall')

        # -- Cálculos de Rankings e Estrelas --
        from django.db.models.functions import Coalesce
        from django.db.models import Subquery, OuterRef
        from apps.evaluations.models import Evaluation
        from apps.players.models import StarHistory
        latest_eval = Evaluation.objects.filter(player=OuterRef('pk')).order_by('-date', '-id').values('overall')[:1]
        qs_players = ranked_players().annotate(annotated_overall=Coalesce(Subquery(latest_eval), 0.0))

        player_overall = player.latest_overall or 0.0
        overall_rank = qs_players.filter(annotated_overall__gt=player_overall).count() + 1 if player_overall > 0 else None

        # Posição no Fire Shark (mesma regra de todas as telas; inativo/convidado não tem posição)
        win_rank = fire_shark_positions().get(player.id)

        last_star = StarHistory.objects.filter(player=player, action='add').exclude(category='promotion').order_by('-created_at').first()
        latest_mini_star = last_star.category if last_star else None

        # Calcula a sequência de vitórias (Win Streak)
        streak = 0
        appearances = list(player.match_appearances.select_related('match_team__match').order_by('-match_team__match__date'))
        for app in appearances:
            if app.match_team and app.match_team.match:
                if app.match_team.winner:
                    streak += 1
                else:
                    break

        return Response({
            'player_id': player.id,
            'total_matches': total_matches,
            'wins': wins,
            'losses': losses,
            'draws': draws,
            'win_rate': win_rate,
            'win_streak': streak,
            'mvps': mvps,
            'total_gamedays': total_gamedays,
            'attended_gamedays': attended,
            'attendance_rate': attendance_rate,
            'overall_history': list(evaluations),
            'overall_rank': overall_rank,
            'win_rank': win_rank,
            'latest_mini_star': latest_mini_star,
        })

    @action(detail=False, methods=['get'], url_path='me', permission_classes=[IsAuthenticated])
    def me(self, request):
        """Retorna o Player vinculado ao usuário logado (para portal do atleta)."""
        player = Player.objects.filter(user=request.user).select_related('user').prefetch_related('evaluations').first()
        if not player:
            return Response({'detail': 'Nenhum perfil de atleta vinculado a este usuário.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = PlayerDetailSerializer(player, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='create-access')
    def create_access(self, request, pk=None):
        """Cria um usuário (profile=player) e vincula ao Player. Apenas admin/moderador."""
        from apps.core.permissions import IsAdminOrModerator
        if not IsAdminOrModerator().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)

        player = self.get_object()

        if player.user:
            return Response({'detail': 'Este atleta já possui um acesso vinculado.'}, status=status.HTTP_400_BAD_REQUEST)

        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '').strip()

        if not email:
            return Response({'detail': 'E-mail é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)
        if not password or len(password) < 6:
            return Response({'detail': 'A senha deve ter pelo menos 6 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.core.models import User
        if User.objects.filter(email=email).exists():
            return Response({'detail': 'Já existe um usuário com este e-mail.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            email=email,
            password=password,
            name=player.display_name,
            profile='player',
        )
        player.user = user
        player.save(update_fields=['user'])

        return Response({
            'detail': 'Acesso criado com sucesso!',
            'email': email,
            'password': password,
            'player_name': player.display_name,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='revoke-access')
    def revoke_access(self, request, pk=None):
        """Remove o usuário vinculado ao Player. Apenas admin/moderador."""
        from apps.core.permissions import IsAdminOrModerator
        if not IsAdminOrModerator().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)

        player = self.get_object()

        if not player.user:
            return Response({'detail': 'Este atleta não possui acesso vinculado.'}, status=status.HTTP_400_BAD_REQUEST)

        user = player.user
        player.user = None
        player.save(update_fields=['user'])
        user.delete()

        return Response({'detail': 'Acesso revogado com sucesso.'})

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        """Redefine a senha do usuário vinculado ao Player. Apenas admin/moderador."""
        from apps.core.permissions import IsAdminOrModerator
        if not IsAdminOrModerator().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)

        player = self.get_object()

        if not player.user:
            return Response({'detail': 'Este atleta não possui acesso vinculado.'}, status=status.HTTP_400_BAD_REQUEST)

        new_password = request.data.get('password', '').strip()
        if not new_password or len(new_password) < 6:
            return Response({'detail': 'A nova senha deve ter pelo menos 6 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)

        player.user.set_password(new_password)
        player.user.save()

        return Response({
            'detail': 'Senha redefinida com sucesso!',
            'email': player.user.email,
            'password': new_password,
            'player_name': player.display_name,
        })

    @action(detail=True, methods=['post'], url_path='recalculate-elo')
    def recalculate_elo(self, request, pk=None):
        """Recalcula o Elo de um jogador específico. Apenas admin/moderador."""
        from apps.core.permissions import IsAdminOrModerator
        if not IsAdminOrModerator().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)

        from .elo_service import recalculate_elo as _recalc
        player = self.get_object()
        new_elo = _recalc(player)  # o Elo de um depende de todos: recalcula a temporada inteira
        return Response({'elo': new_elo, 'elo_tier': player.elo_tier})

    @action(detail=False, methods=['post'], url_path='recalculate-all-elos')
    def recalculate_all_elos(self, request):
        """Recalcula o Elo de todos os jogadores. Apenas admin/moderador."""
        from apps.core.permissions import IsAdminOrModerator
        if not IsAdminOrModerator().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)

        from .elo_service import recalculate_all
        recalculate_all()
        return Response({'detail': f'Elo recalculado para {Player.objects.count()} jogadores.'})


class BadgeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Badge.objects.all()
    serializer_class = BadgeSerializer
