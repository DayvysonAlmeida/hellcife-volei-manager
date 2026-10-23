"""
Regras únicas dos rankings da temporada (Elo, Fire Shark e Gladiador) e das Estrelas.

Todas as telas (dashboard do admin, dashboard do atleta, rank no card, perfil, leaderboard e
notificação de novo líder) usam estas funções, para mostrarem sempre a mesma ordem.
Só entram atletas ativos e que não são convidados.

Elo, Fire Shark e Gladiador valem por temporada (semestral). As Estrelas são mérito acumulado.
No Elo, só ganha posição quem terminou a calibração (10 jogos na temporada).
"""
from fractions import Fraction
from statistics import median

from django.db.models import Count, Q

from .models import Player

# Fire Shark: nota de 0 a 100 que soma aproveitamento, presença na quadra e partidas (incentiva ir aos circuitos).
FIRE_SHARK_MIN_FLOOR = 10          # nunca exige menos que isso
FIRE_SHARK_MEDIAN_SHARE = 0.3      # precisa ter jogado 30% do que joga o atleta mediano da temporada

FIRE_SHARK_FORMULAS = {
    # Pré-temporada (como sempre foi): presença em % desde o cadastro e jogos em relação a quem mais jogou.
    # Só aparece quem tem o mínimo de partidas.
    'atual': {
        'points': {'win_rate': 60, 'games': 20, 'presence': 20},  # pontos máximos de cada parte
        'games_target': None,       # sem meta: quem mais jogou na temporada fica com os pontos inteiros
        'circuits_target': None,    # sem meta: presença = dias na quadra ÷ dias com circuito desde o cadastro
        'title': None,              # sem requisitos de título
        'tiebreak': ('win_rate', 'total_matches', 'balance_per_match'),
    },
    # Temporadas com premiação: tudo por contagem até a meta, então ninguém perde pontos por ficar sem jogar.
    # Todos aparecem desde o início; só disputa o título quem cumpre os requisitos.
    'nova': {
        'points': {'win_rate': 50, 'presence': 30, 'games': 20},
        'games_target': 60,         # regularidade: partidas válidas até a meta
        'circuits_target': 16,      # presença: dias de circuito com check-in até a meta
        'title': {'games': 20, 'circuits': 8, 'months': 3},
        'tiebreak': ('win_rate', 'attended_days', 'wins', 'total_matches'),
    },
}
FIRE_SHARK_NEW_FROM_SEASON = 1     # a fórmula 'nova' vale a partir da Temporada 1 (jan/2027)


def fire_shark_formula(season=None) -> dict:
    """Fórmula do Fire Shark que vale na temporada."""
    return FIRE_SHARK_FORMULAS['nova' if _season(season).number >= FIRE_SHARK_NEW_FROM_SEASON else 'atual']


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


def fire_shark_points(wins: int, matches: int, top_matches: int, attended: int, total_days: int, formula=None) -> dict:
    """
    As três partes da nota, em pontos e exatas (frações): o arredondamento fica só para as telas, e empates
    de verdade continuam empates.
    - Aproveitamento: vitórias ÷ partidas.
    - Partidas: partidas ÷ meta, no máximo 1 (sem meta, ÷ partidas de quem mais jogou).
    - Presença: dias na quadra ÷ meta de circuitos, no máximo 1 (sem meta, ÷ dias com circuito).
    """
    formula = formula or fire_shark_formula()
    games_target = formula['games_target'] or top_matches
    circuits_target = formula['circuits_target']
    if circuits_target:
        presence = Fraction(min(attended, circuits_target), circuits_target)
    else:
        presence = Fraction(attended, total_days) if total_days else Fraction(0)
    shares = {
        'win_rate': Fraction(wins, matches),
        'games': Fraction(min(matches, games_target), games_target) if games_target else Fraction(0),
        'presence': presence,
    }
    return {key: shares[key] * maximum for key, maximum in formula['points'].items()}


def fire_shark_score(wins: int, matches: int, top_matches: int, attended: int, total_days: int, formula=None) -> Fraction:
    return sum(fire_shark_points(wins, matches, top_matches, attended, total_days, formula).values())


def fire_shark_gains(p) -> dict:
    """Quanto a nota do atleta muda se ele for (ou faltar) ao próximo circuito e a cada vitória, o resto igual."""
    w, m, a, t = p.wins, p.total_matches, p.attended_days, p.total_days

    def delta(wins, matches, attended, total):
        score = fire_shark_score(wins, matches, max(p.fire_top_matches, matches), attended, total, p.fire_formula)
        return round(float(score - p.fire_score_exact), 1)

    return {'attend': delta(w, m, a + 1, t + 1), 'miss': delta(w, m, a, t + 1), 'win': delta(w + 1, m + 1, a, t)}


def fire_shark_min_games(season=None, stats=None) -> int:
    """Mínimo de jogos para entrar no Fire Shark: cresce junto com a temporada."""
    season = _season(season)
    stats = stats if stats is not None else season_stats(season)
    played = [stats[p]['matches'] for p in ranked_players().values_list('id', flat=True) if stats.get(p, {}).get('matches')]
    if not played:
        return FIRE_SHARK_MIN_FLOOR
    return max(FIRE_SHARK_MIN_FLOOR, round(median(played) * FIRE_SHARK_MEDIAN_SHARE))


def _active_months(season, days) -> dict:
    """{player_id: meses (ano, mês) da temporada com pelo menos uma partida válida ou um check-in}."""
    from apps.matches.models import MatchPlayer

    match_q = Q(match__date__lte=season.end_date)
    if season.start_date:
        match_q &= Q(match__date__gte=season.start_date)
    months = {}
    for player_id, day in MatchPlayer.objects.filter(match_q, match_team__isnull=False).values_list('player_id', 'match__date'):
        months.setdefault(player_id, set()).add((day.year, day.month))
    for day, (went, _) in days.items():
        for player_id in went:
            months.setdefault(player_id, set()).add((day.year, day.month))
    return months


def fire_shark_table(season=None, formula=None, stats=None):
    """
    Todos os atletas com partidas na temporada: nota, as três partes e o que falta para disputar.
    - fire_eligible: está no ranking numerado (na fórmula nova, disputa o título).
    - fire_listed: aparece na tela (na fórmula nova, todos aparecem desde o início).
    - fire_missing: partidas, circuitos e meses que faltam para ficar elegível.
    Quem é elegível vem primeiro, do melhor para o pior; depois os demais, pela nota.
    Presença = check-in na quadra nos dias com circuito válido (vários circuitos no mesmo dia contam um).
    Desempate: o da fórmula e, por último, o nome (ordem sempre estável).
    """
    from apps.attendance.frequency import circuit_days, frequency

    season = _season(season)
    formula = formula or fire_shark_formula(season)
    title = formula['title']
    stats = stats if stats is not None else season_stats(season)
    min_games = fire_shark_min_games(season, stats)
    days = circuit_days(season.start_date, season.end_date)
    months = _active_months(season, days) if title else {}
    players = [p for p in ranked_players() if stats.get(p.id, {}).get('matches')]
    for p in players:
        s = stats[p.id]
        # Com meta de circuitos a presença é contagem: valem todos os dias da temporada em que ele foi
        freq = frequency(p, days, since_registration=not formula['circuits_target'])
        p.wins, p.total_matches, p.point_balance = s['wins'], s['matches'], s['balance']
        p.attended_days, p.total_days = freq['attended_days'], freq['total_days']
        p.active_months = len(months.get(p.id, ()))
        p.win_rate = p.wins / p.total_matches * 100
        p.presence_rate = p.attended_days / p.total_days * 100 if p.total_days else 0
        p.balance_per_match = p.point_balance / p.total_matches
        if title:
            p.fire_missing = {
                'games': max(0, title['games'] - p.total_matches),
                'circuits': max(0, title['circuits'] - p.attended_days),
                'months': max(0, title['months'] - p.active_months),
            }
        else:
            p.fire_missing = {'games': max(0, min_games - p.total_matches), 'circuits': 0, 'months': 0}
        p.fire_eligible = not any(p.fire_missing.values())
        p.fire_listed = p.fire_eligible or bool(title)
    top_matches = max((p.total_matches for p in players if p.fire_eligible), default=0)
    for p in players:
        p.fire_formula, p.fire_top_matches = formula, top_matches
        points = fire_shark_points(p.wins, p.total_matches, top_matches, p.attended_days, p.total_days, formula)
        p.fire_score_exact = sum(points.values())
        p.fire_points = {key: float(value) for key, value in points.items()}
        p.fire_score = float(p.fire_score_exact)
    players.sort(key=lambda p: (not p.fire_eligible, -p.fire_score_exact, *(-getattr(p, k) for k in formula['tiebreak']), p.name.lower()))
    return players


def fire_shark_ranking(season=None, formula=None):
    """Fire Shark da temporada: só os elegíveis (na fórmula nova, quem disputa o título), do melhor para o pior."""
    return [p for p in fire_shark_table(season, formula) if p.fire_eligible]


def fire_shark_pending(season=None):
    """Quem aparece na tela mas ainda não é elegível (só na fórmula nova), pela nota."""
    return [p for p in fire_shark_table(season) if p.fire_listed and not p.fire_eligible]


def fire_shark_entry(p) -> dict:
    """Linha do Fire Shark para as telas: a nota, de onde ela vem e o que falta para disputar."""
    return {
        'id': p.id,
        'name': p.display_name,
        'avatar_url': p.avatar_url,
        'wins': p.wins,
        'total_matches': p.total_matches,
        'win_rate': round(p.win_rate, 1),
        'attended_days': p.attended_days,
        'total_days': p.total_days,
        'active_months': p.active_months,
        'score': round(p.fire_score, 1),
        'points': {key: round(value, 1) for key, value in p.fire_points.items()},
        'missing': p.fire_missing,
    }


def fire_shark_positions(season=None) -> dict:
    """{player_id: posição} no Fire Shark da temporada."""
    return {p.id: idx for idx, p in enumerate(fire_shark_ranking(season), start=1)}


def fire_shark_proposal(season=None, games_target=None, circuits_target=None) -> dict:
    """
    Prévia da fórmula nova com os dados reais da temporada, ao lado do ranking de hoje (só para o admin).
    Dá para testar outras metas de partidas e de circuitos antes de valerem.
    """
    from apps.attendance.frequency import circuit_days

    season = _season(season)
    formula = dict(FIRE_SHARK_FORMULAS['nova'])
    if games_target:
        formula['games_target'] = games_target
    if circuits_target:
        formula['circuits_target'] = circuits_target
    stats = season_stats(season)
    current = {p.id: idx for idx, p in enumerate(fire_shark_ranking(season), start=1)}

    rows, position = [], 0
    for p in fire_shark_table(season, formula, stats):
        position += p.fire_eligible
        rows.append({
            **fire_shark_entry(p),
            'position': position if p.fire_eligible else None,
            'current_position': current.get(p.id),
        })

    scores = sorted(r['score'] for r in rows if r['position'])
    played = sorted(r['total_matches'] for r in rows)
    went = sorted(r['attended_days'] for r in rows)

    def spread(values):
        if not values:
            return {'median': 0, 'p25': 0, 'p75': 0}
        at = lambda q: values[min(len(values) - 1, int(len(values) * q))]  # noqa: E731
        return {'median': median(values), 'p25': at(0.25), 'p75': at(0.75)}

    return {
        'formula': {key: formula[key] for key in ('points', 'games_target', 'circuits_target', 'title')},
        'season_days': len(circuit_days(season.start_date, season.end_date)),
        'matches': spread(played),
        'circuits': spread(went),
        'scores': {
            'min': scores[0] if scores else None,
            'median': round(median(scores), 1) if scores else None,
            'max': scores[-1] if scores else None,
            'bands': [{'from': band, 'count': sum(band <= s < band + 10 or (band == 90 and s == 100) for s in scores)}
                      for band in range(90, -1, -10)],
        },
        'rows': rows,
    }


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
    """Temporada atual para as telas: nome, datas, contagem regressiva e regras do Fire Shark."""
    from .seasons import season_info

    season = _season(season)
    formula = fire_shark_formula(season)
    return {
        **season_info(season),
        'fire_shark_min_games': fire_shark_min_games(season),
        'fire_shark_weights': dict(formula['points']),
        'fire_shark_rules': {
            'mode': 'nova' if formula is FIRE_SHARK_FORMULAS['nova'] else 'atual',
            **{key: formula[key] for key in ('points', 'games_target', 'circuits_target', 'title')},
        },
    }
