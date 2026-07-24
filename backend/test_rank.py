import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.players.models import Player
from django.db.models import Count, Q, F
from django.db.models.expressions import Window
from django.db.models.functions import Rank, DenseRank

# Simulando o que o DjangoFilterBackend e OrderingFilter fazem:
# Eles ordenam a queryset no final.
qs = Player.objects.all().annotate(
    wins=Count('match_appearances', filter=Q(match_appearances__match_team__winner=True), distinct=True)
).annotate(
    win_rank=Window(
        expression=Rank(),
        order_by=F('wins').desc()
    )
).order_by('name')

print('--- Todos os jogadores ---')
for p in qs[:20]:
    print(f"{p.name} - Wins: {p.wins} - Rank: {p.win_rank}")
