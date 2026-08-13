from django.core.management.base import BaseCommand
from apps.players.models import Player
from apps.players.elo_service import recalculate_elo


class Command(BaseCommand):
    help = 'Recalcula o Elo de todos os jogadores com base no histórico de partidas.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--player-id',
            type=int,
            default=None,
            help='Recalcular apenas um jogador específico pelo ID.',
        )

    def handle(self, *args, **options):
        player_id = options.get('player_id')

        if player_id:
            try:
                players = [Player.objects.get(pk=player_id)]
            except Player.DoesNotExist:
                self.stderr.write(self.style.ERROR(f'Jogador #{player_id} não encontrado.'))
                return
        else:
            players = list(Player.objects.all())

        total = len(players)
        self.stdout.write(f'Recalculando Elo de {total} jogador(es)...')

        for i, player in enumerate(players, start=1):
            old_elo = player.elo
            new_elo = recalculate_elo(player)
            diff = new_elo - old_elo
            sign = '+' if diff >= 0 else ''
            self.stdout.write(
                f'  [{i}/{total}] {player.display_name:30s} '
                f'{old_elo:6.1f} -> {new_elo:6.1f}  ({sign}{diff:.1f})  [{player.elo_tier}]'
            )

        self.stdout.write(self.style.SUCCESS(f'\nElo recalculado para {total} jogador(es).'))
