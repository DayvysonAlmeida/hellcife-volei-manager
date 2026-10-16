from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Processa as faltas (no-shows) retroativamente para todos os circuitos já encerrados.'

    def handle(self, *args, **options):
        # Mesma regra do botão "Processar faltas" do app (publicados, com check-in na quadra,
        # falta justificada e Ponto de Reset).
        from apps.attendance.views import sync_absences_logic

        days_count = sync_absences_logic()
        self.stdout.write(self.style.SUCCESS(f'Processamento concluído! {days_count} dias analisados.'))
