from django.utils import timezone
from datetime import date
from django.db.models import Count, Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.players.models import Player
from apps.attendance.models import Attendance
from apps.matches.models import MatchPlayer
from apps.halloffame.models import HallOfFameEntry


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Contagens básicas
        total_players = Player.objects.count()
        active_count = Player.objects.filter(status='active').count()

        # Presença de hoje
        today = date.today()
        today_stats = Attendance.objects.filter(
            gameday__date=today
        ).aggregate(
            present_today=Count('id', filter=Q(present=True)),
            paid_today=Count('id', filter=Q(present=True, has_paid=True)),
        )
        present_today = today_stats['present_today'] or 0
        paid_today = today_stats['paid_today'] or 0

        # Maiores Vencedores (Jogadores com mais vitórias nas partidas)
        top_winners_qs = (
            Player.objects.filter(status='active', match_appearances__match_team__winner=True)
            .annotate(wins=Count('match_appearances', filter=Q(match_appearances__match_team__winner=True)))
            .order_by('-wins')[:10]
        )
        
        top_winners = []
        for p in top_winners_qs:
            top_winners.append({
                'id': p.id,
                'name': p.name,
                'nickname': p.nickname,
                'position': p.main_position,
                'mini_stars': p.mini_stars,
                'big_stars': p.big_stars,
                'avatar_url': p.avatar_url,
                'wins': p.wins,
            })

        # Destaques — Top 3 jogadores com mais premiações por categoria
        highlight_fields = {
            'mvp': 'mvp',
            'best_attacker': 'best_attacker',
            'best_server': 'best_server',
            'best_defender': 'best_defender',
            'best_setter': 'best_setter',
            'best_libero': 'best_libero',
            'best_blocker': 'best_blocker',
            'best_opposite': 'best_opposite',
        }

        highlights = {}
        # Collect all aggregations first (8 queries — one per category)
        raw_highlights = {}
        for key, field in highlight_fields.items():
            raw_highlights[key] = list(
                MatchPlayer.objects.filter(**{field: True}, player__status='active')
                .values('player')
                .annotate(count=Count('id'))
                .order_by('-count')[:3]
            )

        # Collect ALL unique player IDs across all categories (to batch load)
        all_player_ids = set()
        for aggs in raw_highlights.values():
            for agg in aggs:
                all_player_ids.add(agg['player'])

        # 1 single query to load all needed players
        players_map = {}
        if all_player_ids:
            for p in Player.objects.filter(id__in=all_player_ids).only(
                'id', 'name', 'nickname', 'avatar', 'mini_stars', 'big_stars'
            ):
                players_map[p.id] = p

        # Build the response using the pre-loaded map
        for key, aggs in raw_highlights.items():
            top_list = []
            for agg in aggs:
                player = players_map.get(agg['player'])
                if player:
                    top_list.append({
                        'id': player.id,
                        'name': player.display_name,
                        'avatar_url': player.avatar_url,
                        'mini_stars': player.mini_stars,
                        'big_stars': player.big_stars,
                        'count': agg['count']
                    })
            highlights[key] = top_list

        # Distribuição por Posição
        position_distribution = list(
            Player.objects.filter(status='active')
            .values('main_position')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        # Formatar a saída
        formatted_distribution = [
            {'position': item['main_position'].capitalize(), 'count': item['count']}
            for item in position_distribution
        ]

        # Hall da Fama Oficial
        hall_of_fame_qs = HallOfFameEntry.objects.select_related('player').order_by('-year', 'category')
        hall_of_fame_list = []
        for entry in hall_of_fame_qs:
            hall_of_fame_list.append({
                'id': entry.id,
                'player_name': entry.player.display_name,
                'avatar_url': entry.player.avatar_url,
                'category': entry.get_category_display(),
                'year': entry.year,
            })

        # Cálculos Dinâmicos Especiais
        # 1. Mais Presente
        most_present_agg = Attendance.objects.filter(present=True, player__status='active').values('player').annotate(count=Count('id')).order_by('-count').first()
        most_present = None
        if most_present_agg:
            p_mp = Player.objects.get(id=most_present_agg['player'])
            most_present = {'id': p_mp.id, 'name': p_mp.display_name, 'avatar_url': p_mp.avatar_url, 'count': most_present_agg['count']}
            
        # 2. MVP da Temporada (Mais MVPs no ano atual)
        season_mvp_agg = MatchPlayer.objects.filter(mvp=True, player__status='active', match__date__year=today.year).values('player').annotate(count=Count('id')).order_by('-count').first()
        season_mvp = None
        if season_mvp_agg:
            p_mvp = Player.objects.get(id=season_mvp_agg['player'])
            season_mvp = {'id': p_mvp.id, 'name': p_mvp.display_name, 'avatar_url': p_mvp.avatar_url, 'count': season_mvp_agg['count']}
            
        # 3. Revelação (Jogador com registro mais recente que mais jogou)
        revelation_player = Player.objects.filter(status='active', created_at__year=today.year).annotate(matches=Count('match_appearances')).order_by('-matches', '-created_at').first()
        revelation = None
        if revelation_player:
            revelation = {'id': revelation_player.id, 'name': revelation_player.display_name, 'avatar_url': revelation_player.avatar_url, 'matches': revelation_player.matches}

        return Response({
            'total_players': total_players,
            'active_players': active_count,
            'present_today': present_today,
            'paid_today': paid_today,
            'top_winners': top_winners,
            'position_distribution': formatted_distribution,
            'highlights': highlights,
            'hall_of_fame': hall_of_fame_list,
            'most_present': most_present,
            'season_mvp': season_mvp,
            'revelation': revelation,
            'last_updated': timezone.now().isoformat(),
        })
