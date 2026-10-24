"""
Sistema de Estrelas: as regras de pontuação num lugar só.

Cada categoria soma pontos de mini estrela (MVP vale 6, as outras 1). Com 15 pontos o atleta forja uma
Estrela Grande e os contadores do ciclo voltam a zero. Todo lançamento fica no histórico com quem lançou
e em qual circuito a estrela foi ganha.
"""
from django.core.cache import cache

from apps.notifications.models import Notification
from apps.notifications.services import athlete_audience, notify
from .models import StarHistory

FIELDS = {
    'mvp': 'mvp_stars', 'attack': 'attack_stars', 'defense': 'defense_stars',
    'setter': 'setter_stars', 'pass': 'pass_stars', 'block': 'block_stars',
}
POINTS = {'mvp': 6, 'attack': 1, 'defense': 1, 'setter': 1, 'pass': 1, 'block': 1}
LABELS = {'mvp': 'MVP', 'attack': 'Ataque', 'defense': 'Defesa', 'setter': 'Levantamento', 'pass': 'Passe', 'block': 'Bloqueio'}
BIG_STAR_POINTS = 15
TOTALS = {
    'mvp': 'total_mvp', 'attack': 'total_attack', 'defense': 'total_defense',
    'setter': 'total_setter', 'pass': 'total_pass', 'block': 'total_block',
}


def circuit_label(gameday):
    return f" no circuito de {gameday.date.strftime('%d/%m')}" if gameday else ''


def apply_stars(player, deltas, by, gameday=None, reverts=None):
    """
    Soma (ou tira) estrelas do atleta por categoria, forja a Estrela Grande, grava o histórico e avisa.
    deltas: {'attack': 1, 'mvp': -1, ...}. Os contadores nunca ficam negativos (o chamador valida antes).
    Devolve os registros de histórico criados.
    """
    deltas = {cat: n for cat, n in deltas.items() if n}
    if not deltas:
        return []

    for cat, n in deltas.items():
        setattr(player, FIELDS[cat], max(0, (getattr(player, FIELDS[cat]) or 0) + n))
        if n > 0:
            setattr(player, TOTALS[cat], (getattr(player, TOTALS[cat]) or 0) + n)

    prev_big = player.big_stars or 0
    new_mini = (player.mini_stars or 0) + sum(POINTS[cat] * n for cat, n in deltas.items())
    if new_mini >= BIG_STAR_POINTS:
        player.big_stars = prev_big + 1
        player.mini_stars = 0
        for field in FIELDS.values():
            setattr(player, field, 0)
    else:
        player.mini_stars = max(0, new_mini)
    player.save(update_fields=[*FIELDS.values(), *TOTALS.values(), 'mini_stars', 'big_stars', 'updated_at'])

    history = [
        StarHistory(
            player=player, category=cat, action='add' if n > 0 else 'remove', count=abs(n),
            given_by=by, gameday=gameday, reverts=reverts,
        ) for cat, n in deltas.items()
    ]
    promoted = (player.big_stars or 0) > prev_big
    if promoted:
        history.append(StarHistory(player=player, category='promotion', action='promote', count=1, given_by=by, gameday=gameday))
    StarHistory.objects.bulk_create(history)

    if player.user_id:
        where = circuit_label(gameday)
        notifications = [
            Notification(
                user=player.user, title='Mini Estrela Recebida! ⭐', type='prize', url='/athlete/profile',
                message=f'Você recebeu {n} mini estrela(s) de {LABELS[cat]}{where}. Continue mandando ver!',
            ) for cat, n in deltas.items() if n > 0
        ]
        if promoted:
            notifications.append(Notification(
                user=player.user, title='ESTRELA FORJADA! 🌟', type='prize', url='/athlete/profile',
                message=f'Parabéns! Suas 15 mini estrelas formaram uma nova Estrela Completa{where}! '
                        f'Agora você possui {player.big_stars} estrela(s).',
            ))
            # Os outros atletas veem na lista do app, sem o celular apitar
            notify([
                Notification(
                    user=other, title='Estrela Forjada no Circuito! 🌟', type='circuit',
                    message=f'O atleta {player.display_name} acabou de forjar uma nova Estrela Completa e chegou a {player.big_stars} estrela(s)!',
                ) for other in athlete_audience().exclude(id=player.user_id)
            ], push=False)
        notify(notifications)

    return history


def after_stars_changed():
    """Painel e rankings refletem a nova pontuação."""
    cache.delete('dashboard_data')
    from apps.core.utils.ranking_monitor import check_rank_changes
    check_rank_changes()
