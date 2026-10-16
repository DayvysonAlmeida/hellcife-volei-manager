"""
Regras únicas dos rankings (Fire Shark, Gladiadores/vitórias e Estrelas).

Todas as telas (dashboard do admin, dashboard do atleta, rank no card, perfil e
notificação de novo líder) usam estas funções, para mostrarem sempre a mesma ordem.
Só entram atletas ativos e que não são convidados.
"""
from django.db.models import Count, Q

from .models import Player

FIRE_SHARK_MIN_MATCHES = 10
# Média bayesiana: K partidas "fictícias" com 50% de aproveitamento suavizam quem jogou pouco
BAYES_K = 10
BAYES_PRIOR_WINS = BAYES_K * 0.5


def ranked_players():
    """Quem participa dos rankings: atletas ativos, sem convidados."""
    return Player.objects.filter(status='active', is_guest=False)


def with_match_stats(qs=None):
    return (qs if qs is not None else ranked_players()).annotate(
        wins=Count('match_appearances', filter=Q(match_appearances__match_team__winner=True), distinct=True),
        total_matches=Count('match_appearances', distinct=True),
    )


def fire_shark_score(wins: int, total_matches: int) -> float:
    return (wins + BAYES_PRIOR_WINS) / (total_matches + BAYES_K) * 100


def fire_shark_ranking():
    """
    Jogadores com o mínimo de partidas, do melhor para o pior.
    Desempate: mais vitórias, depois mais partidas, depois nome (ordem sempre estável).
    """
    players = list(with_match_stats().filter(total_matches__gte=FIRE_SHARK_MIN_MATCHES))
    for p in players:
        p.fire_score = fire_shark_score(p.wins, p.total_matches)
        p.win_rate = p.wins / p.total_matches * 100 if p.total_matches else 0
    players.sort(key=lambda p: (-p.fire_score, -p.wins, -p.total_matches, p.name.lower()))
    return players


def fire_shark_positions() -> dict:
    """{player_id: posição} no Fire Shark."""
    return {p.id: idx for idx, p in enumerate(fire_shark_ranking(), start=1)}


def wins_ranking():
    """Gladiadores: mais vitórias primeiro; desempate por mais partidas e nome."""
    return with_match_stats().filter(total_matches__gte=1).order_by('-wins', '-total_matches', 'name')


def wins_positions() -> dict:
    """{player_id: posição} por vitórias, em ranking denso (empatados dividem a posição)."""
    positions, current, last = {}, 0, None
    for p in wins_ranking().filter(wins__gt=0):
        if p.wins != last:
            current += 1
            last = p.wins
        positions[p.id] = current
    return positions


def stars_ranking():
    """Estrelas: grandes estrelas, depois mini-estrelas, depois nome."""
    return ranked_players().exclude(big_stars=0, mini_stars=0).order_by('-big_stars', '-mini_stars', 'name')
