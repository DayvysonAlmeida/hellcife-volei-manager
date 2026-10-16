from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from apps.attendance.models import CourtCheckin, GameDay
from apps.core.models import User
from apps.players.models import Player
from .models import Team, TeamGeneration, TeamPlayer

BASE = '/api/teams'


class RemovedPlayersTests(TestCase):
    """Quem sai da pelada não volta no Embaralhar/Alocar, mas mantém o check-in na quadra."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.client.force_authenticate(self.admin)
        self.gameday = GameDay.objects.create(date=date.today())
        self.players = [Player.objects.create(name=f'P{i}', main_position='setter') for i in range(6)]
        for p in self.players:
            CourtCheckin.objects.create(gameday=self.gameday, player=p)

        self.gen = TeamGeneration.objects.create(modality=2, gameday=self.gameday, created_by=self.admin)
        for t in range(3):
            team = Team.objects.create(generation=self.gen, name=f'Time {t}', order=t)
            for j, p in enumerate(self.players[t * 2:t * 2 + 2]):
                TeamPlayer.objects.create(team=team, player=p, order_in_team=j)

        self.gone = self.players[0]

    def post(self, action, **data):
        return self.client.post(f'{BASE}/{self.gen.id}/{action}/', data, format='json')

    def in_generation(self):
        return set(TeamPlayer.objects.filter(team__generation=self.gen).values_list('player_id', flat=True))

    def test_removed_player_keeps_court_checkin(self):
        self.assertEqual(self.post('remove-player', player_id=self.gone.id).status_code, 200)
        self.assertTrue(CourtCheckin.objects.filter(gameday=self.gameday, player=self.gone).exists())
        self.assertEqual(list(self.gen.removed_players.all()), [self.gone])

    def test_shuffle_does_not_bring_back_who_left(self):
        self.post('remove-player', player_id=self.gone.id)
        self.assertEqual(self.post('shuffle').status_code, 200)
        expected = {p.id for p in self.players[1:]}
        self.assertEqual(self.in_generation(), expected)

    def test_shuffle_includes_late_arrivals(self):
        late = Player.objects.create(name='Atrasado', main_position='setter')
        CourtCheckin.objects.create(gameday=self.gameday, player=late)
        self.post('remove-player', player_id=self.gone.id)
        self.post('shuffle')
        self.assertIn(late.id, self.in_generation())
        self.assertNotIn(self.gone.id, self.in_generation())

    def test_auto_allocate_ignores_who_left(self):
        self.post('remove-player', player_id=self.gone.id)
        late = Player.objects.create(name='Atrasado', main_position='setter')
        CourtCheckin.objects.create(gameday=self.gameday, player=late)
        self.assertEqual(self.post('auto-allocate').status_code, 200)
        self.assertIn(late.id, self.in_generation())
        self.assertNotIn(self.gone.id, self.in_generation())

    def test_restore_brings_player_back_on_next_shuffle(self):
        self.post('remove-player', player_id=self.gone.id)
        self.assertEqual(self.post('restore-player', player_id=self.gone.id).status_code, 200)
        self.assertFalse(self.gen.removed_players.exists())
        self.post('shuffle')
        self.assertIn(self.gone.id, self.in_generation())

    def test_adding_manually_clears_removed_status(self):
        self.post('remove-player', player_id=self.gone.id)
        team = self.gen.teams.first()
        self.assertEqual(self.post('add-player', player_id=self.gone.id, team_id=team.id).status_code, 200)
        self.assertFalse(self.gen.removed_players.exists())

    def test_generation_exposes_removed_players(self):
        self.post('remove-player', player_id=self.gone.id)
        data = self.client.get(f'{BASE}/{self.gen.id}/').data
        self.assertEqual([p['id'] for p in data['removed_players']], [self.gone.id])
