from django.utils import timezone
from datetime import date
from django.db.models import Avg, Count
from django.db.models.functions import TruncMonth

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.players.models import Player
from apps.evaluations.models import Evaluation
from apps.attendance.models import GameDay, Attendance
from apps.matches.models import MatchPlayer

class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        total_players = Player.objects.count()
        active_players = Player.objects.filter(status='active').count()

        # Presença de hoje
        today = date.today()
        today_gameday = GameDay.objects.filter(date=today).first()
        present_today = 0
        paid_today = 0
        if today_gameday:
            present_today = Attendance.objects.filter(
                gameday=today_gameday, present=True
            ).count()
            paid_today = Attendance.objects.filter(
                gameday=today_gameday, present=True, has_paid=True
            ).count()

        # Overall médio
        avg_overall = Evaluation.objects.filter(
            player__status='active'
        ).values('player').annotate(
            last_overall=Avg('overall')
        ).aggregate(avg=Avg('last_overall'))['avg'] or 0

        # Top jogadores
        players_with_eval = Player.objects.filter(status='active').prefetch_related('evaluations')
        player_overalls = []
        for p in players_with_eval:
            last_eval = p.evaluations.order_by('-date').first()
            if last_eval:
                player_overalls.append({
                    'id': p.id,
                    'name': p.name,
                    'nickname': p.nickname,
                    'position': p.main_position,
                    'overall': last_eval.overall,
                    'avatar_url': p.avatar_url,
                    'shirt_number': p.shirt_number,
                })
        top_players = sorted(player_overalls, key=lambda x: x['overall'], reverse=True)[:10]

        # Evolução mensal (últimos 6 meses)
        monthly = (
            Evaluation.objects
            .filter(date__gte=timezone.now().date().replace(day=1))
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(count=Count('id'), avg=Avg('overall'))
            .order_by('month')
        )

        # Distribuição por posição
        position_dist = []
        for pos_code, pos_name in Player.POSITION_CHOICES:
            count = Player.objects.filter(main_position=pos_code, status='active').count()
            if count > 0:
                position_dist.append({'position': pos_name, 'count': count})

        # Club Radar (média das últimas avaliações de todos os jogadores ativos)
        club_radar = {}
        if players_with_eval:
            skills_keys = [
                'serve', 'reception', 'passing', 'setting', 'attack', 'block',
                'defense', 'recovery', 'positioning', 'communication',
                'tactical_iq', 'conditioning', 'consistency'
            ]
            sums = {k: 0.0 for k in skills_keys}
            count = 0
            for p in players_with_eval:
                last_eval = p.evaluations.order_by('-date').first()
                if last_eval:
                    for k in skills_keys:
                        sums[k] += getattr(last_eval, k, 0)
                    count += 1
            if count > 0:
                club_radar = {k: round(v / count, 1) for k, v in sums.items()}

        # Destaques (Scouts)
        def get_top(field):
            top_agg = MatchPlayer.objects.filter(**{field: True}).values(
                'player'
            ).annotate(count=Count('id')).order_by('-count').first()
            
            if top_agg:
                player = Player.objects.get(id=top_agg['player'])
                return {
                    'id': player.id,
                    'name': player.display_name,
                    'avatar_url': player.avatar_url,
                    'count': top_agg['count']
                }
            return None

        highlights = {
            'mvp': get_top('mvp'),
            'best_attacker': get_top('best_attacker'),
            'best_server': get_top('best_server'),
            'best_defender': get_top('best_defender'),
        }

        return Response({
            'total_players': total_players,
            'active_players': active_players,
            'present_today': present_today,
            'paid_today': paid_today,
            'avg_overall': round(float(avg_overall), 2),
            'top_players': top_players,
            'position_distribution': position_dist,
            'club_radar': club_radar,
            'highlights': highlights,
            'last_updated': timezone.now().isoformat(),
        })
