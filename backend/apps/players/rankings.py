"""
Regras únicas dos rankings da temporada (Elo, Fire Shark e Gladiador) e das Estrelas.

Todas as telas (dashboard do admin, dashboard do atleta, rank no card, perfil, leaderboard e
notificação de novo líder) usam estas funções, para mostrarem sempre a mesma ordem.
Só entram atletas ativos e que não são convidados.

Elo, Fire Shark e Gladiador valem por temporada (semestral). As Estrelas são mérito acumulado.
No Elo, só ganha posição quem terminou a calibração (10 jogos na temporada).
"""
from statistics import median

from django.db.models import Count, Q

from .models import Player

# Fire Shark: nota de 0 a 100 que soma aproveitamento, jogos e presença na quadra (incentiva ir aos circuitos).
FIRE_SHARK_MIN_FLOOR = 10          # nunca exige menos que isso
FIRE_SHARK_MEDIAN_SHARE = 0.3      # precisa ter jogado 30% do que joga o atleta mediano da temporada
FIRE_SHARK_WEIGHTS = {'win_rate': 0.6, 'games': 0.2, 'presence': 0.2}


def _season(season):
    if season is None:
        from .seasons import ensure_current_season
        return ensure_current_season()
    return season


def _date_q(season, prefix='match_appearances__match__date'):
    q = Q(**{f'{prefix}__lte': season.end_date})
    if season.start_date:
        q &= Q(**{f'{prefix}__gte': season.start_date})
    return q


def ranked_players():
    """Quem participa dos rankings: atletas ativos, sem convidados."""
    return Player.objects.filter(status='active', is_guest=False)


def with_match_stats(qs=None, season=None):
    """Anota vitórias e partidas da temporada."""
    season = _season(season)
    in_season = _date_q(season)
    return (qs if qs is not None else ranked_players()).annotate(
        wins=Count('match_appearances', filter=in_season & Q(match_appearances__match_team__winner=True), distinct=True),
        total_matches=Count('match_appearances', filter=in_season, distinct=True),
    )


def season_stats(season=None) -> dict:
    """{player_id: {'matches', 'wins', 'balance'}} na temporada. balance = saldo de pontos acumulado."""
    from apps.matches.models import MatchPlayer, MatchTeam

    season = _season(season)
    match_q = Q(match__date__lte=season.end_date)
    if season.start_date:
        match_q &= Q(match__date__gte=season.start_date)

    scores = {}
    for match_id, team_id, score in MatchTeam.objects.filter(match_q).values_list('match_id', 'id', 'score'):
        scores.setdefault(match_id, {})[team_id] = score

    stats = {}
    rows = MatchPlayer.objects.filter(match_q, match_team__isnull=False).values_list(
        'player_id', 'match_id', 'match_team_id', 'match_team__winner'
    )
    for player_id, match_id, team_id, won in rows:
        s = stats.setdefault(player_id, {'matches': 0, 'wins': 0, 'balance': 0})
        s['matches'] += 1
        s['wins'] += 1 if won else 0
        teams = scores.get(match_id, {})
        others = [score for t, score in teams.items() if t != team_id]
        if others:
            s['balance'] += teams[team_id] - max(others)
    return stats


def fire_shark_points(win_rate: float, games: float, presence: float) -> dict:
    """
    As três partes da nota, já com o peso de cada uma. Tudo de 0 a 100:
    aproveitamento (vitórias ÷ partidas), jogos (partidas ÷ partidas de quem mais jogou)
    e presença (dias na quadra ÷ dias com circuito).
    """
    parts = {'win_rate': win_rate, 'games': games, 'presence': presence}
    return {key: parts[key] * weight for key, weight in FIRE_SHARK_WEIGHTS.items()}


def fire_shark_score(wins: int, matches: int, top_matches: int, attended: int, total_days: int) -> float:
    presence = attended / total_days * 100 if total_days else 0
    return sum(fire_shark_points(wins / matches * 100, matches / top_matches * 100, presence).values())


def fire_shark_gains(p) -> dict:
    """Quanto a nota do atleta muda se ele for (ou faltar) ao próximo circuito e a cada vitória, o resto igual."""
    w, m, a, t = p.wins, p.total_matches, p.attended_days, p.total_days

    def delta(wins, matches, attended, total):
        return round(fire_shark_score(wins, matches, max(p.fire_top_matches, matches), attended, total) - p.fire_score, 1)

    return {'attend': delta(w, m, a + 1, t + 1), 'miss': delta(w, m, a, t + 1), 'win': delta(w + 1, m + 1, a, t)}


def fire_shark_min_games(season=None, stats=None) -> int:
    """Mínimo de jogos para entrar no Fire Shark: cresce junto com a temporada."""
    season = _season(season)
    stats = stats if stats is not None else season_stats(season)
    played = [stats[p]['matches'] for p in ranked_players().values_list('id', flat=True) if stats.get(p, {}).get('matches')]
    if not played:
        return FIRE_SHARK_MIN_FLOOR
    return max(FIRE_SHARK_MIN_FLOOR, round(median(played) * FIRE_SHARK_MEDIAN_SHARE))


def fire_shark_ranking(season=None):
    """
    Fire Shark da temporada, do melhor para o pior, pela nota (a mesma que as telas mostram).
    Presença = mesma regra da frequência: check-in na quadra nos dias com circuito.
    Desempate: aproveitamento, partidas, saldo de pontos por partida e nome (ordem sempre estável).
    """
    from apps.attendance.frequency import circuit_days, frequency

    season = _season(season)
    stats = season_stats(season)
    min_games = fire_shark_min_games(season, stats)
    players = [p for p in ranked_players() if stats.get(p.id, {}).get('matches', 0) >= min_games]
    if not players:
        return []
    days = circuit_days(season.start_date, season.end_date)
    top_matches = max(stats[p.id]['matches'] for p in players)
    for p in players:
        s, freq = stats[p.id], frequency(p, days)
        p.wins, p.total_matches, p.point_balance = s['wins'], s['matches'], s['balance']
        p.attended_days, p.total_days = freq['attended_days'], freq['total_days']
        p.win_rate = p.wins / p.total_matches * 100
        p.presence_rate = p.attended_days / p.total_days * 100 if p.total_days else 0
        p.fire_points = fire_shark_points(p.win_rate, p.total_matches / top_matches * 100, p.presence_rate)
        p.fire_score = sum(p.fire_points.values())
        p.fire_top_matches = top_matches
        p.balance_per_match = p.point_balance / p.total_matches
    players.sort(key=lambda p: (-p.fire_score, -p.win_rate, -p.total_matches, -p.balance_per_match, p.name.lower()))
    return players


def fire_shark_entry(p) -> dict:
    """Linha do Fire Shark para as telas: a nota e de onde ela vem."""
    return {
        'id': p.id,
        'name': p.display_name,
        'avatar_url': p.avatar_url,
        'wins': p.wins,
        'total_matches': p.total_matches,
        'win_rate': round(p.win_rate, 1),
        'attended_days': p.attended_days,
        'total_days': p.total_days,
        'score': round(p.fire_score, 1),
    }


def fire_shark_positions(season=None) -> dict:
    """{player_id: posição} no Fire Shark da temporada."""
    return {p.id: idx for idx, p in enumerate(fire_shark_ranking(season), start=1)}


def wins_ranking(season=None):
    """Gladiadores da temporada: mais vitórias primeiro; desempate por mais partidas e nome."""
    return with_match_stats(season=season).filter(total_matches__gte=1).order_by('-wins', '-total_matches', 'name')


def wins_positions(season=None) -> dict:
    """{player_id: posição} por vitórias, em ranking denso (empatados dividem a posição)."""
    positions, current, last = {}, 0, None
    for p in wins_ranking(season).filter(wins__gt=0):
        if p.wins != last:
            current += 1
            last = p.wins
        positions[p.id] = current
    return positions


def elo_ranking(stats=None):
    """
    Ranking de Elo da temporada atual (o campo elo já é o da temporada).
    Só entra quem terminou a calibração (10 jogos na temporada); empate decide pelo nome.
    """
    from .elo_service import PLACEMENT_GAMES

    stats = stats if stats is not None else season_stats()
    players = []
    for p in ranked_players():
        s = stats.get(p.id)
        if not s or s['matches'] < PLACEMENT_GAMES:
            continue
        p.season_matches, p.season_wins = s['matches'], s['wins']
        players.append(p)
    players.sort(key=lambda p: (-p.elo, p.name.lower()))
    return players


def elo_top(limit=10) -> list:
    """Top do Elo para as telas, com a faixa vinda do servidor."""
    from .elo_service import get_elo_tier

    rows = []
    for idx, p in enumerate(elo_ranking()[:limit], start=1):
        tier = get_elo_tier(p.elo)
        rows.append({
            'id': p.id, 'position': idx, 'name': p.display_name, 'avatar_url': p.avatar_url,
            'elo': round(p.elo), 'matches': p.season_matches, 'wins': p.season_wins,
            'tier': tier['key'], 'tier_name': tier['name'], 'tier_icon': tier['icon'], 'tier_color': tier['color'],
        })
    return rows


def stars_ranking():
    """Estrelas (mérito acumulado, não zera por temporada): grandes, depois mini, depois nome."""
    return ranked_players().exclude(big_stars=0, mini_stars=0).order_by('-big_stars', '-mini_stars', 'name')


def season_payload(season=None) -> dict:
    """Temporada atual para as telas: nome, datas, contagem regressiva, mínimo e pesos do Fire Shark."""
    from .seasons import season_info

    season = _season(season)
    return {
        **season_info(season),
        'fire_shark_min_games': fire_shark_min_games(season),
        'fire_shark_weights': {key: round(weight * 100) for key, weight in FIRE_SHARK_WEIGHTS.items()},
    }
