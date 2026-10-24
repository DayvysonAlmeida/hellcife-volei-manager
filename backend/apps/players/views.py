from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q, Subquery, OuterRef, FloatField, Case, When, IntegerField, F, Prefetch, Window
from django.db.models.functions import Coalesce, RowNumber
from django.utils import timezone

from .models import Player, StarHistory, Badge
from .stars import FIELDS as STAR_FIELDS, after_stars_changed, apply_stars
from .serializers import (
    PlayerListSerializer, PlayerDetailSerializer, PlayerWriteSerializer,
    BadgeSerializer, MyProfileSerializer
)
from .filters import PlayerFilter
from .rankings import (
    fire_shark_entry, fire_shark_positions, fire_shark_ranking, ranked_players, season_payload, season_stats,
    stars_ranking, wins_positions, wins_ranking,
)
from .seasons import ensure_current_season
from apps.core.permissions import IsAdminOrModerator, IsAdminUser, is_staff_profile
from apps.evaluations.models import Evaluation
from apps.matches.models import MatchPlayer
from apps.attendance.frequency import circuit_days, frequency


def latest_overall_subquery():
    return Subquery(
        Evaluation.objects.filter(
            player=OuterRef('pk')
        ).order_by('-date', '-id').values('overall')[:1],
        output_field=FloatField()
    )


def _undone_by(entry, show_author):
    """Lançamento desfeito: quem desfez (o nome só para a staff). None se continua valendo."""
    undo = getattr(entry, 'reverted_by', None)
    if undo is None:
        return None
    return {'name': undo.given_by.name if show_author and undo.given_by else None, 'at': undo.created_at.isoformat()}


STREAK_LOOKBACK = 30  # partidas recentes olhadas para a sequência de vitórias da lista


class PlayerViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PlayerFilter
    search_fields = ['name', 'nickname', 'shirt_number']
    ordering_fields = ['name', 'shirt_number', 'created_at', 'annotated_overall', 'main_position']
    ordering = ['name']

    def get_queryset(self):
        qs = Player.objects.all()
        user = self.request.user
        if not is_staff_profile(user):
            # Cadastros esperando aprovação: só a staff (e a própria pessoa) enxerga
            qs = qs.exclude(Q(status='pending') & ~Q(user=user))

        if self.action == 'list':
            if 'include_guests' in self.request.query_params:
                pass
            elif 'is_guest' not in self.request.query_params:
                qs = qs.filter(is_guest=False)
            # Cadastros esperando aprovação ficam na aba própria, não na lista de atletas
            if 'status' not in self.request.query_params:
                qs = qs.exclude(status='pending')

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
            # Sequência de vitórias: só as últimas partidas de cada atleta (antes vinham todas as da carreira)
            recent = (
                MatchPlayer.objects.filter(match_team__isnull=False)
                .select_related('match_team__match')
                .annotate(recent=Window(RowNumber(), partition_by=[F('player_id')], order_by=[F('match_team__match__date').desc(), F('id').desc()]))
                .filter(recent__lte=STREAK_LOOKBACK)
            )
            qs = qs.prefetch_related(Prefetch('match_appearances', queryset=recent))
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
            # Partidas da temporada de todos de uma vez: decide quem ainda está em calibração no Elo
            context['season_matches'] = {pid: s['matches'] for pid, s in season_stats().items()}
        return context

    def get_permissions(self):
        # ranking = Leaderboard da staff: a nota (overall) de todos
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'update_stars', 'ranking']:
            return [IsAdminOrModerator()]
        return [IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        # Excluir atleta é só do admin; convidado criado por engano na quadra o moderador também apaga
        if not self.get_object().is_guest and not IsAdminUser().has_permission(request, self):
            return Response({'detail': 'Só o administrador pode excluir atletas.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def perform_update(self, serializer):
        """Ao reativar um jogador (inactive → active), zera as faltas consecutivas automaticamente."""
        instance = self.get_object()
        old_status = instance.status
        new_status = serializer.validated_data.get('status', old_status)

        extra_fields = {}
        if old_status != 'active' and new_status == 'active':
            extra_fields['consecutive_absences'] = 0
            # Ponto de Reset: senão o recálculo de faltas inativa de novo pelo histórico
            extra_fields['absences_reset_date'] = timezone.localdate()

        serializer.save(**extra_fields)

    @action(detail=True, methods=['patch'], url_path='update_stars')
    def update_stars(self, request, pk=None):
        """
        Atualiza os prêmios vitais de um atleta.
        """
        player = self.get_object()
        deltas = {}
        for cat, field in STAR_FIELDS.items():
            try:
                value = int(request.data.get(field, getattr(player, field) or 0))
            except (TypeError, ValueError):
                return Response({field: 'Informe um número.'}, status=status.HTTP_400_BAD_REQUEST)
            if value < 0:
                return Response({field: f'Deve ser maior ou igual a 0. Recebido: {value}'}, status=status.HTTP_400_BAD_REQUEST)
            deltas[cat] = value - (getattr(player, field) or 0)

        apply_stars(player, deltas, request.user)
        after_stars_changed()

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

    @action(detail=False, methods=['get'], url_path='stars/launch-options')
    def stars_launch_options(self, request):
        """Painel "Lançar estrelas": circuitos já realizados e quem esteve presente em cada um."""
        if not is_staff_profile(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        from apps.attendance.models import Attendance, GameDay
        gamedays = list(GameDay.objects.filter(date__lte=timezone.localdate()).order_by('-date', '-id')[:20])
        present = {}
        for gameday_id, player_id in Attendance.objects.filter(gameday__in=gamedays, present=True).values_list('gameday_id', 'player_id'):
            present.setdefault(gameday_id, []).append(player_id)
        return Response([
            {
                'id': g.id, 'date': g.date, 'description': g.description or '', 'location': g.arena_name or g.location or '',
                'present_ids': present.get(g.id, []),
            } for g in gamedays
        ])

    @action(detail=False, methods=['post'], url_path='stars/launch')
    def stars_launch(self, request):
        """
        Lança várias estrelas de um circuito de uma vez (o rascunho revisado no painel).
        Corpo: {"gameday": 12, "items": [{"player": 3, "category": "attack", "count": 1}, ...]}
        """
        if not is_staff_profile(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        from django.db import transaction
        from apps.attendance.models import GameDay

        gameday = GameDay.objects.filter(pk=request.data.get('gameday'), date__lte=timezone.localdate()).first()
        if not gameday:
            return Response({'gameday': 'Escolha um circuito que já aconteceu.'}, status=status.HTTP_400_BAD_REQUEST)
        items = request.data.get('items') or []
        if not isinstance(items, list) or not items:
            return Response({'items': 'Escolha pelo menos uma estrela para lançar.'}, status=status.HTTP_400_BAD_REQUEST)

        per_player = {}
        for item in items:
            try:
                player_id, category, count = int(item['player']), item['category'], int(item.get('count', 1))
            except (KeyError, TypeError, ValueError):
                return Response({'items': 'Lançamento inválido.'}, status=status.HTTP_400_BAD_REQUEST)
            if category not in STAR_FIELDS or not 1 <= count <= 10:
                return Response({'items': 'Categoria ou quantidade inválida.'}, status=status.HTTP_400_BAD_REQUEST)
            per_player.setdefault(player_id, {}).setdefault(category, 0)
            per_player[player_id][category] += count

        players = {p.id: p for p in Player.objects.filter(id__in=per_player).exclude(status='pending')}
        if len(players) != len(per_player):
            return Response({'items': 'Algum atleta não foi encontrado.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            created = sum(len(apply_stars(players[pid], deltas, request.user, gameday)) for pid, deltas in per_player.items())
        after_stars_changed()
        return Response({'detail': 'Estrelas lançadas.', 'created': created}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path=r'stars-history/(?P<history_id>\d+)/undo')
    def stars_undo(self, request, history_id=None):
        """Desfaz um lançamento: tira a estrela e registra quem desfez. Só se ela ainda não virou Estrela Grande."""
        if not is_staff_profile(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        entry = StarHistory.objects.select_related('player', 'gameday').filter(pk=history_id).first()
        if not entry or entry.action != 'add' or entry.category not in STAR_FIELDS:
            return Response({'detail': 'Só dá para desfazer uma estrela lançada.'}, status=status.HTTP_400_BAD_REQUEST)
        if StarHistory.objects.filter(reverts=entry).exists():
            return Response({'detail': 'Este lançamento já foi desfeito.'}, status=status.HTTP_409_CONFLICT)
        player = entry.player
        if (getattr(player, STAR_FIELDS[entry.category]) or 0) < entry.count:
            return Response(
                {'detail': 'Essa estrela já virou Estrela Grande (os contadores zeraram). Não dá para desfazer automaticamente.'},
                status=status.HTTP_409_CONFLICT,
            )
        apply_stars(player, {entry.category: -entry.count}, request.user, entry.gameday, reverts=entry)
        after_stars_changed()
        return Response({'detail': 'Lançamento desfeito.'})

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

        fire_sharks = [fire_shark_entry(p) for p in fire_shark_ranking()[:10]]

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

        # O pódio só aparece para os atletas depois que a organização valida o resultado final
        staff = getattr(request.user, 'profile', None) in ('admin', 'moderator')
        past = [{
            'number': s.number, 'name': s.name, 'start_date': s.start_date, 'end_date': s.end_date,
            'prize_notes': s.prize_notes,
            'validated': s.results_validated_at is not None,
            'validated_at': s.results_validated_at,
            'podium': (
                {'elo': podium(s, 'elo_rank'), 'fire_shark': podium(s, 'fire_rank'), 'gladiator': podium(s, 'wins_rank')}
                if staff or s.results_validated_at else {'elo': [], 'fire_shark': [], 'gladiator': []}
            ),
        } for s in Season.objects.filter(finalized_at__isnull=False).order_by('-number')]
        return Response({'current': current, 'past': past})

    @action(detail=False, methods=['post'], url_path=r'seasons/(?P<number>\d+)/(?P<step>recalculate|validate)')
    def season_results(self, request, number=None, step=None):
        """
        Fechamento da temporada (admin/moderador): 'recalculate' refaz a classificação final com os dados de agora
        (depois de corrigir partidas ou check-ins); 'validate' confirma e libera o pódio para os atletas.
        """
        from django.db import transaction
        from .models import Season
        from .seasons import finalize_season, notify_results_validated

        if getattr(request.user, 'profile', None) != 'admin':
            return Response({'detail': 'Só administradores podem fechar a temporada.'}, status=status.HTTP_403_FORBIDDEN)
        season = Season.objects.filter(number=number, finalized_at__isnull=False).first()
        if not season:
            return Response({'detail': 'Essa temporada ainda não foi encerrada.'}, status=status.HTTP_404_NOT_FOUND)
        if step == 'recalculate':
            with transaction.atomic():
                finalize_season(season)
        else:
            first_validation = season.results_validated_at is None
            season.results_validated_at, season.results_validated_by = timezone.now(), request.user
            season.save(update_fields=['results_validated_at', 'results_validated_by'])
            if first_validation:
                notify_results_validated(season)
        return Response({'number': season.number, 'validated': season.results_validated_at is not None})

    @action(detail=False, methods=['patch'], url_path=r'seasons/(?P<number>\d+)/prize')
    def season_prize(self, request, number=None):
        """Texto da premiação da temporada (admin/moderador). Aparece para os atletas na tela Temporadas."""
        from django.core.cache import cache
        from .models import Season

        if getattr(request.user, 'profile', None) != 'admin':
            return Response({'detail': 'Só administradores podem editar a premiação.'}, status=status.HTTP_403_FORBIDDEN)
        season = Season.objects.filter(number=number).first()
        if not season:
            return Response({'detail': 'Temporada não encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        text = str(request.data.get('prize_notes', '')).strip()
        if len(text) > 1000:
            return Response({'detail': 'O texto da premiação pode ter até 1000 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)
        season.prize_notes = text
        season.save(update_fields=['prize_notes'])
        cache.delete('dashboard_data')  # o dashboard guarda a temporada atual em cache
        return Response({'number': season.number, 'prize_notes': season.prize_notes})

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
        qs = StarHistory.objects.select_related('player', 'given_by', 'gameday', 'reverted_by__given_by').order_by('-created_at')[:200]
        show_author = is_staff_profile(request.user)  # quem lançou: só a staff vê
        data = []
        for h in qs:
            data.append({
                'given_by_id': h.given_by_id if show_author else None,
                'given_by_name': h.given_by.name if show_author and h.given_by else None,
                'given_by_profile': h.given_by.profile if show_author and h.given_by else None,
                'gameday': {'id': h.gameday_id, 'date': h.gameday.date, 'description': h.gameday.description or ''} if h.gameday else None,
                'reverts_id': h.reverts_id,
                'undone_by': _undone_by(h, show_author),
                'id': h.id,
                'player_id': h.player_id,
                'player_name': h.player.display_name,
                'avatar_url': request.build_absolute_uri(h.player.avatar.url) if h.player.avatar else None,
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
        can_see_overall = is_staff_profile(request.user) or player.user_id == request.user.id

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

        # Presença: mesma regra das faltas (dias com circuito realizado, ida = check-in na quadra)
        season = ensure_current_season()
        career_freq = frequency(player, circuit_days())
        season_freq = frequency(player, circuit_days(season.start_date, season.end_date))

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

        # Posição e pontos no Fire Shark (mesma regra de todas as telas; inativo/convidado não tem posição)
        fire = fire_shark_ranking(season)
        fire_me = next((p for p in fire if p.id == player.id), None)
        win_rank = fire.index(fire_me) + 1 if fire_me else None

        # Números da temporada (os rankings são por temporada; os totais acima são da carreira)
        st = season_stats(season)
        mine = st.get(player.id, {'matches': 0, 'wins': 0, 'balance': 0})
        season_block = {
            'number': season.number,
            'name': season.name,
            'matches': mine['matches'],
            'wins': mine['wins'],
            'losses': mine['matches'] - mine['wins'],
            'win_rate': round(mine['wins'] / mine['matches'] * 100, 1) if mine['matches'] else 0,
            'point_balance': mine['balance'],
            'fire_shark_rank': win_rank,
            'fire_score': fire_me.fire_score if fire_me else None,
            'fire_points': fire_me.fire_points if fire_me else None,
            'fire_circuits': fire_me.circuits if fire_me else 0,
            'gladiator_rank': wins_positions(season).get(player.id),
            'attendance_rate': season_freq['rate'],
            'attended_days': season_freq['attended_days'],
            'total_days': season_freq['total_days'],
        }

        last_star = StarHistory.objects.filter(player=player, action='add').exclude(category='promotion').order_by('-created_at').first()
        latest_mini_star = last_star.category if last_star else None

        # Sequência de vitórias: da partida mais recente para trás (vários jogos no mesmo dia seguem a ordem de cadastro)
        streak = 0
        results = (player.match_appearances.filter(match_team__isnull=False)
                   .order_by('-match__date', '-match__created_at', '-match_id')
                   .values_list('match_team__winner', flat=True))
        for won in results:
            if not won:
                break
            streak += 1

        return Response({
            'player_id': player.id,
            'total_matches': total_matches,
            'wins': wins,
            'losses': losses,
            'draws': draws,
            'win_rate': win_rate,
            'win_streak': streak,
            'mvps': mvps,
            'total_gamedays': career_freq['total_days'],
            'attended_gamedays': career_freq['attended_days'],
            'attendance_rate': career_freq['rate'],
            # A nota (overall) e o histórico dela: só a staff e o próprio atleta
            'overall_history': list(evaluations) if can_see_overall else [],
            'overall_rank': overall_rank if can_see_overall else None,
            'win_rank': win_rank,
            'latest_mini_star': latest_mini_star,
            'season': season_block,
        })

    @action(detail=True, methods=['get'], url_path='elo-history')
    def elo_history(self, request, pk=None):
        """Elo da temporada partida a partida, para o gráfico do perfil. O atleta só vê o próprio."""
        from apps.matches.models import MatchTeam
        from .elo_service import ELO_START

        player = self.get_object()
        if not is_staff_profile(request.user) and player.user_id != request.user.id:
            return Response({'detail': 'Você só pode ver a sua própria evolução.'}, status=status.HTTP_403_FORBIDDEN)

        season = ensure_current_season()
        rows = MatchPlayer.objects.filter(player=player, match_team__isnull=False, match__date__lte=season.end_date)
        if season.start_date:
            rows = rows.filter(match__date__gte=season.start_date)
        # Mesma ordem do cálculo do Elo (data, hora de cadastro e partida)
        rows = list(rows.order_by('match__date', 'match__created_at', 'match_id').values(
            'match_id', 'match__date', 'match_team_id', 'elo_delta',
        ))

        teams = {}
        for match_id, team_id, score, winner in MatchTeam.objects.filter(
            match_id__in=[r['match_id'] for r in rows]
        ).values_list('match_id', 'id', 'score', 'winner'):
            teams.setdefault(match_id, {})[team_id] = (score, winner)

        elo = float(ELO_START)
        matches = []
        for r in rows:
            delta = r['elo_delta'] or 0.0
            elo += delta
            match_teams = teams.get(r['match_id'], {})
            score, won = match_teams.get(r['match_team_id'], (None, False))
            others = [s for t, (s, _w) in match_teams.items() if t != r['match_team_id']]
            has_winner = any(w for _s, w in match_teams.values())
            matches.append({
                'match_id': r['match_id'],
                'date': r['match__date'],
                'result': 'win' if won else ('loss' if has_winner else 'draw'),
                'score': score,
                'opponent_score': max(others) if others else None,
                'delta': round(delta, 1),
                'elo': round(elo, 1),
            })
        return Response({'season': season.name, 'start': ELO_START, 'current': round(player.elo, 1), 'matches': matches})

    @action(detail=False, methods=['get', 'patch'], url_path='me', permission_classes=[IsAuthenticated])
    def me(self, request):
        """Retorna o Player vinculado ao usuário logado (para portal do atleta). PATCH: o atleta edita os campos liberados."""
        mine = Player.objects.filter(user=request.user).select_related('user').prefetch_related('evaluations')
        player = mine.first()
        if not player:
            return Response({'detail': 'Nenhum perfil de atleta vinculado a este usuário.'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'PATCH':
            form = MyProfileSerializer(player, data=request.data, partial=True)
            form.is_valid(raise_exception=True)
            form.save()
            player = mine.first()
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
        from apps.core.sessions import end_all_sessions
        end_all_sessions(player.user)  # quem estava logado com a senha antiga sai

        return Response({
            'detail': 'Senha redefinida com sucesso!',
            'email': player.user.email,
            'password': new_password,
            'player_name': player.display_name,
        })

    @action(detail=True, methods=['post'], url_path='recalculate-elo')
    def recalculate_elo(self, request, pk=None):
        """Recalcula o Elo de um jogador específico. Apenas admin."""
        if not IsAdminUser().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)

        from .elo_service import recalculate_elo as _recalc
        player = self.get_object()
        new_elo = _recalc(player)  # o Elo de um depende de todos: recalcula a temporada inteira
        return Response({'elo': new_elo, 'elo_tier': player.elo_tier})

    @action(detail=False, methods=['post'], url_path='recalculate-all-elos')
    def recalculate_all_elos(self, request):
        """Recalcula o Elo de todos os jogadores. Apenas admin."""
        if not IsAdminUser().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)

        from .elo_service import recalculate_all
        recalculate_all()
        return Response({'detail': f'Elo recalculado para {Player.objects.count()} jogadores.'})


class BadgeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Badge.objects.all()
    serializer_class = BadgeSerializer
