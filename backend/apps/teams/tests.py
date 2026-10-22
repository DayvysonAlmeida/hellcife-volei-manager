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


class CompleteTeamsTests(TestCase):
    """Completar: quem chega entra nos times na ordem de chegada, sem desmanchar quem já está num time."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.client.force_authenticate(self.admin)
        self.gameday = GameDay.objects.create(date=date.today())
        self.gen = TeamGeneration.objects.create(modality=4, gameday=self.gameday, created_by=self.admin)
        # Vermelho completo (4) e Azul incompleto (2)
        self.red = self.team('Vermelho', 0, 4)
        self.blue = self.team('Azul', 1, 2)

    def team(self, color, order, size):
        team = Team.objects.create(generation=self.gen, name=f'Time {color}', color=color, order=order)
        for j in range(size):
            player = self.arrive(f'{color} {j}')
            TeamPlayer.objects.create(team=team, player=player, order_in_team=j)
        return team

    def arrive(self, name):
        player = Player.objects.create(name=name, main_position='outside')
        CourtCheckin.objects.create(gameday=self.gameday, player=player)
        return player

    def complete(self):
        return self.client.post(f'{BASE}/{self.gen.id}/auto-allocate/', format='json')

    def members(self, team):
        return list(team.team_players.order_by('order_in_team').values_list('player__name', flat=True))

    def test_fills_the_incomplete_team_keeping_who_was_there(self):
        self.arrive('Ana')
        self.arrive('Bia')

        response = self.complete()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.members(self.blue), ['Azul 0', 'Azul 1', 'Ana', 'Bia'])
        self.assertEqual(self.members(self.red), ['Vermelho 0', 'Vermelho 1', 'Vermelho 2', 'Vermelho 3'])
        self.assertIn('Ana, Bia → Time Azul', response.data['detail'])

    def test_who_arrives_first_plays_first_and_the_rest_starts_a_new_team(self):
        for name in ['Ana', 'Bia', 'Caio']:
            self.arrive(name)

        response = self.complete()

        self.assertEqual(self.members(self.blue)[2:], ['Ana', 'Bia'])
        new_team = self.gen.teams.get(order=2)
        self.assertEqual(self.members(new_team), ['Caio'])
        self.assertIn('(novo)', response.data['detail'])

    def test_new_team_keeps_filling_with_the_next_arrivals(self):
        for name in ['Ana', 'Bia', 'Caio']:
            self.arrive(name)
        self.complete()
        self.arrive('Duda')

        self.complete()

        self.assertEqual(self.members(self.gen.teams.get(order=2)), ['Caio', 'Duda'])
        self.assertEqual(self.gen.teams.count(), 3)

    def test_many_arrivals_make_full_teams_in_arrival_order(self):
        names = [f'Novo {i}' for i in range(7)]
        for name in names:
            self.arrive(name)

        self.complete()

        self.assertEqual(self.members(self.blue)[2:], names[:2])
        self.assertEqual(self.members(self.gen.teams.get(order=2)), names[2:6])
        self.assertEqual(self.members(self.gen.teams.get(order=3)), names[6:])

    def test_new_team_gets_a_color_not_in_use(self):
        self.blue.team_players.all().delete()
        self.blue.team_players.create(player=Player.objects.create(name='X', main_position='outside'), order_in_team=0)
        for i in range(4):
            self.arrive(f'Novo {i}')

        self.complete()

        colors = list(self.gen.teams.values_list('color', flat=True))
        self.assertEqual(len(colors), len(set(colors)))
        self.assertEqual(self.gen.teams.get(order=2).color, 'Verde')

    def test_lists_who_is_waiting_in_arrival_order(self):
        self.arrive('Ana')
        self.arrive('Bia')

        waiting = self.client.get(f'{BASE}/{self.gen.id}/').data['waiting_players']
        self.assertEqual([p['name'] for p in waiting], ['Ana', 'Bia'])

        self.complete()
        self.assertEqual(self.client.get(f'{BASE}/{self.gen.id}/').data['waiting_players'], [])

    def test_nobody_waiting(self):
        self.assertEqual(self.complete().status_code, 400)
