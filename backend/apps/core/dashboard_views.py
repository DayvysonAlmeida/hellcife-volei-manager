from django.utils import timezone
from datetime import date
from django.db.models import Count, Q, Max
from django.core.cache import cache

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.players.models import Player
from apps.attendance.models import Attendance
from apps.matches.models import MatchPlayer
from apps.halloffame.models import HallOfFameEntry


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]
    CACHE_KEY = 'dashboard_data'
    CACHE_TTL = 60 * 3  # 3 minutos

    def get(self, request):
        cached = cache.get(self.CACHE_KEY)
        if cached:
            return Response(cached)

        data = self._build_data()
        cache.set(self.CACHE_KEY, data, self.CACHE_TTL)
        return Response(data)

    def _build_data(self):
        # Contagens básicas (ignorando convidados)
        total_players = Player.objects.filter(is_guest=False).count()
        active_count = Player.objects.filter(status='active', is_guest=False).count()

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

        # Destaques — Top 3 jogadores com mais premiações usando os totais absolutos no model Player
        highlight_fields = {
            'mvp': 'total_mvp',
            'best_attacker': 'total_attack',
            'best_defender': 'total_defense',
        }

        highlights = {}
        for key, field in highlight_fields.items():
            top = Player.objects.filter(**{f"{field}__gt": 0}).order_by(f"-{field}")
            highlights[key] = [
                {
                    'id': p.id,
                    'name': p.display_name,
                    'avatar_url': p.avatar_url,
                    'mini_stars': p.mini_stars,
                    'big_stars': p.big_stars,
                    'count': getattr(p, field)
                }
                for p in top
            ]

        # Distribuição por Posição (ignorando convidados)
        position_distribution = list(
            Player.objects.filter(status='active', is_guest=False)
            .values('main_position')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        # Formatar a saída
        pos_dict = dict(Player.POSITION_CHOICES)
        formatted_distribution = [
            {'position': pos_dict.get(item['main_position'], item['main_position']), 'count': item['count']}
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


        # 4. Top Estrelas — top 10 ordenados por big_stars desc, depois mini_stars desc
        top_stars_qs = (
            Player.objects.filter(status='active', is_guest=False)
            .order_by('-big_stars', '-mini_stars', 'name')[:10]
        )
        top_stars = []
        for p in top_stars_qs:
            top_stars.append({
                'id': p.id,
                'name': p.display_name,
                'avatar_url': p.avatar_url,
                'mvp_stars': p.mvp_stars,
                'attack_stars': p.attack_stars,
                'defense_stars': p.defense_stars,
                'setter_stars': p.setter_stars,
                'pass_stars': p.pass_stars,
                'block_stars': p.block_stars,
                'mini_stars': p.mini_stars,
                'big_stars': p.big_stars,
            })

        # 5. Novos Estrelados (Últimos 5 atletas com estrelas atualizadas recentemente)
        new_stars_qs = Player.objects.filter(
            Q(mini_stars__gt=0) | Q(big_stars__gt=0),
            status='active',
            is_guest=False
        ).annotate(
            latest_star_date=Max('star_history__created_at')
        ).order_by('-latest_star_date')[:5]

        new_stars = []
        for p in new_stars_qs:
            # Descobrir qual categoria tem mais estrelas (a principal conquista)
            cats = {
                'mvp': p.mvp_stars or 0,
                'attack': p.attack_stars or 0,
                'defense': p.defense_stars or 0,
                'setter': p.setter_stars or 0,
                'pass': p.pass_stars or 0,
                'block': p.block_stars or 0,
            }
            top_cat = max(cats, key=lambda k: cats[k]) if any(cats.values()) else None
            new_stars.append({
                'id': p.id,
                'name': p.display_name,
                'avatar_url': p.avatar_url,
                'mvp_stars': p.mvp_stars,
                'attack_stars': p.attack_stars,
                'defense_stars': p.defense_stars,
                'setter_stars': p.setter_stars,
                'pass_stars': p.pass_stars,
                'block_stars': p.block_stars,
                'mini_stars': p.mini_stars,
                'big_stars': p.big_stars,
                'top_category': top_cat,
                'updated_at': p.updated_at.isoformat(),
            })

        return {
            'total_players': total_players,
            'active_players': active_count,
            'present_today': present_today,
            'paid_today': paid_today,
            'top_winners': top_winners,
            'position_distribution': formatted_distribution,
            'highlights': highlights,
            'hall_of_fame': hall_of_fame_list,

            'top_stars': top_stars,
            'new_stars': new_stars,
            'last_updated': timezone.now().isoformat(),
        }
