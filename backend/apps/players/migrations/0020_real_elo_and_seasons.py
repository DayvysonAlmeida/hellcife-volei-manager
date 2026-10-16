from django.db import migrations
from django.utils import timezone


def apply_real_elo(apps, schema_editor):
    """
    Cria as temporadas até hoje e recalcula o Elo com a regra nova (Elo por times):
    o +/- de cada partida em cada temporada, o Elo da temporada atual e o histórico oculto.
    O encerramento de temporadas passadas (resultado final) fica para o app, na virada.
    """
    from apps.players.elo_service import ELO_START, get_elo_tier, load_matches, replay
    from apps.players.seasons import season_bounds, season_name, season_number_for

    Player = apps.get_model('players', 'Player')
    Season = apps.get_model('players', 'Season')
    MatchPlayer = apps.get_model('matches', 'MatchPlayer')

    current = season_number_for(timezone.localdate())
    for number in range(current + 1):
        start, end = season_bounds(number)
        Season.objects.get_or_create(number=number, defaults={'name': season_name(number), 'start_date': start, 'end_date': end})

    deltas, current_elo = {}, {}
    for number in range(current + 1):
        start, end = season_bounds(number)
        elo, season_deltas = replay(load_matches(MatchPlayer, start, end))
        deltas.update(season_deltas)
        if number == current:
            current_elo = elo
    all_time, _ = replay(load_matches(MatchPlayer))

    players = list(Player.objects.all())
    for p in players:
        p.elo = round(current_elo.get(p.id, float(ELO_START)), 2)
        p.elo_tier = get_elo_tier(p.elo)['key']
        p.elo_all_time = round(all_time.get(p.id, float(ELO_START)), 2)
    Player.objects.bulk_update(players, ['elo', 'elo_tier', 'elo_all_time'], batch_size=200)

    rows = list(MatchPlayer.objects.filter(id__in=deltas.keys()).only('id'))
    for mp in rows:
        mp.elo_delta = deltas[mp.id]
    MatchPlayer.objects.bulk_update(rows, ['elo_delta'], batch_size=500)


class Migration(migrations.Migration):

    dependencies = [
        ('players', '0019_seasons_and_elo_all_time'),
        ('matches', '0007_matchplayer_elo_delta'),
    ]

    operations = [
        migrations.RunPython(apply_real_elo, migrations.RunPython.noop),
    ]
