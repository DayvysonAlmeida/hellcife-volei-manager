from django.core.management.base import BaseCommand
from apps.attendance.models import GameDay
from apps.players.models import Player

class Command(BaseCommand):
    help = 'Processa as faltas (no-shows) retroativamente para todos os circuitos já encerrados.'

    def handle(self, *args, **options):
        # Apenas GameDays fechados, publicados e que tiveram pelo menos 1 check-in (evento de fato ocorreu)
        all_closed_gamedays = GameDay.objects.filter(is_closed=True, is_published=True).prefetch_related('court_checkins').order_by('date')
        closed_gamedays = [g for g in all_closed_gamedays if g.court_checkins.count() > 0]
        
        self.stdout.write(f"Encontrados {len(closed_gamedays)} circuitos válidos para processar.")
        
        # Reseta as faltas de todo mundo
        Player.objects.all().update(consecutive_absences=0)
        from apps.attendance.models import Attendance
        Attendance.objects.all().update(was_no_show=False)
        
        for gameday in closed_gamedays:
            self.stdout.write(f"Processando circuito do dia {gameday.date}...")
            # Pega quem compareceu na quadra
            court_checkins_pids = set(gameday.court_checkins.values_list('player_id', flat=True))
            
            # Pega quem estava na lista (confirmados)
            attendances = gameday.attendances.filter(present=True)
            for att in attendances:
                # Se estava confirmado e NÃO fez check-in, é no-show
                if att.player_id not in court_checkins_pids:
                    att.was_no_show = True
                    att.save(update_fields=['was_no_show'])
                    
            # Calcula faltas consecutivas (Ausência prolongada)
            active_players = Player.objects.filter(status__in=['active', 'inactive'], is_guest=False)
            for p in active_players:
                # Ignora se o jogador entrou no sistema DEPOIS desse circuito
                if p.created_at.date() > gameday.date:
                    continue
                    
                if p.id in court_checkins_pids:
                    p.consecutive_absences = 0
                else:
                    p.consecutive_absences += 1
                    if p.consecutive_absences >= 10:
                        p.status = 'inactive'
                p.save(update_fields=['consecutive_absences', 'status'])
                
        self.stdout.write(self.style.SUCCESS('Processamento concluído com sucesso!'))
