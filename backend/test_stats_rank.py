import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.players.models import Player, StarHistory
from django.db.models import Count, Q, Subquery, OuterRef
from django.db.models.functions import Coalesce
from apps.evaluations.models import Evaluation

player = Player.objects.first()
print("Player:", player)

latest_eval = Evaluation.objects.filter(player=OuterRef('pk')).order_by('-date').values('overall')[:1]
qs_players = Player.objects.filter(status='active', is_guest=False).annotate(
    annotated_overall=Coalesce(Subquery(latest_eval), 0.0),
    wins_count=Count('match_appearances', filter=Q(match_appearances__match_team__winner=True), distinct=True),
    total_matches_count=Count('match_appearances', distinct=True)
)

player_overall = player.latest_overall or 0
overall_rank = qs_players.filter(annotated_overall__gt=player_overall).count() + 1
print("Overall Rank:", overall_rank)

total_matches = qs_players.get(id=player.id).total_matches_count
wins = qs_players.get(id=player.id).wins_count

win_rank = None
if total_matches >= 10:
    bayesian_score = ((wins + 5) / (total_matches + 10)) * 100
    better_count = 0
    for p in qs_players.filter(total_matches_count__gte=10):
        p_score = ((p.wins_count + 5) / (p.total_matches_count + 10)) * 100
        if p_score > bayesian_score:
            better_count += 1
        elif p_score == bayesian_score and p.wins_count > wins:
            better_count += 1
    win_rank = better_count + 1

print("Win Rank:", win_rank)

last_star = StarHistory.objects.filter(player=player, action='add').order_by('-created_at').first()
latest_mini_star = last_star.category if last_star else None
print("Latest Star:", latest_mini_star)
