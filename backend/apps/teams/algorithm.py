"""
Algoritmo de geração inteligente de equipes balanceadas.

Estratégia:
1. Calcular score composto: overall * 0.7 + elo_normalizado * 0.3
2. Separar levantadores e mulheres para distribuição prioritária
3. Algoritmo guloso: assign_to_best_team com critério hierárquico por tupla
   (penalidade, count, avg_score) — evita empates que causavam duplicatas
4. Calcula score de balanceamento (desvio padrão dos scores médios)
"""
import math
import statistics
from typing import List, Dict, Optional

from apps.players.models import Player
from apps.attendance.models import GameDay, Attendance, CourtCheckin

# Faixas de normalização do Elo para escala 0–10 (mesmo range do overall)
ELO_MIN = 100.0
ELO_MAX = 1500.0


def _normalize_elo(elo: float) -> float:
    """Normaliza o Elo (100–1500) para a escala 0–10."""
    elo_clamped = max(ELO_MIN, min(ELO_MAX, elo))
    return (elo_clamped - ELO_MIN) / (ELO_MAX - ELO_MIN) * 10.0


def _composite_score(overall: float, elo: float) -> float:
    """Score composto: 70% overall + 30% elo normalizado."""
    return round(overall * 0.7 + _normalize_elo(elo) * 0.3, 4)


def get_players_with_overall(player_ids: Optional[List[int]] = None, gameday_id: Optional[int] = None) -> List[Dict]:
    """
    Retorna jogadores com seu último overall e score composto (overall + elo).
    Filtra por gameday (presentes na quadra via CourtCheckin) ou por lista de IDs.
    """
    if gameday_id:
        present_player_ids = CourtCheckin.objects.filter(
            gameday_id=gameday_id
        ).values_list('player_id', flat=True)
        players = Player.objects.filter(id__in=present_player_ids, status='active')
    elif player_ids:
        players = Player.objects.filter(id__in=player_ids, status='active')
    else:
        players = Player.objects.filter(status='active')

    result = []
    for p in players.prefetch_related('evaluations'):
        # Ordena avaliações em Python para não bypassar o prefetch
        evals = list(p.evaluations.all())
        if evals:
            evals.sort(key=lambda e: e.date, reverse=True)
            overall = evals[0].overall
        else:
            overall = 5.0

        composite = _composite_score(overall, p.elo)

        result.append({
            'id': p.id,
            'name': p.name,
            'nickname': p.nickname,
            'display_name': p.display_name,
            'main_position': p.main_position,
            'secondary_position': p.secondary_position,
            'shirt_number': p.shirt_number,
            'avatar_url': p.avatar_url,
            'is_guest': p.is_guest,
            'gender': p.gender,
            'overall': overall,        # overall puro (exibição)
            'elo': p.elo,              # elo bruto (exibição)
            'composite_score': composite,  # score real usado no balanceamento
        })

    # Ordenar pelo score composto (maior primeiro)
    result.sort(key=lambda x: x['composite_score'], reverse=True)
    return result


def _is_setter(player: Dict) -> bool:
    """Verifica se o jogador é levantador (principal ou secundário)."""
    return (
        player.get('main_position') == 'setter'
        or player.get('secondary_position') == 'setter'
    )


def smart_draft(players: List[Dict], team_size: int) -> List[List[Dict]]:
    """
    Distribui jogadores em times usando um algoritmo guloso inteligente.
    Garante separação de levantadores e mulheres, e balanceia por score composto.

    Critério de seleção de time (hierárquico — sem empates por soma):
      1. Menor penalidade (não duplicar levantador/mulher no mesmo time)
      2. Menor número de jogadores no time (distribuição uniforme)
      3. Menor score médio composto (balanceamento de overall+elo)
    """
    capacities = []
    total = len(players)
    while total > 0:
        if total >= team_size:
            capacities.append(team_size)
            total -= team_size
        else:
            capacities.append(total)
            total -= total
            
    n_teams = len(capacities)
    if n_teams == 0:
        return []

    # Como distribuiremos todos de forma controlada, draft_players é toda a lista
    draft_players = players

    teams: List[List[Dict]] = [[] for _ in range(n_teams)]

    # Separar os grupos usando identidade de objeto (mesma lista)
    setters = [p for p in draft_players if _is_setter(p)]
    women   = [p for p in draft_players if p.get('gender') == 'F' and not _is_setter(p)]
    others  = [p for p in draft_players if not _is_setter(p) and p.get('gender') != 'F']

    # Ordenar cada grupo por score composto DESC
    setters.sort(key=lambda x: x['composite_score'], reverse=True)
    women.sort(key=lambda x: x['composite_score'], reverse=True)
    others.sort(key=lambda x: x['composite_score'], reverse=True)

    def assign_to_best_team(player: Dict):
        """
        Escolhe o melhor time para o jogador usando comparação por tupla.
        Isso elimina empates que antes faziam todos irem para o times[0].
        """
        best_team = None
        # Tupla: (penalidade, count, avg_score) — menor é melhor
        best_key = (float('inf'), float('inf'), float('inf'))

        for i, team in enumerate(teams):
            count = len(team)
            max_cap = capacities[i]
            
            if count >= max_cap:
                continue

            avg_score = (
                sum(p['composite_score'] for p in team) / count
                if count > 0 else 0.0
            )
            
            penalty = 0
            
            # Se o jogador é levantador, tenta evitar times que já tenham levantadores
            if _is_setter(player):
                setter_count = sum(1 for p in team if _is_setter(p))
                penalty += setter_count * 1000
                
            # Se o jogador é mulher, tenta evitar times que já tenham mulheres
            if player.get('gender') == 'F':
                woman_count = sum(1 for p in team if p.get('gender') == 'F')
                penalty += woman_count * 1000

            # Uso de fill_ratio assegura que os times sejam preenchidos de forma equilibrada em %.
            # Isso evita que times incompletos "roubem" posições prioritárias.
            fill_ratio = count / max_cap if max_cap > 0 else 1.0
            
            # Critério hierárquico — tuple comparison garante desempate justo
            key = (penalty, fill_ratio, avg_score)

            if key < best_key:
                best_key = key
                best_team = team

        if best_team is None:
            # Fallback: time com menor percentual de preenchimento
            best_team = min(teams, key=lambda t: len(t) / capacities[teams.index(t)] if capacities[teams.index(t)] > 0 else float('inf'))

        best_team.append(player)

    # Distribuição em ordem de prioridade: levantadores > mulheres > demais
    for p in setters:
        assign_to_best_team(p)
    for p in women:
        assign_to_best_team(p)
    for p in others:
        assign_to_best_team(p)

    return teams


def calculate_balance_score(teams: List[List[Dict]]) -> float:
    """
    Calcula score de balanceamento como desvio padrão dos scores compostos médios.
    Quanto menor, mais balanceado.
    """
    if len(teams) < 2:
        return 0.0
    avgs = []
    for team in teams:
        if team:
            avgs.append(sum(p['composite_score'] for p in team) / len(team))
    if len(avgs) < 2:
        return 0.0
    return round(statistics.stdev(avgs), 4)


def generate_teams(
    modality: int,
    gameday_id: Optional[int] = None,
    player_ids: Optional[List[int]] = None,
) -> Dict:
    """
    Função principal de geração de times.
    Retorna dicionário com times e score de balanceamento.
    """
    from .models import TEAM_COLORS, TEAM_COLOR_HEX

    players = get_players_with_overall(player_ids=player_ids, gameday_id=gameday_id)

    if len(players) < modality * 2:
        return {
            'error': f'Número insuficiente de jogadores. Mínimo necessário: {modality * 2}, disponíveis: {len(players)}'
        }

    teams_players = smart_draft(players, modality)
    balance_score = calculate_balance_score(teams_players)

    teams_result = []
    for i, team_players in enumerate(teams_players):
        if not team_players:
            continue
        avg = round(
            sum(p['overall'] for p in team_players) / len(team_players), 2
        ) if team_players else 0
        teams_result.append({
            'order': i,
            'name': f'Time {TEAM_COLORS[i % len(TEAM_COLORS)]}',
            'color': TEAM_COLORS[i % len(TEAM_COLORS)],
            'color_hex': TEAM_COLOR_HEX[i % len(TEAM_COLOR_HEX)],
            'avg_overall': avg,
            'players': team_players,
        })

    return {
        'teams': teams_result,
        'balance_score': balance_score,
        'total_players': len(players),
        'modality': modality,
        'players_per_team': modality,
        'n_teams': len(teams_result),
    }
