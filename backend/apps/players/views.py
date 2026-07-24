from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q, Subquery, OuterRef, FloatField, Case, When, IntegerField
from django.db.models.functions import Coalesce

from .models import Player, StarHistory
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
            qs = qs.prefetch_related('match_appearances__match_team__match')
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

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == 'list':
            # Calcula o rank global absoluto imune a paginação e filtros (DenseRank)
            global_qs = Player.objects.annotate(
                w=Count('match_appearances', filter=Q(match_appearances__match_team__winner=True), distinct=True)
            ).filter(w__gt=0).values('id', 'w').order_by('-w')
            
            ranks = {}
            current_rank = 1
            last_w = None
            for p in global_qs:
                if last_w is not None and p['w'] < last_w:
                    current_rank += 1
                ranks[p['id']] = current_rank
                last_w = p['w']
            context['global_win_ranks'] = ranks
        return context

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'update_stars']:
            return [IsAdminOrModerator()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['patch'], url_path='update_stars')
    def update_stars(self, request, pk=None):
        """
        Atualiza as estrelas por categoria de um atleta.
        Aceita: { mvp_stars, attack_stars, defense_stars } (0–5 cada)
        Aplica a lógica Opção B: ao atingir 15, big_stars sobe e categorias resetam.
        """
        player = self.get_object()

        old_mvp = player.mvp_stars or 0
        old_attack = player.attack_stars or 0
        old_defense = player.defense_stars or 0

        mvp = int(request.data.get('mvp_stars', old_mvp))
        attack = int(request.data.get('attack_stars', old_attack))
        defense = int(request.data.get('defense_stars', old_defense))

        # Validação de range
        for name, val in [('mvp_stars', mvp), ('attack_stars', attack), ('defense_stars', defense)]:
            if not (0 <= val <= 5):
                return Response(
                    {name: f'Deve ser entre 0 e 5. Recebido: {val}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Calcula o delta das estrelas
        diff_mvp = mvp - old_mvp
        diff_attack = attack - old_attack
        diff_defense = defense - old_defense

        player.total_mvp += max(0, diff_mvp)
        player.total_attack += max(0, diff_attack)
        player.total_defense += max(0, diff_defense)

        player.mvp_stars = mvp
        player.attack_stars = attack
        player.defense_stars = defense

        prev_big_stars = player.big_stars or 0
        player.promote_stars()
        new_big_stars = player.big_stars or 0

        # Salva as alterações
        player.save(update_fields=[
            'mvp_stars', 'attack_stars', 'defense_stars',
            'mini_stars', 'big_stars', 'updated_at',
            'total_mvp', 'total_attack', 'total_defense'
        ])

        # Cria os registros de histórico de estrelas
        history_to_create = []
        if diff_mvp != 0:
            history_to_create.append(StarHistory(player=player, category='mvp', action='add' if diff_mvp > 0 else 'remove', count=abs(diff_mvp)))
        if diff_attack != 0:
            history_to_create.append(StarHistory(player=player, category='attack', action='add' if diff_attack > 0 else 'remove', count=abs(diff_attack)))
        if diff_defense != 0:
            history_to_create.append(StarHistory(player=player, category='defense', action='add' if diff_defense > 0 else 'remove', count=abs(diff_defense)))
            
        if new_big_stars > prev_big_stars:
            history_to_create.append(StarHistory(player=player, category='promotion', action='promote', count=new_big_stars - prev_big_stars))

        if history_to_create:
            StarHistory.objects.bulk_create(history_to_create)

        # Invalida cache do dashboard para refletir nova pontuação
        from django.core.cache import cache
        cache.delete('dashboard_data')

        return Response({
            'id': player.id,
            'mvp_stars': player.mvp_stars,
            'attack_stars': player.attack_stars,
            'defense_stars': player.defense_stars,
            'mini_stars': player.mini_stars,
            'big_stars': player.big_stars,
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
