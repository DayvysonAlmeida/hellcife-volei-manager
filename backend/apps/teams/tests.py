from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from apps.attendance.models import CourtCheckin, GameDay
from apps.core.models import User
from apps.players.models import Player
from .models import BracketState, Team, TeamGeneration, TeamPlayer

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


class MultiCourtBase(TestCase):
    """Circuito de teste com 18 atletas de níveis diferentes, todos com check-in."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.client.force_authenticate(self.admin)
        self.gameday = GameDay.objects.create(date=date.today())
        # 18 atletas de níveis diferentes (Elo de 300 a 800)
        self.players = [self.arrive(f'Atleta {i}', elo=300 + i * 30) for i in range(18)]

    def arrive(self, name, elo=500.0):
        player = Player.objects.create(name=name, main_position='outside', elo_all_time=elo)
        CourtCheckin.objects.create(gameday=self.gameday, player=player)
        return player

    def generate(self, courts=2):
        return self.client.post(
            f'{BASE}/generate/', {'modality': 4, 'gameday_id': self.gameday.id, 'courts': courts}, format='json'
        )

    def save(self, result):
        return self.client.post(
            f'{BASE}/save-generated/', {'modality': 4, 'gameday_id': self.gameday.id, 'result': result}, format='json'
        )

    def save_courts(self, courts=2):
        response = self.save(self.generate(courts).data)
        return [TeamGeneration.objects.get(id=i) for i in response.data['generation_ids']]

    def players_of(self, generation):
        return set(TeamPlayer.objects.filter(team__generation=generation).values_list('player_id', flat=True))

    def post(self, generation, action, **data):
        return self.client.post(f'{BASE}/{generation.id}/{action}/', data, format='json')

    def move(self, generation, player_id, team):
        return self.client.patch(
            f'{BASE}/{generation.id}/move-player/', {'player_id': player_id, 'target_team_id': team.id}, format='json'
        )


class MultiCourtTests(MultiCourtBase):
    """Várias quadras ao mesmo tempo no mesmo circuito: um sorteio por quadra, cada atleta numa quadra só."""

    def test_draw_splits_teams_between_courts_without_repeating_anyone(self):
        response = self.generate(courts=2)

        self.assertEqual(response.status_code, 200)
        teams = response.data['teams']
        by_court = {c: [t for t in teams if t['court'] == c] for c in (1, 2)}
        self.assertTrue(all(len(court_teams) >= 2 for court_teams in by_court.values()))
        ids = [p['id'] for t in teams for p in t['players']]
        self.assertEqual(len(ids), 18)
        self.assertEqual(len(set(ids)), 18)
        # Cada quadra tem o seu Time Vermelho
        self.assertEqual(by_court[1][0]['name'], 'Time Vermelho')
        self.assertEqual(by_court[2][0]['name'], 'Time Vermelho')

    def test_courts_are_balanced_between_them(self):
        teams = self.generate(courts=2).data['teams']
        full = [t for t in teams if len(t['players']) == 4]

        def avg(court):
            scores = [p['composite_score'] for t in full if t['court'] == court for p in t['players']]
            return sum(scores) / len(scores)

        strengths = [sum(p['composite_score'] for p in t['players']) / 4 for t in full]
        self.assertLess(abs(avg(1) - avg(2)), (max(strengths) - min(strengths)) / 2 + 0.01)

    def test_needs_two_teams_per_court(self):
        for p in self.players[8:]:
            CourtCheckin.objects.filter(player=p).delete()
        response = self.generate(courts=2)
        self.assertEqual(response.status_code, 400)
        self.assertIn('Mínimo necessário: 16', response.data['detail'])

    def test_saving_creates_one_draw_per_court(self):
        court1, court2 = self.save_courts()
        self.assertEqual((court1.court, court2.court), (1, 2))
        self.assertFalse(self.players_of(court1) & self.players_of(court2))
        self.assertEqual(len(self.players_of(court1) | self.players_of(court2)), 18)

    def test_whoever_arrives_waits_in_every_court_but_players_of_other_courts_do_not(self):
        court1, court2 = self.save_courts()
        late = self.arrive('Atrasado')

        for court in (court1, court2):
            waiting = self.client.get(f'{BASE}/{court.id}/').data['waiting_players']
            self.assertEqual([p['id'] for p in waiting], [late.id])

    def test_complete_never_pulls_players_from_another_court(self):
        court1, court2 = self.save_courts()
        before_court2 = self.players_of(court2)
        late = self.arrive('Atrasado')

        self.assertEqual(self.post(court1, 'auto-allocate').status_code, 200)

        self.assertIn(late.id, self.players_of(court1))
        self.assertEqual(self.players_of(court2), before_court2)
        self.assertFalse(self.players_of(court1) & self.players_of(court2))

    def test_shuffle_only_reshuffles_its_own_court(self):
        court1, court2 = self.save_courts()
        before_court1, before_court2 = self.players_of(court1), self.players_of(court2)

        self.assertEqual(self.post(court1, 'shuffle').status_code, 200)

        self.assertEqual(self.players_of(court1), before_court1)
        self.assertEqual(self.players_of(court2), before_court2)

    def test_move_player_to_another_court(self):
        court1, court2 = self.save_courts()
        player_id = next(iter(self.players_of(court1)))

        response = self.move(court1, player_id, court2.teams.first())

        self.assertEqual(response.status_code, 200)
        self.assertIn('Quadra 2', response.data['detail'])
        self.assertIn(player_id, self.players_of(court2))
        self.assertNotIn(player_id, self.players_of(court1))

    def test_cannot_move_to_another_circuit_or_a_finished_court(self):
        court1, court2 = self.save_courts()
        player_id = next(iter(self.players_of(court1)))
        other_gen = TeamGeneration.objects.create(
            modality=4, gameday=GameDay.objects.create(date=date.today()), created_by=self.admin
        )
        other_team = Team.objects.create(generation=other_gen, name='Outro', order=0)

        self.assertEqual(self.move(court1, player_id, other_team).status_code, 404)

        self.post(court2, 'lock')
        self.assertEqual(self.move(court1, player_id, court2.teams.first()).status_code, 400)
        self.assertIn(player_id, self.players_of(court1))

    def test_cannot_add_someone_who_plays_in_another_court(self):
        court1, court2 = self.save_courts()
        player_id = next(iter(self.players_of(court2)))
        response = self.post(court1, 'add-player', player_id=player_id, team_id=court1.teams.first().id)
        self.assertEqual(response.status_code, 400)
        self.assertIn('Quadra 2', response.data['detail'])

    def test_finishing_one_court_keeps_the_circuit_open_until_the_last(self):
        court1, court2 = self.save_courts()
        data = self.client.get(f'{BASE}/{court1.id}/').data
        self.assertEqual((data['circuit_courts'], data['open_courts']), (2, 2))

        response = self.post(court1, 'lock')
        self.gameday.refresh_from_db()
        court2.refresh_from_db()
        self.assertFalse(response.data['circuit_closed'])
        self.assertFalse(self.gameday.is_closed)
        self.assertFalse(court2.is_locked)

        self.assertEqual(self.client.get(f'{BASE}/{court2.id}/').data['open_courts'], 1)

        response = self.post(court2, 'lock')
        self.gameday.refresh_from_db()
        self.assertTrue(response.data['circuit_closed'])
        self.assertTrue(self.gameday.is_closed)

    def test_single_court_day_works_as_always(self):
        response = self.generate(courts=1)
        teams = response.data['teams']
        self.assertTrue(all(t['court'] == 1 for t in teams))
        self.assertEqual([t['order'] for t in teams], list(range(len(teams))))

        (only,) = self.save_courts(courts=1)
        self.assertEqual(only.court, 1)
        self.post(only, 'lock')
        self.gameday.refresh_from_db()
        self.assertTrue(self.gameday.is_closed)

    def test_open_a_new_court_with_who_is_waiting(self):
        self.save_courts()
        newcomers = {self.arrive(f'Novo {i}').id for i in range(8)}

        response = self.generate(courts=1)
        self.assertEqual(response.status_code, 200)
        self.assertEqual({p['id'] for t in response.data['teams'] for p in t['players']}, newcomers)

        saved = self.save(response.data)
        self.assertEqual(TeamGeneration.objects.get(id=saved.data['generation_id']).court, 3)


class SplitCourtsTests(MultiCourtBase):
    """Dividir em quadras uma pelada que foi sorteada com uma quadra só (e o Completar por atleta)."""

    def split(self, generation, courts=2):
        return self.post(generation, 'split-courts', courts=courts)

    def test_split_one_court_into_two_balanced_courts(self):
        (only,) = self.save_courts(courts=1)

        response = self.split(only, 2)

        self.assertEqual(response.status_code, 200)
        first, second = [TeamGeneration.objects.get(id=i) for i in response.data['generation_ids']]
        self.assertEqual(first.id, only.id)  # o sorteio original vira a primeira quadra
        self.assertEqual((first.court, second.court), (1, 2))
        self.assertFalse(self.players_of(first) & self.players_of(second))
        self.assertEqual(len(self.players_of(first) | self.players_of(second)), 18)
        self.assertGreaterEqual(first.teams.count(), 2)
        self.assertGreaterEqual(second.teams.count(), 2)

    def test_split_brings_who_is_waiting(self):
        (only,) = self.save_courts(courts=1)
        late = self.arrive('Atrasado')

        first_id, second_id = self.split(only, 2).data['generation_ids']

        everyone = self.players_of(TeamGeneration.objects.get(id=first_id)) | self.players_of(TeamGeneration.objects.get(id=second_id))
        self.assertIn(late.id, everyone)

    def test_saved_matches_stay_with_the_first_court(self):
        from apps.matches.models import Match
        (only,) = self.save_courts(courts=1)
        match = Match.objects.create(date=date.today(), modality=4, gameday=self.gameday, team_generation=only)

        self.split(only, 2)

        match.refresh_from_db()
        self.assertEqual(match.team_generation_id, only.id)

    def test_split_refused_when_not_possible(self):
        court1, court2 = self.save_courts(courts=2)
        self.assertIn('outras quadras', self.split(court1, 2).data['detail'])

        self.post(court2, 'lock')
        self.assertEqual(self.split(court1, 4).status_code, 400)  # só 2 ou 3
        response = self.split(court1, 3)  # 10 atletas na quadra não fazem 3 quadras de 4x4
        self.assertEqual(response.status_code, 400)
        self.assertIn('24 atletas', response.data['detail'])

    def test_send_one_waiting_player_to_a_chosen_court(self):
        court1, court2 = self.save_courts()
        ana, bia = self.arrive('Ana'), self.arrive('Bia')

        response = self.post(court2, 'auto-allocate', player_ids=[bia.id])

        self.assertEqual(response.status_code, 200)
        self.assertIn(bia.id, self.players_of(court2))
        waiting = self.client.get(f'{BASE}/{court1.id}/').data['waiting_players']
        self.assertEqual([p['id'] for p in waiting], [ana.id])

    def test_shuffle_with_fewer_players_removes_extra_teams(self):
        (only,) = self.save_courts(courts=1)  # 18 atletas em 4x4: 5 times
        for team in only.teams.order_by('-order')[:2]:
            for tp in team.team_players.all():
                self.post(only, 'remove-player', player_id=tp.player_id)

        response = self.post(only, 'shuffle')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(only.teams.count(), 3)  # 12 que ficaram: 3 times

    def test_new_team_from_complete_gets_its_average(self):
        court1, _ = self.save_courts()
        for i in range(5):  # enche o time incompleto e sobra gente para um time novo
            self.arrive(f'Novo {i}', elo=700)

        self.post(court1, 'auto-allocate')

        newest = court1.teams.order_by('-order').first()
        self.assertGreater(newest.avg_overall, 0)


class CourtModalityTests(MultiCourtBase):
    """Cada quadra pode ter a sua modalidade (ex.: uma 4x4 e outra 2x2)."""

    def test_change_one_court_to_2x2_keeps_the_other(self):
        court1, court2 = self.save_courts()
        before_court1 = {t.id: set(t.team_players.values_list('player_id', flat=True)) for t in court1.teams.all()}
        players_court2 = self.players_of(court2)

        response = self.post(court2, 'shuffle', modality=2)

        self.assertEqual(response.status_code, 200)
        self.assertIn('2x2', response.data['detail'])
        court2.refresh_from_db()
        self.assertEqual(court2.modality, 2)
        self.assertTrue(all(t.team_players.count() <= 2 for t in court2.teams.all()))
        self.assertEqual(self.players_of(court2), players_court2)
        court1.refresh_from_db()
        self.assertEqual(court1.modality, 4)
        after_court1 = {t.id: set(t.team_players.values_list('player_id', flat=True)) for t in court1.teams.all()}
        self.assertEqual(after_court1, before_court1)

    def test_modality_needs_two_teams(self):
        court1, court2 = self.save_courts()  # 8 atletas na Quadra 2
        response = self.post(court2, 'shuffle', modality=6)
        self.assertEqual(response.status_code, 400)
        self.assertIn('12 atletas', response.data['detail'])
        court2.refresh_from_db()
        self.assertEqual(court2.modality, 4)

    def test_invalid_modality(self):
        (only,) = self.save_courts(courts=1)
        self.assertEqual(self.post(only, 'shuffle', modality=7).status_code, 400)


class BracketSyncTests(MultiCourtBase):
    """Fila e placar no servidor: qualquer celular vê e continua; a versão evita um celular apagar o outro."""

    STATE = {'isStarted': True, 'matchNumber': 3, 'scoreA': 12, 'scoreB': 9,
             'courtA': {'name': 'Time Vermelho', 'color_hex': '#D90429'}, 'courtB': {'name': 'Time Azul', 'color_hex': '#2563EB'}}

    def setUp(self):
        super().setUp()
        (self.court,) = self.save_courts(courts=1)
        self.url = f'{BASE}/{self.court.id}/bracket/'

    def put(self, state, version, device='celular-a'):
        return self.client.put(self.url, {'state': state, 'version': version, 'device': device}, format='json')

    def test_empty_until_someone_starts(self):
        data = self.client.get(self.url).data
        self.assertEqual((data['state'], data['version'], data['controller']), (None, 0, None))

    def test_save_and_read_from_another_phone(self):
        response = self.put(self.STATE, 0)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['version'], 1)

        data = self.client.get(self.url, {'device': 'celular-b'}).data
        self.assertEqual(data['state']['scoreA'], 12)
        self.assertEqual(data['controller']['device'], 'celular-a')
        self.assertEqual(data['controller']['name'], 'Admin')

    def test_stale_version_gets_the_server_version(self):
        self.put(self.STATE, 0)
        response = self.put({**self.STATE, 'scoreA': 99}, 0, device='celular-b')  # o B ainda estava na versão 0

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['state']['scoreA'], 12)
        self.assertEqual(response.data['version'], 1)

    def test_whoever_saves_becomes_the_scorer(self):
        self.put(self.STATE, 0)
        self.put({**self.STATE, 'scoreA': 13}, 1, device='celular-b')  # assumiu o placar
        self.assertEqual(self.client.get(self.url).data['controller']['device'], 'celular-b')

    def test_scorer_polling_keeps_it_marked_as_active(self):
        self.put(self.STATE, 0)
        first_seen = self.client.get(self.url).data['controller']['seen_at']
        BracketState.objects.filter(generation=self.court).update(controller_seen_at=None)

        self.client.get(self.url, {'device': 'celular-b'})  # quem só acompanha não renova
        self.assertIsNone(BracketState.objects.get(generation=self.court).controller_seen_at)
        self.client.get(self.url, {'device': 'celular-a'})
        self.assertIsNotNone(BracketState.objects.get(generation=self.court).controller_seen_at)
        self.assertIsNotNone(first_seen)

    def test_finished_court_and_invalid_state_are_refused(self):
        self.assertEqual(self.put('não é fila', 0).status_code, 400)
        self.post(self.court, 'lock')
        self.assertEqual(self.put(self.STATE, 0).status_code, 400)

    def test_draw_shows_the_live_score(self):
        self.put(self.STATE, 0)
        live = self.client.get(f'{BASE}/{self.court.id}/').data['live']
        self.assertEqual((live['match_number'], live['score_a'], live['score_b']), (3, 12, 9))
        self.assertEqual((live['team_a'], live['controller_name']), ('Time Vermelho', 'Admin'))
