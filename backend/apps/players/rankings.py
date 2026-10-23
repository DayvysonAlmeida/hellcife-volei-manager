"""
Regras únicas dos rankings da temporada (Elo, Fire Shark e Gladiador) e das Estrelas.

Todas as telas (dashboard do admin, dashboard do atleta, rank no card, perfil, leaderboard e
notificação de novo líder) usam estas funções, para mostrarem sempre a mesma ordem.
Só entram atletas ativos e que não são convidados.

Elo, Fire Shark e Gladiador valem por temporada (semestral). As Estrelas são mérito acumulado.
No Elo, só ganha posição quem terminou a calibração (10 jogos na temporada).
"""
from django.db.models import Count, Q

from .models import Player

# Fire Shark: pontos por ação na temporada. Tudo soma e nada desconta, então ninguém perde pontos por
# ficar um tempo sem jogar. Circuito = dia com check-in na quadra num circuito publicado e realizado.
FIRE_SHARK_POINTS = {'win': 3, 'loss': 1, 'circuit': 10}


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


def season_match_count(player_id, season=None) -> int:
    """Partidas válidas do atleta na temporada (mesma conta do season_stats, para um atleta só)."""
    from apps.matches.models import MatchPlayer

    season = _season(season)
    match_q = Q(match__date__lte=season.end_date)
    if season.start_date:
        match_q &= Q(match__date__gte=season.start_date)
    return MatchPlayer.objects.filter(match_q, player_id=player_id, match_team__isnull=False).count()


def elo_calibration(games: int) -> dict:
    """A faixa de Elo só aparece depois da calibração; antes, as telas mostram "Em calibração · faltam X jogos"."""
    from .elo_service import PLACEMENT_GAMES

    return {
        'calibrating': games < PLACEMENT_GAMES,
        'games': games,
        'needed': PLACEMENT_GAMES,
        'missing': max(0, PLACEMENT_GAMES - games),
    }


def fire_shark_ranking(season=None):
    """
    Fire Shark da temporada, do melhor para o pior: vitória 3, derrota 1 (partida sem vitória) e
    circuito 10 (dois circuitos no mesmo dia contam um). Entra quem jogou ou foi a um circuito na temporada.
    Desempate: mais vitórias, mais circuitos, maior aproveitamento e nome (ordem sempre estável).
    """
    from apps.attendance.frequency import circuit_days

    season = _season(season)
    stats = season_stats(season)
    circuits = {}
    for went, _ in circuit_days(season.start_date, season.end_date).values():
        for player_id in went:
            circuits[player_id] = circuits.get(player_id, 0) + 1
    players = []
    for p in ranked_players():
        s = stats.get(p.id, {'matches': 0, 'wins': 0})
        p.circuits = circuits.get(p.id, 0)
        if not s['matches'] and not p.circuits:
            continue
        p.wins, p.total_matches = s['wins'], s['matches']
        p.losses = p.total_matches - p.wins
        p.win_rate = p.wins / p.total_matches * 100 if p.total_matches else 0
        p.fire_points = {
            'wins': p.wins * FIRE_SHARK_POINTS['win'],
            'losses': p.losses * FIRE_SHARK_POINTS['loss'],
            'circuits': p.circuits * FIRE_SHARK_POINTS['circuit'],
        }
        p.fire_score = sum(p.fire_points.values())
        players.append(p)
    players.sort(key=lambda p: (-p.fire_score, -p.wins, -p.circuits, -p.win_rate, p.name.lower()))
    return players


def fire_shark_entry(p) -> dict:
    """Linha do Fire Shark para as telas: os pontos e de onde eles vêm."""
    return {
        'id': p.id,
        'name': p.display_name,
        'avatar_url': p.avatar_url,
        'wins': p.wins,
        'losses': p.losses,
        'total_matches': p.total_matches,
        'win_rate': round(p.win_rate, 1),
        'circuits': p.circuits,
        'score': p.fire_score,
        'points': p.fire_points,
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
    """Temporada atual para as telas: nome, datas, contagem regressiva e quanto vale cada ação no Fire Shark."""
    from .seasons import season_info

    season = _season(season)
    return {**season_info(season), 'fire_shark_points': dict(FIRE_SHARK_POINTS)}
