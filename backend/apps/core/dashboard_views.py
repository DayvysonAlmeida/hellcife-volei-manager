from django.utils import timezone
from datetime import date
from django.db.models import Avg, Count, Subquery, OuterRef, FloatField, Q
from django.db.models.functions import Coalesce

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
        # Subquery para pegar o overall da avaliação mais recente de cada jogador
        latest_eval_subquery = Evaluation.objects.filter(
            player=OuterRef('pk')
        ).order_by('-date').values('overall')[:1]

        # Jogadores ativos com overall anotado (1 query)
        active_players = Player.objects.filter(status='active').annotate(
            annotated_overall=Coalesce(
                Subquery(latest_eval_subquery, output_field=FloatField()),
                0.0
            )
        )

        # Contagens básicas (2 queries)
        total_players = Player.objects.count()
        active_count = active_players.count()

        # Presença de hoje (1-2 queries)
        today = date.today()
        today_stats = Attendance.objects.filter(
            gameday__date=today
        ).aggregate(
            present_today=Count('id', filter=Q(present=True)),
            paid_today=Count('id', filter=Q(present=True, has_paid=True)),
        )
        present_today = today_stats['present_today'] or 0
        paid_today = today_stats['paid_today'] or 0

        # Overall médio dos jogadores ativos avaliados (1 query, reusa annotation)
        avg_overall_data = active_players.filter(
            annotated_overall__gt=0
        ).aggregate(avg=Avg('annotated_overall'))
        avg_overall = avg_overall_data['avg'] or 0

        # Top 10 jogadores por overall (1 query, reusa annotation)
        top_players = list(
            active_players.filter(annotated_overall__gt=0)
            .order_by('-annotated_overall')
            .values(
                'id', 'name', 'nickname', 'main_position',
                'shirt_number', 'avatar',
            )[:10]
        )
        # Formata top_players para a resposta
        top_players_result = []
        for p in top_players:
            avatar_url = None
            if p['avatar']:
                avatar_url = f"/media/{p['avatar']}"
            top_players_result.append({
                'id': p['id'],
                'name': p['name'],
                'nickname': p['nickname'],
                'position': p['main_position'],
                'overall': round(
                    active_players.filter(id=p['id'])
                    .values_list('annotated_overall', flat=True).first() or 0, 2
                ),
                'avatar_url': avatar_url,
                'shirt_number': p['shirt_number'],
            })

        # Reprocessa top_players usando os dados já annotados (sem queries extras)
        top_annotated = list(
            active_players.filter(annotated_overall__gt=0)
            .order_by('-annotated_overall')
            .values('id', 'name', 'nickname', 'main_position',
                    'shirt_number', 'avatar', 'annotated_overall')[:10]
        )
        top_players_result = []
        for p in top_annotated:
            avatar_url = f"/media/{p['avatar']}" if p['avatar'] else None
            top_players_result.append({
                'id': p['id'],
                'name': p['name'],
                'nickname': p['nickname'],
                'position': p['main_position'],
                'overall': round(p['annotated_overall'], 2),
                'avatar_url': avatar_url,
                'shirt_number': p['shirt_number'],
            })

        # Distribuição por posição (1 query)
        position_dist_qs = (
            Player.objects.filter(status='active')
            .values('main_position')
            .annotate(count=Count('id'))
            .filter(count__gt=0)
        )
        position_labels = dict(Player.POSITION_CHOICES)
        position_dist = [
            {'position': position_labels.get(item['main_position'], item['main_position']),
             'count': item['count']}
            for item in position_dist_qs
        ]

        # Club Radar — média dos fundamentos da última avaliação de cada jogador ativo (1 query)
        skills_keys = [
            'serve', 'reception', 'passing', 'setting', 'attack', 'block',
            'defense', 'recovery', 'positioning', 'communication',
            'tactical_iq', 'conditioning', 'consistency'
        ]
        # Subquery para IDs das últimas avaliações de jogadores ativos
        latest_eval_ids = Evaluation.objects.filter(
            player__status='active'
        ).order_by('player', '-date').distinct('player').values('id')

        # Em SQLite, distinct('player') não funciona, então usamos uma abordagem alternativa
        # que funciona tanto em SQLite quanto em PostgreSQL
        club_radar = {}
        latest_evals_subquery = Evaluation.objects.filter(
            player=OuterRef('pk'),
            player__status='active'
        ).order_by('-date')

        radar_annotations = {}
        for skill in skills_keys:
            radar_annotations[f'latest_{skill}'] = Coalesce(
                Subquery(
                    latest_evals_subquery.values(skill)[:1],
                    output_field=FloatField()
                ),
                0.0
            )

        radar_data = (
            Player.objects.filter(status='active', evaluations__isnull=False)
            .annotate(**radar_annotations)
            .aggregate(**{
                f'avg_{skill}': Avg(f'latest_{skill}')
                for skill in skills_keys
            })
        )

        club_radar = {
            skill: round(radar_data.get(f'avg_{skill}', 0) or 0, 1)
            for skill in skills_keys
        }

        # Destaques — jogadores com mais premiações (1 query com annotations)
        highlight_fields = {
            'mvp': 'mvp',
            'best_attacker': 'best_attacker',
            'best_server': 'best_server',
            'best_defender': 'best_defender',
        }

        highlights = {}
        for key, field in highlight_fields.items():
            top_agg = (
                MatchPlayer.objects.filter(**{field: True})
                .values('player')
                .annotate(count=Count('id'))
                .order_by('-count')
                .first()
            )
            if top_agg:
                player = Player.objects.only(
                    'id', 'name', 'nickname', 'avatar'
                ).get(id=top_agg['player'])
                highlights[key] = {
                    'id': player.id,
                    'name': player.display_name,
                    'avatar_url': player.avatar_url,
                    'count': top_agg['count']
                }
            else:
                highlights[key] = None

        return Response({
            'total_players': total_players,
            'active_players': active_count,
            'present_today': present_today,
            'paid_today': paid_today,
            'avg_overall': round(float(avg_overall), 2),
            'top_players': top_players_result,
            'position_distribution': position_dist,
            'club_radar': club_radar,
            'highlights': highlights,
            'last_updated': timezone.now().isoformat(),
        })
