from datetime import date, timedelta

from django.test import TestCase
from rest_framework.test import APIClient

from apps.attendance.models import GameDay
from apps.core.models import User
from apps.players.models import Player
from apps.teams.algorithm import get_players_with_overall
from apps.teams.models import Team, TeamGeneration, TeamPlayer
from .models import Evaluation, latest_evaluation

SKILLS = [
    'serve', 'reception', 'passing', 'setting', 'attack', 'block', 'defense', 'recovery',
    'positioning', 'communication', 'tactical_iq', 'conditioning', 'consistency',
]


def evaluate(player, day, grade):
    """Avaliação com todos os fundamentos iguais: o overall sai igual à nota."""
    return Evaluation.objects.create(player=player, date=day, **{skill: grade for skill in SKILLS})


class SameDayEvaluationsTests(TestCase):
    """
    Duas avaliações com a mesma data: vale a registrada por último, em todas as telas e no sorteio.
    Antes cada tela escolhia uma (o banco não garante a ordem entre datas iguais).
    """

    def setUp(self):
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.ana = Player.objects.create(name='Ana', main_position='setter', gender='F')
        today = date.today()
        evaluate(self.ana, today, 5)                        # primeira do dia
        evaluate(self.ana, today, 8)                        # corrigida no mesmo dia: é a que vale
        evaluate(self.ana, today - timedelta(days=3), 9)    # registrada depois, mas de uma data anterior

    def test_rule_picks_last_registered_of_the_most_recent_day(self):
        self.assertEqual(latest_evaluation(Evaluation.objects.all()).overall, 8)
        self.assertIsNone(latest_evaluation([]))
        self.assertEqual(self.ana.latest_overall, 8)
        self.assertEqual(self.ana.draw_overall, 8)

    def test_athletes_list_and_profile(self):
        row = next(p for p in self.client.get('/api/players/?page_size=50').data['results'] if p['id'] == self.ana.id)
        self.assertEqual(row['latest_overall'], 8)
        self.assertEqual(self.client.get(f'/api/players/{self.ana.id}/').data['latest_overall'], 8)

    def test_evaluations_screen(self):
        history = self.client.get(f'/api/evaluations/by-player/{self.ana.id}/').data
        self.assertEqual([row['overall'] for row in history], [8, 5, 9])  # "Avaliação atual" primeiro
        self.assertEqual(self.client.get(f'/api/evaluations/radar/{self.ana.id}/').data['overall'], 8)
        listed = self.client.get(f'/api/evaluations/?player={self.ana.id}').data
        rows = listed['results'] if isinstance(listed, dict) else listed
        self.assertEqual(rows[0]['overall'], 8)

    def test_draw_uses_the_same_grade(self):
        self.assertEqual(get_players_with_overall(player_ids=[self.ana.id])[0]['overall'], 8)

    def test_teams_screen_uses_the_same_grade(self):
        gen = TeamGeneration.objects.create(modality=2, gameday=GameDay.objects.create(date=date.today()), created_by=self.admin)
        team = Team.objects.create(generation=gen, name='Time A', order=0)
        TeamPlayer.objects.create(team=team, player=self.ana)
        data = self.client.get(f'/api/teams/{gen.id}/').data
        self.assertEqual(data['teams'][0]['team_players'][0]['player_overall'], 8)

    def test_overall_history_ends_with_the_grade_that_counts(self):
        history = self.client.get(f'/api/players/{self.ana.id}/stats/').data['overall_history']
        self.assertEqual([row['overall'] for row in history], [9, 5, 8])
