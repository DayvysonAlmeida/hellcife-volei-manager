"""
Script para criar dados de demonstração para o HellLife Vôlei Manager.
Execute: python manage.py shell < apps/core/seed_data.py
"""
import os
import django
import sys

# Não precisa chamar setup se já está no shell do manage
from apps.core.models import User
from apps.players.models import Player
from apps.evaluations.models import Evaluation, EvaluationConfig
from apps.attendance.models import GameDay, Attendance
from django.utils import timezone
from datetime import date, timedelta
import random

print("Criando dados de demonstração...")

# Superuser
if not User.objects.filter(email='admin@hellcife.com').exists():
    User.objects.create_superuser(
        email='admin@hellcife.com',
        password='hellcife123',
        name='Administrador HellCife',
        profile='admin'
    )
    print("✅ Admin criado: admin@hellcife.com / hellcife123")

# Configuração de avaliação padrão
config, _ = EvaluationConfig.objects.get_or_create(name='Padrão', defaults={'is_active': True})

# Jogadores de exemplo (baseados nas capturas de tela)
PLAYERS_DATA = [
    {'name': 'Raldeny', 'shirt_number': 10, 'main_position': 'opposite', 'status': 'active'},
    {'name': 'Cruz', 'shirt_number': 7, 'main_position': 'libero', 'status': 'active'},
    {'name': 'Victor', 'shirt_number': 99, 'main_position': 'outside', 'status': 'active'},
    {'name': 'Weu', 'shirt_number': 89, 'main_position': 'middle', 'status': 'active'},
    {'name': 'Aquiles', 'shirt_number': 56, 'main_position': 'outside', 'status': 'active'},
    {'name': 'Gigio', 'shirt_number': 36, 'main_position': 'middle', 'status': 'active'},
    {'name': 'Rodrigo', 'shirt_number': 32, 'main_position': 'setter', 'status': 'active'},
    {'name': 'Polly', 'shirt_number': 26, 'main_position': 'libero', 'status': 'active'},
    {'name': 'Gomes', 'shirt_number': 25, 'main_position': 'outside', 'status': 'active'},
    {'name': 'Fumaça (Juan)', 'shirt_number': 22, 'main_position': 'middle', 'status': 'active'},
    {'name': 'RN', 'shirt_number': 21, 'main_position': 'outside', 'status': 'active'},
    {'name': 'Alex', 'shirt_number': 19, 'main_position': 'outside', 'status': 'active'},
    {'name': 'Adenilson', 'nickname': 'Deni', 'shirt_number': 15, 'main_position': 'setter', 'status': 'active'},
    {'name': 'Dayvyson', 'shirt_number': 12, 'main_position': 'opposite', 'status': 'active'},
    {'name': 'Marquinhos', 'shirt_number': 11, 'main_position': 'outside', 'status': 'active'},
    {'name': 'Anthiago', 'shirt_number': 9, 'main_position': 'middle', 'status': 'active'},
    {'name': 'Coutinho', 'shirt_number': 8, 'main_position': 'outside', 'status': 'active'},
    {'name': 'Pablo', 'shirt_number': 6, 'main_position': 'libero', 'status': 'active'},
    {'name': 'ATENA', 'shirt_number': 5, 'main_position': 'setter', 'status': 'active'},
    {'name': 'Walef', 'shirt_number': 4, 'main_position': 'opposite', 'status': 'active'},
]

admin_user = User.objects.filter(profile='admin').first()
created_players = []

for pd in PLAYERS_DATA:
    p, created = Player.objects.get_or_create(
        name=pd['name'],
        defaults={
            'nickname': pd.get('nickname'),
            'shirt_number': pd.get('shirt_number'),
            'main_position': pd['main_position'],
            'status': pd['status'],
        }
    )
    created_players.append(p)
    if created:
        # Cria avaliação aleatória
        Evaluation.objects.create(
            player=p,
            evaluator=admin_user,
            date=date.today() - timedelta(days=random.randint(1, 30)),
            serve=round(random.uniform(4, 9.5), 1),
            reception=round(random.uniform(4, 9.5), 1),
            passing=round(random.uniform(4, 9.5), 1),
            setting=round(random.uniform(3, 9), 1),
            attack=round(random.uniform(4, 10), 1),
            block=round(random.uniform(3, 9), 1),
            defense=round(random.uniform(4, 9.5), 1),
            recovery=round(random.uniform(4, 9), 1),
            positioning=round(random.uniform(4, 9), 1),
            communication=round(random.uniform(4, 9), 1),
            tactical_iq=round(random.uniform(4, 9), 1),
            conditioning=round(random.uniform(4, 9), 1),
            consistency=round(random.uniform(4, 9), 1),
        )

print(f"✅ {len(PLAYERS_DATA)} jogadores criados/verificados")

# Dia de jogo de hoje
today_gd, _ = GameDay.objects.get_or_create(
    date=date.today(),
    defaults={'description': 'Jogo da semana', 'location': 'Quadra HellCife', 'created_by': admin_user}
)
# Popula presenças
for p in created_players[:15]:
    Attendance.objects.get_or_create(gameday=today_gd, player=p, defaults={'present': True})

print("✅ Dados de demonstração criados com sucesso!")
print(f"\n🔗 Acesse o admin em: http://localhost:8000/admin/")
print(f"📧 Email: admin@hellcife.com")
print(f"🔑 Senha: hellcife123")
