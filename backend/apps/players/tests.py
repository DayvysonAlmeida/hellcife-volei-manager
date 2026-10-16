from datetime import date

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.core.models import User
from apps.matches.models import Match, MatchPlayer, MatchTeam
from .models import Player
from .rankings import fire_shark_positions, fire_shark_ranking, stars_ranking, wins_ranking


class RankingConsistencyTests(TestCase):
    """Fire Shark, Gladiadores e Estrelas: mesma regra em todas as telas, sem inativos e convidados."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.client.force_authenticate(self.admin)

        self.ana = self.player('Ana', wins=9, losses=3)
        self.bia = self.player('Bia', wins=7, losses=5)
        self.caio = self.player('Caio', wins=7, losses=5)  # empata com a Bia: decide pelo nome
        self.inactive = self.player('Inativo', wins=12, losses=0, status='inactive', big_stars=5)
        self.guest = self.player('Convidado', wins=12, losses=0, is_guest=True, big_stars=5)
        self.ana.big_stars = 1
        self.ana.save(update_fields=['big_stars'])

    def player(self, name, wins, losses, **extra):
        p = Player.objects.create(name=name, main_position='setter', **extra)
        for won in [True] * wins + [False] * losses:
            match = Match.objects.create(date=date.today(), modality=2)
            team = MatchTeam.objects.create(match=match, team_name='Time', winner=won)
            MatchPlayer.objects.create(match=match, match_team=team, player=p)
        return p

    def test_inactive_and_guests_never_rank(self):
        excluded = {self.inactive.id, self.guest.id}
        self.assertFalse(excluded & {p.id for p in fire_shark_ranking()})
        self.assertFalse(excluded & {p.id for p in wins_ranking()})
        self.assertFalse(excluded & {p.id for p in stars_ranking()})

    def test_tie_is_broken_in_a_stable_order(self):
        self.assertEqual([p.name for p in fire_shark_ranking()], ['Ana', 'Bia', 'Caio'])

    def test_admin_athlete_and_card_show_the_same_fire_shark(self):
        expected = [self.ana.id, self.bia.id, self.caio.id]
        admin = [p['id'] for p in self.client.get('/api/dashboard/').data['fire_sharks']]
        athlete = [p['id'] for p in self.client.get('/api/players/dashboard-stats/').data['fire_sharks']]
        self.assertEqual(admin, expected)
        self.assertEqual(athlete, expected)

        listing = self.client.get('/api/players/', {'page_size': 50}).data
        cards = {p['id']: p['stats']['fire_shark_rank'] for p in listing.get('results', listing)}
        self.assertEqual([cards[pid] for pid in expected], [1, 2, 3])
        self.assertIsNone(cards.get(self.inactive.id))

    def test_profile_position_matches_the_ranking(self):
        stats = self.client.get(f'/api/players/{self.caio.id}/stats/').data
        self.assertEqual(stats['win_rank'], fire_shark_positions()[self.caio.id])
        self.assertIsNone(self.client.get(f'/api/players/{self.inactive.id}/stats/').data['win_rank'])

    def test_leaderboard_excludes_guests(self):
        response = self.client.get('/api/players/ranking/', {'all': 'true'})
        rows = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertNotIn(self.guest.id, [r['id'] for r in rows])


# ─── Elo por times e temporadas ──────────────────────────────────────────────

from datetime import timedelta  # noqa: E402
from unittest.mock import patch  # noqa: E402

from . import elo_service  # noqa: E402
from .models import Season, SeasonStanding  # noqa: E402
from .rankings import fire_shark_min_games  # noqa: E402
from .seasons import ensure_current_season, season_bounds, season_number_for  # noqa: E402


def one_match(team_a_won, a, b, mp=iter(range(1, 10 ** 6))):
    """Partida no formato do replay(): dois times de player_ids."""
    return (next(mp), [(team_a_won, [(next(mp), p) for p in a]), (not team_a_won, [(next(mp), p) for p in b])])


class EloMathTests(TestCase):
    def test_equal_teams_are_zero_sum(self):
        elo, _ = elo_service.replay([one_match(True, [1, 2], [3, 4])], placement=False)
        self.assertAlmostEqual(elo[1], 516)
        self.assertAlmostEqual(elo[3], 484)
        self.assertAlmostEqual(sum(elo.values()), 4 * 500)

    def test_placement_games_move_faster(self):
        elo, _ = elo_service.replay([one_match(True, [1], [2])])
        self.assertAlmostEqual(elo[1], 524)  # K=48 nos 10 primeiros jogos
        games = [one_match(True, [1], [2]) for _ in range(10)] + [one_match(False, [1], [3])]
        elo, deltas = elo_service.replay(games)
        last_delta = list(deltas.values())[-2]  # o 11º jogo do jogador 1 já usa K=32
        self.assertLess(abs(last_delta), 32)

    def test_beating_the_favorite_pays_more(self):
        strong = [one_match(True, [1], [9], ) for _ in range(5)]
        upset = elo_service.replay(strong + [one_match(True, [2], [1])])[0][2]
        expected = elo_service.replay(strong + [one_match(True, [1], [2])])[0][1]
        gain_upset = upset - 500
        gain_favorite = expected - elo_service.replay(strong)[0][1]
        self.assertGreater(gain_upset, gain_favorite)

    def test_floor_and_draw(self):
        # perdendo sempre para adversários novos (500), o Elo desce até o piso
        losses = [one_match(False, [1], [1000 + i]) for i in range(300)]
        self.assertEqual(elo_service.replay(losses)[0][1], elo_service.ELO_MIN)
        draw = (1, [(False, [(10, 5)]), (False, [(11, 6)])])
        elo, deltas = elo_service.replay([draw])
        self.assertEqual(deltas, {10: 0.0, 11: 0.0})
        self.assertNotIn(5, elo)


class SeasonCalendarTests(TestCase):
    def test_semesters(self):
        self.assertEqual(season_number_for(date(2026, 10, 16)), 0)
        self.assertEqual(season_number_for(date(2026, 12, 31)), 0)
        self.assertEqual(season_number_for(date(2027, 1, 1)), 1)
        self.assertEqual(season_number_for(date(2027, 6, 30)), 1)
        self.assertEqual(season_number_for(date(2027, 7, 1)), 2)
        self.assertEqual(season_number_for(date(2028, 1, 1)), 3)
        self.assertEqual(season_bounds(1), (date(2027, 1, 1), date(2027, 6, 30)))
        self.assertEqual(season_bounds(2), (date(2027, 7, 1), date(2027, 12, 31)))
        self.assertEqual(season_bounds(0), (None, date(2026, 12, 31)))


class SeasonRolloverTests(TestCase):
    """Virada de temporada: resultado final salvo uma vez só e todo mundo de volta aos 500."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.client.force_authenticate(self.admin)
        self.players = [Player.objects.create(name=f'P{i}', main_position='setter') for i in range(4)]

    def play(self, day, winners, losers, score=(21, 15)):
        match = Match.objects.create(date=day, modality=2)
        for won, team, pts in ((True, winners, score[0]), (False, losers, score[1])):
            mt = MatchTeam.objects.create(match=match, team_name='Time', winner=won, score=pts)
            for p in team:
                MatchPlayer.objects.create(match=match, match_team=mt, player=p)
        return match

    def at(self, day):
        return patch('django.utils.timezone.localdate', return_value=day)

    def test_rollover_saves_standings_and_resets_elo(self):
        a, b, c, d = self.players
        for i in range(12):
            self.play(date(2026, 11, 1) + timedelta(days=i), [a, b], [c, d])
        with self.at(date(2026, 12, 20)):
            elo_service.recalculate_all()
        a.refresh_from_db()
        self.assertGreater(a.elo, 500)
        self.assertGreater(MatchPlayer.objects.filter(player=a).first().elo_delta, 0)

        with self.at(date(2027, 1, 3)):
            season = ensure_current_season()
            self.assertEqual(season.number, 1)
            ensure_current_season()  # segunda chamada não encerra de novo

        pre = Season.objects.get(number=0)
        self.assertIsNotNone(pre.finalized_at)
        self.assertEqual(SeasonStanding.objects.filter(season=pre).count(), 4)
        top = SeasonStanding.objects.get(season=pre, elo_rank=1)
        self.assertIn(top.player_id, {a.id, b.id})
        self.assertEqual(top.wins, 12)

        a.refresh_from_db()
        self.assertEqual(a.elo, 500)                 # temporada nova: todo mundo do zero
        self.assertGreater(a.elo_all_time, 500)      # o histórico oculto continua

    def test_editing_history_replays_the_season(self):
        a, b, c, d = self.players
        first = self.play(date(2026, 11, 1), [a, b], [c, d])
        self.play(date(2026, 11, 2), [a, b], [c, d])
        with self.at(date(2026, 12, 20)):
            elo_service.recalculate_all()
            elo_two_wins = Player.objects.get(pk=a.pk).elo
            self.client.delete(f'/api/matches/{first.id}/')
        self.assertLess(Player.objects.get(pk=a.pk).elo, elo_two_wins)

    def test_seasons_endpoint_shows_podium(self):
        a, b, c, d = self.players
        for i in range(12):
            self.play(date(2026, 11, 1) + timedelta(days=i), [a, b], [c, d])
        with self.at(date(2027, 1, 3)):
            data = self.client.get('/api/players/seasons/').data
        self.assertEqual(data['current']['number'], 1)
        podium = data['past'][0]['podium']
        self.assertEqual(len(podium['elo']), 3)
        self.assertEqual(podium['gladiator'][0]['wins'], 12)
        self.assertIn(podium['fire_shark'][0]['player_id'], {a.id, b.id})


class FireSharkRuleTests(SeasonRolloverTests):
    """Fire Shark: mínimo proporcional à temporada e desempate pelo saldo de pontos."""

    def test_minimum_grows_with_the_season(self):
        a, b, c, d = self.players
        with self.at(date(2026, 12, 20)):
            self.assertEqual(fire_shark_min_games(), 10)
            for i in range(50):
                self.play(date(2026, 11, 1), [a, b], [c, d])
            self.assertEqual(fire_shark_min_games(), 15)  # 30% da mediana de 50 jogos

    def test_point_balance_breaks_ties(self):
        a, b, c, d = self.players
        with self.at(date(2026, 12, 20)):
            for _ in range(10):
                self.play(date(2026, 11, 1), [a], [c], score=(21, 5))
                self.play(date(2026, 11, 1), [b], [d], score=(21, 19))
            ranking = [p.id for p in fire_shark_ranking()]
        self.assertEqual(ranking[:2], [a.id, b.id])  # mesmo aproveitamento, saldo maior primeiro

    test_rollover_saves_standings_and_resets_elo = None
    test_editing_history_replays_the_season = None
    test_seasons_endpoint_shows_podium = None
