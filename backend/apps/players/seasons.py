"""
Temporadas da ranqueada (Elo, Fire Shark e Gladiador).

Calendário semestral: janeiro-junho e julho-dezembro, a partir de 2027.
A Temporada 0 é a pré-temporada: todo o histórico até 31/12/2026.

O Cloud Run não tem agendador, então a virada é "preguiçosa": na primeira vez que o app
é usado numa temporada nova, as anteriores são encerradas (resultado final salvo) e o Elo
de todos é recalculado, o que faz todo mundo voltar para 500. Isso acontece uma vez só.
"""
from datetime import date

from django.db import transaction
from django.utils import timezone

PRESEASON_END = date(2026, 12, 31)
FIRST_SEASON_YEAR = 2027


def season_number_for(day: date) -> int:
    if day <= PRESEASON_END:
        return 0
    return (day.year - FIRST_SEASON_YEAR) * 2 + (1 if day.month <= 6 else 2)


def season_bounds(number: int):
    """(início, fim) da temporada. A pré-temporada não tem início."""
    if number == 0:
        return None, PRESEASON_END
    year = FIRST_SEASON_YEAR + (number - 1) // 2
    if (number - 1) % 2 == 0:
        return date(year, 1, 1), date(year, 6, 30)
    return date(year, 7, 1), date(year, 12, 31)


def season_name(number: int) -> str:
    return 'Pré-temporada' if number == 0 else f'Temporada {number}'


def get_season(number: int):
    from .models import Season

    start, end = season_bounds(number)
    season, _ = Season.objects.get_or_create(
        number=number, defaults={'name': season_name(number), 'start_date': start, 'end_date': end},
    )
    return season


def ensure_current_season(today: date | None = None):
    """
    Devolve a temporada de hoje. Se houver temporada anterior ainda aberta, encerra
    (salva o resultado final) e recalcula o Elo de todos para a temporada nova.
    """
    from .models import Season

    today = today or timezone.localdate()
    number = season_number_for(today)
    for n in range(number + 1):  # garante que nenhuma temporada fique sem registro
        get_season(n)
    current = Season.objects.get(number=number)

    if Season.objects.filter(number__lt=number, finalized_at__isnull=True).exists():
        with transaction.atomic():
            pending = Season.objects.select_for_update().filter(number__lt=number, finalized_at__isnull=True)
            finalized_any = False
            for old in pending.order_by('number'):
                finalize_season(old)
                finalized_any = True
            if finalized_any:
                from .elo_service import recalculate_all
                recalculate_all(current)
    return current


def finalize_season(season) -> None:
    """Salva o resultado final (Elo, Fire Shark e Gladiador) de cada atleta e encerra a temporada."""
    from apps.matches.models import MatchPlayer

    from .elo_service import PLACEMENT_GAMES, get_elo_tier, load_matches, replay
    from .models import SeasonStanding
    from .rankings import fire_shark_ranking, ranked_players, season_stats

    elo, _ = replay(load_matches(MatchPlayer, season.start_date, season.end_date))
    stats = season_stats(season)
    participants = [p for p in ranked_players() if stats.get(p.id, {}).get('matches')]

    # Posição no Elo só para quem terminou a calibração, como no ranking ao vivo
    calibrated = [p for p in participants if stats[p.id]['matches'] >= PLACEMENT_GAMES]
    by_elo = sorted(calibrated, key=lambda p: (-elo.get(p.id, 500.0), p.name.lower()))
    by_wins = sorted(participants, key=lambda p: (-stats[p.id]['wins'], -stats[p.id]['matches'], p.name.lower()))
    fire = {p.id: (idx, p.fire_score) for idx, p in enumerate(fire_shark_ranking(season), start=1)}
    elo_rank = {p.id: idx for idx, p in enumerate(by_elo, start=1)}
    wins_rank = {p.id: idx for idx, p in enumerate(by_wins, start=1)}

    SeasonStanding.objects.filter(season=season).delete()
    SeasonStanding.objects.bulk_create([
        SeasonStanding(
            season=season,
            player=p,
            elo=round(elo.get(p.id, 500.0), 2),
            elo_tier=get_elo_tier(elo.get(p.id, 500.0))['key'],
            matches=stats[p.id]['matches'],
            wins=stats[p.id]['wins'],
            point_balance=stats[p.id]['balance'],
            fire_score=round(fire[p.id][1], 2) if p.id in fire else None,
            elo_rank=elo_rank.get(p.id),
            fire_rank=fire[p.id][0] if p.id in fire else None,
            wins_rank=wins_rank[p.id],
        )
        for p in participants
    ])
    season.finalized_at = timezone.now()
    season.save(update_fields=['finalized_at'])


def season_info(season) -> dict:
    """Resumo para as telas: nome, datas e contagem regressiva."""
    today = timezone.localdate()
    info = {
        'number': season.number,
        'name': season.name,
        'start_date': season.start_date,
        'end_date': season.end_date,
        'days_left': (season.end_date - today).days,
        'prize_notes': season.prize_notes,
    }
    if season.number == 0:
        start, _ = season_bounds(1)
        info['next_season_starts_in'] = (start - today).days
        info['next_season_start'] = start
    return info
