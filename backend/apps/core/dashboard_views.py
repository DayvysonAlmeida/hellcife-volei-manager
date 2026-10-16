from django.utils import timezone
from datetime import date
from django.db.models import Count, Q, Max, F
from django.core.cache import cache

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.players.models import Player
from apps.attendance.models import Attendance
from apps.matches.models import MatchPlayer
from apps.halloffame.models import HallOfFameEntry
from apps.players.rankings import fire_shark_ranking, season_payload, stars_ranking, wins_ranking


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

        # Próximo Circuito (ou o atual aberto)
        from apps.attendance.models import GameDay
        next_gameday = GameDay.objects.filter(is_closed=False).order_by('date').first()
        next_circuit = None
        if next_gameday:
            total_present = next_gameday.total_present
            total_unpaid = next_gameday.attendances.filter(present=True, has_paid=False).count()
            next_circuit = {
                'id': next_gameday.id,
                'date': next_gameday.date.isoformat(),
                'description': next_gameday.description,
                'location': next_gameday.location,
                'max_players': next_gameday.max_players,
                'total_present': total_present,
                'court_price': float(next_gameday.court_price) if next_gameday.court_price else 0,
                'total_unpaid': total_unpaid,
            }

        # Gráfico de Tendência de Presença (Últimos 6 circuitos)
        last_gamedays = GameDay.objects.order_by('-date')[:6]
        attendance_trend = []
        for gd in reversed(last_gamedays):
            pres = gd.total_present
            rate = int((pres / gd.max_players) * 100) if gd.max_players and gd.max_players > 0 else 0
            attendance_trend.append({
                'date': gd.date.strftime('%d/%m'),
                'rate': rate,
                'present': pres,
                'max': gd.max_players
            })

        # Top 5 Assíduos
        top_attendees_qs = (
            Player.objects.filter(status='active', is_guest=False)
            .annotate(presence_count=Count('attendances', filter=Q(attendances__present=True)))
            .order_by('-presence_count')[:5]
        )
        top_attendees = [
            {
                'id': p.id,
                'name': p.name,
                'avatar_url': p.avatar_url,
                'presence_count': p.presence_count
            } for p in top_attendees_qs if p.presence_count > 0
        ]

        # Maiores Vencedores (Jogadores com mais vitórias nas partidas)
        top_winners_qs = wins_ranking().filter(wins__gt=0)[:10]
        
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

        # -------------------------------------------------------------
        # Ranking Fire Shark (Aproveitamento Global - Min 10 jogos)
        # -------------------------------------------------------------
        fire_list = [
            {
                'id': p.id,
                'name': p.display_name,
                'avatar_url': p.avatar_url,
                'position': p.main_position,
                'wins': p.wins,
                'total_matches': p.total_matches,
                'win_rate': round(p.win_rate, 1),
                'score': round(p.fire_score, 1),
            }
            for p in fire_shark_ranking()
        ]
        fire_sharks = fire_list[:10]

        # -------------------------------------------------------------
        # Dream Team (O melhor de cada posição pelo Fire Shark Win Rate)
        # -------------------------------------------------------------
        dream_team = []
        # Definimos as posições essenciais para o Dream Team
        positions_needed = ['setter', 'libero', 'opposite', 'outside', 'middle', 'universal']
        
        for pos in positions_needed:
            best = None
            for p in fire_list:
                if p['position'] == pos:
                    best = p
                    break  # already sorted by best score
            if best:
                dream_team.append(best)

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
        top_stars_qs = stars_ranking()[:10]
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
        ).prefetch_related('star_history').order_by(F('latest_star_date').desc(nulls_last=True))[:6]

        new_stars = []
        for p in new_stars_qs:
            # Tentar pegar a categoria do prêmio mais recente recebido sem causar N+1
            histories = [sh for sh in p.star_history.all() if sh.action == 'add' and sh.category != 'promotion']
            if histories:
                histories.sort(key=lambda x: x.created_at, reverse=True)
                top_cat = histories[0].category
            else:
                # Fallback para o legado caso o histórico seja vazio
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
            'next_circuit': next_circuit,
            'attendance_trend': attendance_trend,
            'top_attendees': top_attendees,
            'top_winners': top_winners,
            'position_distribution': formatted_distribution,
            'fire_sharks': fire_sharks,
            'season': season_payload(),
            'dream_team': dream_team,
            'hall_of_fame': hall_of_fame_list,

            'top_stars': top_stars,
            'new_stars': new_stars,
            'last_updated': timezone.now().isoformat(),
        }
