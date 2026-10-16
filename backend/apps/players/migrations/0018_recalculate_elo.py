from django.db import migrations


def recalculate_all(apps, schema_editor):
    """
    Os campos de Elo nasceram com 500/silver para todos (0015). Recalcula a partir do
    histórico de partidas, com a mesma regra do elo_service, para o ranking já começar certo.
    """
    from apps.players.elo_service import ELO_LOSS, ELO_MIN, ELO_START, ELO_WIN, get_elo_tier

    Player = apps.get_model('players', 'Player')
    MatchPlayer = apps.get_model('matches', 'MatchPlayer')

    elo_by_player = {}
    appearances = (
        MatchPlayer.objects.exclude(match_team__isnull=True)
        .order_by('match__date', 'match__created_at', 'id')
        .values_list('player_id', 'match_team__winner')
    )
    for player_id, won in appearances:
        elo = elo_by_player.get(player_id, float(ELO_START)) + (ELO_WIN if won else ELO_LOSS)
        elo_by_player[player_id] = max(elo, float(ELO_MIN))

    players = list(Player.objects.all())
    for player in players:
        elo = elo_by_player.get(player.id, float(ELO_START))
        player.elo = round(elo, 2)
        player.elo_tier = get_elo_tier(elo)['key']
    Player.objects.bulk_update(players, ['elo', 'elo_tier'], batch_size=200)


class Migration(migrations.Migration):

    dependencies = [
        ('players', '0017_merge_absences_reset_date'),
        ('matches', '0006_add_borrowed_from_team_name'),
    ]

    operations = [
        migrations.RunPython(recalculate_all, migrations.RunPython.noop),
    ]
