"""
Serviço de cálculo do Elo para o HellCife Vôlei Manager.

Regras:
  - Elo inicial: 500
  - Vitória:    +20
  - Derrota:    -10
  - Mínimo:     100

O Elo é baseado APENAS no resultado das partidas (winner=True/False).
MVPs e destaques NÃO influenciam o Elo.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.players.models import Player

ELO_START = 500
ELO_WIN = 20
ELO_LOSS = -10
ELO_MIN = 100


# ─── Faixas / Tiers ───────────────────────────────────────────────────────────

ELO_TIERS = [
    {
        'name': 'Elite',
        'key': 'elite',
        'min': 900,
        'max': None,
        'color': '#9333EA',       # roxo
        'text_color': '#F3E8FF',
        'icon': '🔥',
        'gradient': 'from-purple-600 to-pink-600',
    },
    {
        'name': 'Diamante',
        'key': 'diamond',
        'min': 800,
        'max': 899,
        'color': '#06B6D4',       # ciano
        'text_color': '#ECFEFF',
        'icon': '💎',
        'gradient': 'from-cyan-500 to-blue-500',
    },
    {
        'name': 'Ouro',
        'key': 'gold',
        'min': 650,
        'max': 799,
        'color': '#EAB308',       # amarelo
        'text_color': '#FEF9C3',
        'icon': '🥇',
        'gradient': 'from-yellow-500 to-amber-400',
    },
    {
        'name': 'Prata',
        'key': 'silver',
        'min': 500,
        'max': 649,
        'color': '#94A3B8',       # cinza-azulado
        'text_color': '#F1F5F9',
        'icon': '🥈',
        'gradient': 'from-slate-400 to-slate-300',
    },
    {
        'name': 'Bronze',
        'key': 'bronze',
        'min': 300,
        'max': 499,
        'color': '#CD7C2F',       # bronze
        'text_color': '#FEF3C7',
        'icon': '🥉',
        'gradient': 'from-amber-700 to-amber-500',
    },
    {
        'name': 'Iniciante',
        'key': 'rookie',
        'min': 100,
        'max': 299,
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
        # Já é Elite — sem próximo tier
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

def recalculate_elo(player: 'Player') -> float:
    """
    Recalcula o Elo do jogador a partir de TODAS as suas partidas históricas.
    Salva `elo` e `elo_tier` diretamente no objeto e persiste no banco.

    Retorna o novo valor de Elo.
    """
    from apps.matches.models import MatchPlayer

    appearances = (
        MatchPlayer.objects
        .filter(player=player)
        .select_related('match_team')
        .order_by('match__date', 'match__created_at', 'id')
    )

    elo = float(ELO_START)

    for appearance in appearances:
        if appearance.match_team is None:
            continue  # partida sem time registrado — ignorar

        if appearance.match_team.winner:
            elo += ELO_WIN
        else:
            elo += ELO_LOSS

        # Garantir mínimo
        if elo < ELO_MIN:
            elo = float(ELO_MIN)

    tier = get_elo_tier(elo)

    # Salva somente os dois campos para não sobrescrever outros
    player.elo = round(elo, 2)
    player.elo_tier = tier['key']
    player.save(update_fields=['elo', 'elo_tier'])

    return player.elo
