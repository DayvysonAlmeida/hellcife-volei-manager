from datetime import date

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.attendance.models import CourtCheckin, GameDay
from apps.core.models import User
from apps.players.models import Player
from .models import BracketState, Team, TeamGeneration, TeamPlayer

LIVE_STATE = {
    'isStarted': True, 'matchNumber': 3, 'scoreA': 12, 'scoreB': 9,
    'courtA': {'name': 'Time A', 'color_hex': '#D90429'}, 'courtB': {'name': 'Time B', 'color_hex': '#2563EB'},
}


class TeamsScreenListTests(TestCase):
    """A tela Times atualiza só as quadras abertas; o histórico vem à parte, sem placar ao vivo."""

    def setUp(self):
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.today = GameDay.objects.create(date=date.today())
        self.open = self.generation(self.today, locked=False)
        BracketState.objects.create(generation=self.open, state=LIVE_STATE)
        self.closed = [self.generation(GameDay.objects.create(date=date(2026, 1, i + 1)), locked=True) for i in range(3)]
        for gen in self.closed:
            BracketState.objects.create(generation=gen, state=LIVE_STATE)  # placar que ficou salvo ao encerrar

    def generation(self, gameday, locked):
        gen = TeamGeneration.objects.create(modality=2, gameday=gameday, created_by=self.admin, is_locked=locked)
        for t in range(2):
            team = Team.objects.create(generation=gen, name=f'Time {t}', order=t)
            for j in range(2):
                player = Player.objects.create(name=f'{gen.id}-{t}-{j}', main_position='setter')
                TeamPlayer.objects.create(team=team, player=player, order_in_team=j)
                CourtCheckin.objects.create(gameday=gameday, player=player)
        return gen

    def ids(self, query=''):
        return [g['id'] for g in self.client.get(f'/api/teams/{query}').data['results']]

    def test_filters_open_and_closed_courts(self):
        self.assertEqual(self.ids('?is_locked=false'), [self.open.id])
        self.assertEqual(set(self.ids('?is_locked=true')), {g.id for g in self.closed})
        self.assertEqual(len(self.ids()), 4)  # sem o parâmetro, tudo como antes

    def test_open_courts_query_does_not_grow_with_history(self):
        with CaptureQueriesContext(connection) as before:
            self.client.get('/api/teams/?is_locked=false')
        for i in range(3):
            self.generation(GameDay.objects.create(date=date(2025, 6, i + 1)), locked=True)
        with CaptureQueriesContext(connection) as after:
            data = self.client.get('/api/teams/?is_locked=false').data
        self.assertEqual(len(after), len(before))
        self.assertEqual(len(data['results']), 1)

    def test_history_has_no_live_score_and_constant_queries(self):
        with CaptureQueriesContext(connection) as before:
            data = self.client.get('/api/teams/?is_locked=true').data
        self.assertTrue(all(g['live'] is None and g['waiting_players'] == [] for g in data['results']))
        self.assertTrue(all(g['circuit_courts'] == 1 for g in data['results']))
        self.generation(GameDay.objects.create(date=date(2025, 6, 9)), locked=True)
        with CaptureQueriesContext(connection) as after:
            self.client.get('/api/teams/?is_locked=true')
        self.assertEqual(len(after), len(before))

    def test_open_court_keeps_live_score_and_waiting_list(self):
        late = Player.objects.create(name='Atrasada', main_position='setter')
        CourtCheckin.objects.create(gameday=self.today, player=late)
        gen = self.client.get('/api/teams/?is_locked=false').data['results'][0]
        self.assertEqual((gen['live']['score_a'], gen['live']['score_b']), (12, 9))
        self.assertEqual([p['id'] for p in gen['waiting_players']], [late.id])

    def test_guest_without_evaluation_uses_guest_level(self):
        guest = Player.objects.create(name='Convidado', main_position='setter', is_guest=True, guest_overall=6)
        TeamPlayer.objects.create(team=self.open.teams.first(), player=guest, order_in_team=5)
        gen = self.client.get(f'/api/teams/{self.open.id}/').data
        overall = {tp['player']: tp['player_overall'] for team in gen['teams'] for tp in team['team_players']}
        self.assertEqual(overall[guest.id], 6)
