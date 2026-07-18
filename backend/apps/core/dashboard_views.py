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
        }

        highlights = {}
        for key, field in highlight_fields.items():
            top_aggs = (
                MatchPlayer.objects.filter(**{field: True}, player__status='active')
                .values('player')
                .annotate(count=Count('id'))
                .order_by('-count')[:3]
            )
            
            top_list = []
            for agg in top_aggs:
                player = Player.objects.only(
                    'id', 'name', 'nickname', 'avatar', 'mini_stars', 'big_stars'
                ).get(id=agg['player'])
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

        return Response({
            'total_players': total_players,
            'active_players': active_count,
            'present_today': present_today,
            'paid_today': paid_today,
            'top_winners': top_winners,
            'position_distribution': formatted_distribution,
            'highlights': highlights,
            'hall_of_fame': hall_of_fame_list,
            'last_updated': timezone.now().isoformat(),
        })
