from django.core.management.base import BaseCommand

from apps.players.elo_service import recalculate_all
from apps.players.models import Player


class Command(BaseCommand):
    help = 'Recalcula o Elo da temporada e o histórico de todos os jogadores a partir das partidas.'

    def handle(self, *args, **options):
        before = dict(Player.objects.values_list('id', 'elo'))
        recalculate_all()
        players = list(Player.objects.order_by('-elo'))
        self.stdout.write(f'Elo recalculado para {len(players)} jogador(es):')
        for p in players:
            diff = p.elo - before.get(p.id, p.elo)
            self.stdout.write(f'  {p.display_name:30s} {before.get(p.id, p.elo):7.1f} -> {p.elo:7.1f}  ({diff:+.1f})  [{p.elo_tier}]')
        self.stdout.write(self.style.SUCCESS('Concluído.'))
