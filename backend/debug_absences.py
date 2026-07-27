import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.attendance.models import GameDay, Attendance
from apps.players.models import Player
from django.utils import timezone

all_gamedays = GameDay.objects.prefetch_related('court_checkins', 'attendances').order_by('date', 'time', 'id')
today = timezone.now().date()

players = {p.id: p for p in Player.objects.filter(is_guest=False)}
for p in players.values():
    p.consecutive_absences = 0
    p.log = []

for gameday in all_gamedays:
    court_checkins_pids = set(c.player_id for c in gameday.court_checkins.all())
    is_finished = gameday.is_closed or gameday.date < today
    
    for p in players.values():
        if p.created_at.date() > gameday.date:
            continue
            
        if p.id in court_checkins_pids:
            p.consecutive_absences = 0
            p.log.append(f"GD {gameday.id} ({gameday.date}): Checkin! Reset to 0")
        elif is_finished:
            p.consecutive_absences += 1
            p.log.append(f"GD {gameday.id} ({gameday.date}): Absent. Now {p.consecutive_absences}")

for p in players.values():
    if p.log:
        print(f"--- Player {p.display_name} (ID {p.id}) ---")
        for line in p.log[-5:]:  # show last 5 events
            print(line)
        print(f"FINAL: {p.consecutive_absences}\n")
