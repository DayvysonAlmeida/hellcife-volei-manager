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
from apps.attendance.models import GameDay, Attendance, CourtCheckin


def get_players_with_overall(player_ids: Optional[List[int]] = None, gameday_id: Optional[int] = None) -> List[Dict]:
    """
    Retorna jogadores com seu último overall.
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
        # Use prefetched evaluations — sort in Python to avoid bypassing prefetch
        evals = list(p.evaluations.all())
        if evals:
            evals.sort(key=lambda e: e.date, reverse=True)
            overall = evals[0].overall
        else:
            overall = 5.0
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
            'overall': overall,
        })

    result.sort(key=lambda x: x['overall'], reverse=True)
    return result


def smart_draft(players: List[Dict], team_size: int) -> List[List[Dict]]:
    """
    Distribui jogadores em times usando um algoritmo inteligente.
    Garante separação de levantadores e mulheres, incluindo no time de sobra,
    mas força o preenchimento dos times principais primeiro.
    """
    n_teams = math.ceil(len(players) / team_size)
    if n_teams < 1:
        n_teams = 1

    limit = n_teams * team_size
    if len(players) < team_size:
        limit = len(players)
    
    draft_players = players[:limit]
    
    # O time de sobras fará parte do draft para receber levantadores/meninas se necessário
    teams = [[] for _ in range(n_teams)]
    
    # Separar os grupos
    setters = [p for p in draft_players if p['main_position'] == 'setter' or p['secondary_position'] == 'setter']
    women = [p for p in draft_players if p.get('gender') == 'F' and p not in setters]
    others = [p for p in draft_players if p not in setters and p not in women]
    
    # Ordenar todos por overall DESC
    setters.sort(key=lambda x: x['overall'], reverse=True)
    women.sort(key=lambda x: x['overall'], reverse=True)
    others.sort(key=lambda x: x['overall'], reverse=True)

    # Identificar quantos times completos devem existir
    full_teams = len(players) // team_size
    
    # Trava de capacidade absoluta de cada time (ex: 4, 4, 4, 1)
    capacities = []
    for i in range(n_teams):
        if i < full_teams:
            capacities.append(team_size)
        else:
            capacities.append(len(players) % team_size)

    def assign_to_best_team(player, group_type):
        # Filtra apenas os times que ainda não bateram sua capacidade estrita
        available_teams = [t for i, t in enumerate(teams) if len(t) < capacities[i]]
        if not available_teams:
            available_teams = teams

        def get_team_priority(team):
            count_total = len(team)
            sum_overall = sum(p['overall'] for p in team)
            # Verifica se é um time extra (sobra). 
            # Isso força o algoritmo a preencher os times principais primeiro ao distribuir os "outros"
            is_extra = 1 if teams.index(team) >= full_teams else 0
            
            if group_type == 'setter':
                setter_count = sum(1 for p in team if p['main_position'] == 'setter' or p['secondary_position'] == 'setter')
                return (setter_count, is_extra, count_total, sum_overall)
            elif group_type == 'woman':
                woman_count = sum(1 for p in team if p.get('gender') == 'F')
                return (woman_count, is_extra, count_total, sum_overall)
            else:
                return (is_extra, count_total, sum_overall)

        available_teams.sort(key=get_team_priority)
        best_team = available_teams[0]
        best_team.append(player)

    for p in setters:
        assign_to_best_team(p, 'setter')
    for p in women:
        assign_to_best_team(p, 'woman')
    for p in others:
        assign_to_best_team(p, 'other')

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

    # O smart_draft fará toda a separação internamente.
    # Garantimos apenas que players esteja ordenado por padrão
    teams_players = smart_draft(players, modality)
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
