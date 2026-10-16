"""
Regras únicas dos rankings da temporada (Elo, Fire Shark e Gladiador) e das Estrelas.

Todas as telas (dashboard do admin, dashboard do atleta, rank no card, perfil, leaderboard e
notificação de novo líder) usam estas funções, para mostrarem sempre a mesma ordem.
Só entram atletas ativos e que não são convidados.

Elo, Fire Shark e Gladiador valem por temporada (semestral). As Estrelas são mérito acumulado.
"""
from statistics import median

from django.db.models import Count, Q

from .models import Player

# Fire Shark: aproveitamento ajustado pela consistência.
FIRE_SHARK_MIN_FLOOR = 10          # nunca exige menos que isso
FIRE_SHARK_MEDIAN_SHARE = 0.3      # precisa ter jogado 30% do que joga o atleta mediano da temporada
BAYES_K = 20                       # 20 jogos "fictícios" com 50% de vitórias
BAYES_PRIOR_WINS = BAYES_K * 0.5


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


def fire_shark_score(wins: int, total_matches: int) -> float:
    return (wins + BAYES_PRIOR_WINS) / (total_matches + BAYES_K) * 100


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
    Fire Shark da temporada, do melhor para o pior.
    Desempate: saldo de pontos por partida, vitórias, partidas e nome (ordem sempre estável).
    """
    season = _season(season)
    stats = season_stats(season)
    min_games = fire_shark_min_games(season, stats)
    players = []
    for p in ranked_players():
        s = stats.get(p.id)
        if not s or s['matches'] < min_games:
            continue
        p.wins, p.total_matches, p.point_balance = s['wins'], s['matches'], s['balance']
        p.win_rate = p.wins / p.total_matches * 100
        p.fire_score = fire_shark_score(p.wins, p.total_matches)
        p.balance_per_match = p.point_balance / p.total_matches
        players.append(p)
    players.sort(key=lambda p: (-p.fire_score, -p.balance_per_match, -p.wins, -p.total_matches, p.name.lower()))
    return players


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


def elo_ranking():
    """Elo da temporada atual (o campo elo já é o da temporada)."""
    return ranked_players().order_by('-elo', 'name')


def stars_ranking():
    """Estrelas (mérito acumulado, não zera por temporada): grandes, depois mini, depois nome."""
    return ranked_players().exclude(big_stars=0, mini_stars=0).order_by('-big_stars', '-mini_stars', 'name')


def season_payload(season=None) -> dict:
    """Temporada atual para as telas: nome, datas, contagem regressiva e mínimo do Fire Shark."""
    from .seasons import season_info

    season = _season(season)
    return {**season_info(season), 'fire_shark_min_games': fire_shark_min_games(season)}
