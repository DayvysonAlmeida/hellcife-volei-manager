"""
Algoritmo de geração inteligente de equipes balanceadas.

Estratégia:
1. Filtrar jogadores com avaliação e ordenar por overall DESC
2. Snake-draft: distribui em zigue-zague pelos times
3. Pós-balanceamento por posição: verifica cobertura de posições-chave
4. Calcula score de balanceamento (desvio padrão dos overalls médios)
"""
import math
import statistics
from typing import List, Dict, Optional

from apps.players.models import Player
from apps.attendance.models import GameDay, Attendance


def get_players_with_overall(player_ids: Optional[List[int]] = None, gameday_id: Optional[int] = None) -> List[Dict]:
    """
    Retorna jogadores com seu último overall.
    Filtra por gameday (presentes) ou por lista de IDs.
    """
    if gameday_id:
        present_player_ids = Attendance.objects.filter(
            gameday_id=gameday_id, present=True
        ).values_list('player_id', flat=True)
        players = Player.objects.filter(id__in=present_player_ids, status='active')
    elif player_ids:
        players = Player.objects.filter(id__in=player_ids, status='active')
    else:
        players = Player.objects.filter(status='active')

    result = []
    for p in players.prefetch_related('evaluations'):
        last_eval = p.evaluations.order_by('-date').first()
        overall = last_eval.overall if last_eval else 5.0
        result.append({
            'id': p.id,
            'name': p.name,
            'nickname': p.nickname,
            'display_name': p.display_name,
            'main_position': p.main_position,
            'secondary_position': p.secondary_position,
            'shirt_number': p.shirt_number,
            'avatar_url': p.avatar_url,
            'overall': overall,
        })

    result.sort(key=lambda x: x['overall'], reverse=True)
    return result


def snake_draft(players: List[Dict], team_size: int) -> List[List[Dict]]:
    """
    Distribui jogadores em times usando snake draft.
    Round 1: time 0, 1, 2... N-1
    Round 2: time N-1, N-2... 0
    Round 3: time 0, 1... (repete)
    """
    n_teams = math.floor(len(players) / team_size)
    if n_teams < 2:
        n_teams = 2

    teams = [[] for _ in range(n_teams)]
    for i, player in enumerate(players):
        round_idx = i // n_teams
        pos_in_round = i % n_teams
        
        if round_idx % 2 == 0:
            team_idx = pos_in_round
        else:
            team_idx = (n_teams - 1) - pos_in_round
            
        teams[team_idx].append(player)

    return teams


def calculate_balance_score(teams: List[List[Dict]]) -> float:
    """
    Calcula score de balanceamento como desvio padrão dos overalls médios.
    Quanto menor, mais balanceado.
    """
    if len(teams) < 2:
        return 0.0
    avgs = []
    for team in teams:
        if team:
            avgs.append(sum(p['overall'] for p in team) / len(team))
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

    # Separar levantadores para distribuí-los primeiro no snake draft
    setters = [p for p in players if p['main_position'] == 'setter' or p['secondary_position'] == 'setter']
    others = [p for p in players if p not in setters]
    
    # A lista final vai ser: Levantadores (ordenados) + Outros (ordenados)
    ordered_players = setters + others

    teams_players = snake_draft(ordered_players, modality)
    balance_score = calculate_balance_score(teams_players)

    teams_result = []
    for i, team_players in enumerate(teams_players):
        if not team_players:
            continue
        avg = round(sum(p['overall'] for p in team_players) / len(team_players), 2) if team_players else 0
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
