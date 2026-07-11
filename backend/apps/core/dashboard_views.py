from django.utils import timezone
from datetime import date
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.players.models import Player
from apps.evaluations.models import Evaluation
from apps.attendance.models import GameDay, Attendance


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        total_players = Player.objects.count()
        active_players = Player.objects.filter(status='active').count()

        # Presença de hoje
        today = date.today()
        today_gameday = GameDay.objects.filter(date=today).first()
        present_today = 0
        if today_gameday:
            present_today = Attendance.objects.filter(
                gameday=today_gameday, present=True
            ).count()

        # Overall médio
        from django.db.models import Avg
        avg_overall = Evaluation.objects.filter(
            player__status='active'
        ).values('player').annotate(
            last_overall=Avg('overall')
        ).aggregate(avg=Avg('last_overall'))['avg'] or 0

        # Top jogadores
        top_players = []
        from apps.evaluations.models import Evaluation
        from apps.players.models import Player as PlayerModel
        players_with_eval = PlayerModel.objects.filter(status='active').prefetch_related('evaluations')
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
        from django.db.models.functions import TruncMonth
        from django.db.models import Count
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

        return Response({
            'total_players': total_players,
            'active_players': active_players,
            'present_today': present_today,
            'avg_overall': round(float(avg_overall), 2),
            'top_players': top_players,
            'position_distribution': position_dist,
            'last_updated': timezone.now().isoformat(),
        })
