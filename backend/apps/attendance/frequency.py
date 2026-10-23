"""
Presença na quadra: mesma regra das faltas consecutivas.

Só contam os dias com circuito que aconteceu de fato (publicado, já encerrado ou com a data
passada, e com pelo menos uma pessoa na quadra). Vários circuitos no mesmo dia valem um dia só.
"Foi" = fez check-in na quadra. Falta justificada não entra na conta.
"""
from django.db.models import Prefetch
from django.utils import timezone

from .models import Attendance, GameDay


def circuit_happened(gameday, today) -> bool:
    """Circuito que conta para faltas e presença. Espera court_checkins pré-carregado."""
    return (gameday.is_closed or gameday.date < today) and gameday.is_published and len(gameday.court_checkins.all()) > 0


def circuit_days(start=None, end=None) -> dict:
    """{data: (quem foi à quadra, quem justificou a falta)} dos dias com circuito realizado."""
    today = timezone.localdate()
    qs = GameDay.objects.filter(is_published=True).prefetch_related(
        'court_checkins',
        Prefetch('attendances', queryset=Attendance.objects.filter(is_justified=True), to_attr='justified'),
    )
    if start:
        qs = qs.filter(date__gte=start)
    if end:
        qs = qs.filter(date__lte=end)

    days = {}
    for g in qs:
        if not circuit_happened(g, today):
            continue
        went, justified = days.setdefault(g.date, (set(), set()))
        went.update(c.player_id for c in g.court_checkins.all())
        justified.update(a.player_id for a in g.justified)
    return days


def frequency(player, days) -> dict:
    """Presença do atleta nos dias com circuito desde o cadastro."""
    since = player.created_at.date()
    attended = total = 0
    for day, (went, justified) in days.items():
        if day < since:
            continue
        if player.id in went:
            attended += 1
        elif player.id in justified:
            continue
        total += 1
    return {
        'attended_days': attended,
        'total_days': total,
        'rate': round(attended / total * 100, 1) if total else 0,
    }
