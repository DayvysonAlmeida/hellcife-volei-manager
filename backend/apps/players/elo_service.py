"""
Serviço do Elo do Hellcife Vôlei: Elo "de verdade", calculado por times.

Regras:
  - Todo mundo começa a temporada com 500 (a média do grupo).
  - Em cada partida, compara a média de Elo dos dois times:
        esperado = 1 / (1 + 10 ** ((elo_do_adversário - elo_do_meu_time) / 400))
        variação = K × (resultado - esperado)        resultado: 1 na vitória, 0 na derrota
    Vencer o time favorito rende mais; perder para o azarão custa mais.
  - K = 32. Nos 10 primeiros jogos de cada temporada (calibração), K = 48.
  - Empate não altera o Elo. Mínimo: 100.
  - O Elo da temporada zera a cada semestre. O Elo histórico (oculto) nunca zera
    e é usado só para equilibrar o sorteio dos times.

O Elo é baseado APENAS no resultado das partidas: MVPs e destaques não influenciam.
"""

from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import Iterable

ELO_START = 500
ELO_K = 32
ELO_K_PLACEMENT = 48
PLACEMENT_GAMES = 10
ELO_MIN = 100


# ─── Faixas / Tiers ───────────────────────────────────────────────────────────

ELO_TIERS = [
    {
        'name': 'Desafiante',
        'key': 'challenger',
        'min': 750,
        'max': None,
        'color': '#DC2626',       # vermelho
        'text_color': '#FEF2F2',
        'icon': '👑',
        'gradient': 'from-red-600 to-rose-600',
    },
    {
        'name': 'Elite',
        'key': 'elite',
        'min': 650,
        'max': 749,
        'color': '#9333EA',       # roxo
        'text_color': '#F3E8FF',
        'icon': '🔥',
        'gradient': 'from-purple-600 to-pink-600',
    },
    {
        'name': 'Diamante',
        'key': 'diamond',
        'min': 600,
        'max': 649,
        'color': '#06B6D4',       # ciano
        'text_color': '#ECFEFF',
        'icon': '💎',
        'gradient': 'from-cyan-500 to-blue-500',
    },
    {
        'name': 'Ouro',
        'key': 'gold',
        'min': 540,
        'max': 599,
        'color': '#EAB308',       # amarelo
        'text_color': '#FEF9C3',
        'icon': '🥇',
        'gradient': 'from-yellow-500 to-amber-400',
    },
    {
        'name': 'Prata',
        'key': 'silver',
        'min': 470,
        'max': 539,
        'color': '#94A3B8',       # cinza-azulado
        'text_color': '#F1F5F9',
        'icon': '🥈',
        'gradient': 'from-slate-400 to-slate-300',
    },
    {
        'name': 'Bronze',
        'key': 'bronze',
        'min': 400,
        'max': 469,
        'color': '#CD7C2F',       # bronze
        'text_color': '#FEF3C7',
        'icon': '🥉',
        'gradient': 'from-amber-700 to-amber-500',
    },
    {
        'name': 'Iniciante',
        'key': 'rookie',
        'min': 100,
        'max': 399,
        'color': '#6B7280',       # cinza
        'text_color': '#F3F4F6',
        'icon': '🪨',
        'gradient': 'from-gray-600 to-gray-500',
    },
]


def get_elo_tier(elo: float) -> dict:
    """Retorna o dict de tier para um valor de Elo."""
    for tier in ELO_TIERS:
        if elo >= tier['min']:
            return tier
    return ELO_TIERS[-1]   # fallback: Iniciante


def get_elo_progress(elo: float) -> dict:
    """
    Retorna progresso dentro da faixa atual para exibir uma barra de progresso.

    Retorna:
        {
            'tier': {...},
            'next_tier': {...} | None,
            'percent': 0-100,
            'points_to_next': int | None,
        }
    """
    current = get_elo_tier(elo)
    current_idx = ELO_TIERS.index(current)

    if current_idx == 0:
        # Já é Desafiante: não há próxima faixa
        return {
            'tier': current,
            'next_tier': None,
            'percent': 100,
            'points_to_next': None,
        }

    next_tier = ELO_TIERS[current_idx - 1]
    tier_min = current['min']
    tier_max = current.get('max') or next_tier['min'] - 1
    span = next_tier['min'] - tier_min
    progress = elo - tier_min
    percent = round((progress / span) * 100) if span > 0 else 100
    percent = max(0, min(100, percent))

    return {
        'tier': current,
        'next_tier': next_tier,
        'percent': percent,
        'points_to_next': max(0, next_tier['min'] - int(elo)),
    }


# ─── Cálculo principal ────────────────────────────────────────────────────────

def replay(matches: Iterable, placement: bool = True):
    """
    Refaz o Elo partida a partida, em ordem cronológica. Não acessa o banco.

    matches: [(match_id, [(time_venceu, [(match_player_id, player_id), ...]), (time_venceu, [...])]), ...]
    Retorna (elo_por_jogador, variação_por_match_player).
    """
    elo = defaultdict(lambda: float(ELO_START))
    games = defaultdict(int)
    deltas = {}
    for _match_id, teams in matches:
        valid = len(teams) == 2 and all(players for _, players in teams) and teams[0][0] != teams[1][0]
        if not valid:  # empate, time vazio ou formato inesperado: não altera o Elo
            for _, players in teams:
                for mp_id, _player_id in players:
                    deltas[mp_id] = 0.0
            continue
        (won_a, team_a), (_won_b, team_b) = teams
        avg_a = mean(elo[p] for _, p in team_a)
        avg_b = mean(elo[p] for _, p in team_b)
        expected_a = 1 / (1 + 10 ** ((avg_b - avg_a) / 400))
        for players, result, expected in ((team_a, 1.0 if won_a else 0.0, expected_a),
                                          (team_b, 0.0 if won_a else 1.0, 1 - expected_a)):
            for mp_id, p in players:
                k = ELO_K_PLACEMENT if placement and games[p] < PLACEMENT_GAMES else ELO_K
                new = max(float(ELO_MIN), elo[p] + k * (result - expected))
                deltas[mp_id] = round(new - elo[p], 2)
                elo[p] = new
                games[p] += 1
    return dict(elo), deltas


def load_matches(match_player_model, start_date=None, end_date=None):
    """
    Lê as partidas no formato do replay(), em ordem cronológica.
    Recebe o model MatchPlayer (o real ou o histórico, dentro de migrations).
    """
    qs = match_player_model.objects.filter(match_team__isnull=False)
    if start_date:
        qs = qs.filter(match__date__gte=start_date)
    if end_date:
        qs = qs.filter(match__date__lte=end_date)
    rows = qs.order_by('match__date', 'match__created_at', 'match_id', 'match_team_id', 'id').values_list(
        'match_id', 'match_team_id', 'match_team__winner', 'id', 'player_id'
    )
    matches, index = [], {}
    for match_id, team_id, won, mp_id, player_id in rows:
        if match_id not in index:
            index[match_id] = {}
            matches.append((match_id, index[match_id]))
        team = index[match_id].setdefault(team_id, (won, []))
        team[1].append((mp_id, player_id))
    return [(match_id, list(teams.values())) for match_id, teams in matches]


def recalculate_all(season=None) -> None:
    """
    Recalcula o Elo de todos: o da temporada (com o +/- de cada partida) e o histórico oculto.
    Como o Elo de um depende do Elo dos outros, sempre refaz a temporada inteira.
    """
    from apps.matches.models import MatchPlayer
    from apps.players.models import Player
    from .seasons import ensure_current_season

    season = season or ensure_current_season()
    season_elo, deltas = replay(load_matches(MatchPlayer, season.start_date, season.end_date))
    all_time_elo, _ = replay(load_matches(MatchPlayer))

    players = list(Player.objects.all())
    for p in players:
        p.elo = round(season_elo.get(p.id, float(ELO_START)), 2)
        p.elo_tier = get_elo_tier(p.elo)['key']
        p.elo_all_time = round(all_time_elo.get(p.id, float(ELO_START)), 2)
    Player.objects.bulk_update(players, ['elo', 'elo_tier', 'elo_all_time'], batch_size=200)

    to_update = list(MatchPlayer.objects.filter(id__in=deltas.keys()).only('id'))
    for mp in to_update:
        mp.elo_delta = deltas[mp.id]
    MatchPlayer.objects.bulk_update(to_update, ['elo_delta'], batch_size=500)


def recalculate_elo(player=None) -> float | None:
    """Compatibilidade: o Elo de um jogador depende de todos, então recalcula tudo."""
    recalculate_all()
    if player is None:
        return None
    player.refresh_from_db(fields=['elo', 'elo_tier', 'elo_all_time'])
    return player.elo
