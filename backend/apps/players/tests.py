from datetime import date
from unittest import mock

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.core.models import User
from apps.matches.models import Match, MatchPlayer, MatchTeam
from apps.core.utils.ranking_monitor import check_rank_changes
from apps.notifications.models import Notification
from .models import Player, RankingLeader
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


class EloRankingTests(SeasonRolloverTests):
    """Ranking de Elo: só quem terminou a calibração, mesma ordem em todas as telas e no resultado final."""

    def setUp(self):
        super().setUp()
        a, b, c, d = self.players
        self.rookie = Player.objects.create(name='Novato', main_position='setter')
        rival = Player.objects.create(name='Rival', main_position='setter')
        for i in range(10):
            self.play(date(2026, 11, 1) + timedelta(days=i), [a, b], [c, d])
        for i in range(3):  # Novato vence 3 e fica com Elo alto, mas ainda em calibração
            self.play(date(2026, 11, 20) + timedelta(days=i), [self.rookie], [rival])
        Player.objects.filter(pk=d.pk).update(status='inactive')
        with self.at(date(2026, 12, 20)):
            elo_service.recalculate_all()

    def test_only_calibrated_active_players_rank(self):
        a, b, c, d = self.players
        self.assertGreater(Player.objects.get(pk=self.rookie.pk).elo, Player.objects.get(pk=c.pk).elo)
        with self.at(date(2026, 12, 20)):
            admin = [p['id'] for p in self.client.get('/api/dashboard/').data['top_elo']]
            athlete_home = self.client.get('/api/players/dashboard-stats/').data
            profile = self.client.get(f'/api/players/{a.id}/stats/').data['season']
        self.assertEqual(admin, [a.id, b.id, c.id])  # a e b empatados: decide pelo nome
        # o ranking de Elo é só do admin: o atleta não recebe a lista nem a posição
        self.assertNotIn('top_elo', athlete_home)
        self.assertNotIn('elo_rank', profile)

    def test_final_standings_follow_the_same_rule(self):
        a = self.players[0]
        with self.at(date(2027, 1, 3)):
            ensure_current_season()
        pre = Season.objects.get(number=0)
        self.assertIsNone(SeasonStanding.objects.get(season=pre, player=self.rookie).elo_rank)
        self.assertEqual(SeasonStanding.objects.get(season=pre, player=a).elo_rank, 1)

    test_rollover_saves_standings_and_resets_elo = None
    test_editing_history_replays_the_season = None
    test_seasons_endpoint_shows_podium = None


class SeasonPrizeTests(SeasonRolloverTests):
    """Premiação da temporada: o admin escreve pelo app e todos veem na tela Temporadas."""

    def test_admin_writes_prize_and_athletes_see_it(self):
        with self.at(date(2026, 12, 20)):
            response = self.client.patch('/api/players/seasons/0/prize/', {'prize_notes': '  Camisa oficial para o Tubarão  '}, format='json')
            self.assertEqual(response.status_code, 200)
            athlete = User.objects.create_user('atleta@x.com', 'senha-forte-123', name='Atleta')
            self.client.force_authenticate(athlete)
            current = self.client.get('/api/players/seasons/').data['current']
            self.assertEqual(current['prize_notes'], 'Camisa oficial para o Tubarão')
            denied = self.client.patch('/api/players/seasons/0/prize/', {'prize_notes': 'x'}, format='json')
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(Season.objects.get(number=0).prize_notes, 'Camisa oficial para o Tubarão')

    def test_unknown_season_and_long_text(self):
        with self.at(date(2026, 12, 20)):
            self.client.get('/api/players/seasons/')
            self.assertEqual(self.client.patch('/api/players/seasons/9/prize/', {'prize_notes': 'x'}, format='json').status_code, 404)
            self.assertEqual(self.client.patch('/api/players/seasons/0/prize/', {'prize_notes': 'x' * 1001}, format='json').status_code, 400)

    test_rollover_saves_standings_and_resets_elo = None
    test_editing_history_replays_the_season = None
    test_seasons_endpoint_shows_podium = None


class EloHistoryTests(SeasonRolloverTests):
    """Gráfico da evolução do Elo: soma dos +/- na ordem das partidas e só o próprio atleta vê."""

    def test_history_adds_up_to_the_current_elo(self):
        a, b, c, d = self.players
        self.play(date(2026, 11, 1), [a, b], [c, d], score=(21, 15))
        self.play(date(2026, 11, 1), [c, d], [a, b], score=(21, 19))
        self.play(date(2026, 11, 2), [a, b], [c, d], score=(21, 10))
        with self.at(date(2026, 12, 20)):
            elo_service.recalculate_all()
            data = self.client.get(f'/api/players/{a.id}/elo-history/').data
        a.refresh_from_db()
        self.assertEqual([m['result'] for m in data['matches']], ['win', 'loss', 'win'])
        self.assertEqual((data['matches'][1]['score'], data['matches'][1]['opponent_score']), (19, 21))
        self.assertAlmostEqual(data['matches'][-1]['elo'], a.elo, places=0)
        self.assertEqual(data['start'], 500)

    def test_athlete_sees_only_their_own(self):
        a, b = self.players[:2]
        user = User.objects.create_user('atleta@x.com', 'senha-forte-123', name='Atleta')
        Player.objects.filter(pk=a.pk).update(user=user)
        self.client.force_authenticate(user)
        with self.at(date(2026, 12, 20)):
            self.assertEqual(self.client.get(f'/api/players/{a.id}/elo-history/').status_code, 200)
            self.assertEqual(self.client.get(f'/api/players/{b.id}/elo-history/').status_code, 403)

    test_rollover_saves_standings_and_resets_elo = None
    test_editing_history_replays_the_season = None
    test_seasons_endpoint_shows_podium = None


class PlayerStatsTests(SeasonRolloverTests):
    """Perfil do atleta: sequência de vitórias na ordem certa e números da temporada separados da carreira."""

    def stats(self, player, day):
        with self.at(day):
            return self.client.get(f'/api/players/{player.id}/stats/').data

    def test_streak_follows_the_match_order_within_the_day(self):
        a, b, c, d = self.players
        day = date(2026, 10, 10)
        self.play(day, [a, b], [c, d])
        self.play(day, [a, b], [c, d])
        self.play(day, [c, d], [a, b])  # a última partida do dia foi derrota
        self.assertEqual(self.stats(a, date(2026, 10, 16))['win_streak'], 0)
        self.play(day + timedelta(days=1), [a, b], [c, d])
        self.assertEqual(self.stats(a, date(2026, 10, 16))['win_streak'], 1)

    def test_season_numbers_are_separate_from_career(self):
        a, b, c, d = self.players
        for i in range(3):
            self.play(date(2026, 11, 1) + timedelta(days=i), [a, b], [c, d])  # pré-temporada
        self.play(date(2027, 1, 5), [a, b], [c, d])
        self.play(date(2027, 1, 6), [c, d], [a, b])
        data = self.stats(a, date(2027, 1, 10))
        self.assertEqual(data['total_matches'], 5)  # carreira
        season = data['season']
        self.assertEqual((season['number'], season['matches'], season['wins'], season['win_rate']), (1, 2, 1, 50.0))
        self.assertEqual((season['fire_shark_min_games'], season['games_to_fire_shark']), (10, 8))
        self.assertIsNone(season['fire_shark_rank'])
        self.assertEqual(season['gladiator_rank'], 1)

    test_rollover_saves_standings_and_resets_elo = None
    test_editing_history_replays_the_season = None
    test_seasons_endpoint_shows_podium = None


class RankingLeaderAlertTests(TestCase):
    """O aviso de novo líder sai uma vez só, com o líder gravado no banco (vale para todos os containers)."""

    def setUp(self):
        for i in range(3):
            User.objects.create_user(f'atleta{i}@x.com', 'senha-forte-123', name=f'Atleta {i}')
        self.athletes = User.objects.filter(profile='player', is_active=True).count()
        self.ana = Player.objects.create(name='Ana', main_position='setter')
        self.bia = Player.objects.create(name='Bia', main_position='setter')
        for player in (self.ana, self.bia):
            player.wins, player.big_stars, player.mini_stars = 5, 1, 3

    def check(self, wins_leader, stars_leader=None):
        with mock.patch('apps.core.utils.ranking_monitor.wins_ranking') as wins, \
                mock.patch('apps.core.utils.ranking_monitor.stars_ranking') as stars:
            wins.return_value.first.return_value = wins_leader
            stars.return_value.first.return_value = stars_leader
            check_rank_changes()

    def alerts(self, ranking):
        return Notification.objects.filter(type='alert', title__endswith=ranking).count()

    def test_first_check_only_records_the_leaders(self):
        self.check(self.ana, self.ana)

        self.assertFalse(Notification.objects.exists())
        self.assertEqual(RankingLeader.objects.get(ranking='wins').player, self.ana)
        self.assertEqual(RankingLeader.objects.get(ranking='stars').player, self.ana)

    def test_new_leader_alerts_every_athlete_once(self):
        self.check(self.ana)
        self.check(self.bia)
        self.check(self.bia)

        self.assertEqual(self.alerts('Vitórias'), self.athletes)

    def test_leader_change_after_restart_still_alerts(self):
        self.check(self.ana)
        cache.clear()  # reinício do container: com o líder só na memória, essa troca passava sem aviso
        self.check(self.bia)

        self.assertEqual(self.alerts('Vitórias'), self.athletes)

    def test_each_ranking_has_its_own_leader(self):
        self.check(self.ana, self.ana)
        self.check(self.ana, self.bia)

        self.assertEqual(self.alerts('Vitórias'), 0)
        self.assertEqual(self.alerts('Estrelas'), self.athletes)
