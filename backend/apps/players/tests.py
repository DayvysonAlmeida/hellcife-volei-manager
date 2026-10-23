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


from datetime import datetime  # noqa: E402

from django.utils import timezone  # noqa: E402

from apps.attendance.models import CourtCheckin, GameDay  # noqa: E402
from .rankings import fire_shark_entry  # noqa: E402


class FireSharkScoreTests(SeasonRolloverTests):
    """Fire Shark: nota = 60% aproveitamento + 20% jogos + 20% presença na quadra, e a ordem segue a nota."""

    def setUp(self):
        super().setUp()
        # Os dias com circuito contam a partir do cadastro do atleta
        Player.objects.update(created_at=timezone.make_aware(datetime(2026, 1, 1)))

    def circuit(self, day, *went):
        gd = GameDay.objects.create(date=day, is_closed=True, is_published=True)
        for p in went:
            CourtCheckin.objects.create(gameday=gd, player=p)

    def test_presence_weighs_in_the_score(self):
        a, b, c, d = self.players
        with self.at(date(2026, 12, 20)):
            for _ in range(10):
                self.play(date(2026, 11, 1), [a, b], [c, d])
            self.circuit(date(2026, 11, 1), a, b, c)
            for i in range(1, 4):
                self.circuit(date(2026, 11, 1) + timedelta(days=i), a, c)
            rows = [fire_shark_entry(p) for p in fire_shark_ranking()]
        self.assertEqual([r['id'] for r in rows], [a.id, b.id, c.id, d.id])
        # a: 60 (100% de vitórias) + 20 (jogos) + 20 (4 de 4 dias); b foi a 1 dia só
        self.assertEqual([r['score'] for r in rows], [100.0, 85.0, 40.0, 20.0])
        self.assertEqual((rows[1]['attended_days'], rows[1]['total_days']), (1, 4))

    def test_games_and_presence_can_beat_a_higher_win_rate(self):
        a, b, c, d = self.players
        with self.at(date(2026, 12, 20)):
            for _ in range(10):
                self.play(date(2026, 11, 1), [a], [d])  # a: 10 de 10, mas jogou pouco e não foi aos circuitos
            for i in range(30):
                self.play(date(2026, 11, 1), *([[b], [c]] if i < 18 else [[c], [b]]))  # b: 18 de 30
            self.circuit(date(2026, 11, 1), b, c)
            self.circuit(date(2026, 11, 2), b, c)
            data = self.client.get('/api/players/dashboard-stats/').data
        rows = data['fire_sharks']
        self.assertEqual([r['id'] for r in rows], [b.id, a.id, c.id, d.id])
        self.assertEqual([r['score'] for r in rows], [76.0, 66.7, 64.0, 6.7])  # a ordem é a da nota mostrada
        self.assertEqual(data['season']['fire_shark_weights'], {'win_rate': 60, 'games': 20, 'presence': 20})

    def test_profile_shows_the_score_and_what_each_thing_is_worth(self):
        a, b, c, d = self.players
        with self.at(date(2026, 12, 20)):
            for _ in range(10):
                self.play(date(2026, 11, 1), [a, b], [c, d])
            self.circuit(date(2026, 11, 1), a, b, c, d)
            self.circuit(date(2026, 11, 2), a)
            season = self.client.get(f'/api/players/{b.id}/stats/').data['season']
        self.assertEqual(season['fire_score'], 90.0)  # 60 + 20 + 10 (1 de 2 dias)
        self.assertEqual(season['fire_points'], {'win_rate': 60.0, 'games': 20.0, 'presence': 10.0})
        # Ir ao próximo: 2 de 3 dias (+3.3). Faltar: 1 de 3 (−3.3). Vitória: já tem 100% e é quem mais jogou.
        self.assertEqual(season['fire_gains'], {'attend': 3.3, 'miss': -3.3, 'win': 0.0})

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


# ─── Fire Shark: fórmula nova (a partir da Temporada 1) ──────────────────────

from apps.attendance.models import Attendance  # noqa: E402
from apps.teams.models import Team, TeamGeneration  # noqa: E402
from .rankings import FIRE_SHARK_FORMULAS, fire_shark_pending, fire_shark_table  # noqa: E402


class FireSharkNewRulesTests(SeasonRolloverTests):
    """
    Fórmula nova: 50 × V/J + 30 × mín(circuitos ÷ 16, 1) + 20 × mín(partidas ÷ 60, 1).
    Todos aparecem; disputa o título quem tem 20 partidas, 8 circuitos e 3 meses na temporada.
    """

    DAY = date(2027, 6, 20)   # Temporada 1

    def setUp(self):
        super().setUp()
        self.players = list(Player.objects.order_by('name'))

    def table(self, **changes):
        rows = fire_shark_table(formula={**FIRE_SHARK_FORMULAS['nova'], **changes})
        return {p.id: p for p in rows}, [p.id for p in rows if p.fire_eligible]

    def circuit(self, day, *went, published=True):
        gd = GameDay.objects.create(date=day, is_closed=True, is_published=published)
        for p in went:
            CourtCheckin.objects.create(gameday=gd, player=p)
        return gd

    def circuits(self, count, *went, first=0):
        """Circuitos a cada 10 dias a partir de 10/jan (8 deles cobrem jan, fev e mar)."""
        return [self.circuit(date(2027, 1, 10) + timedelta(days=10 * i), *went) for i in range(first, first + count)]

    def series(self, winner, loser, wins, total, day=date(2027, 2, 1)):
        for i in range(total):
            self.play(day, *([[winner], [loser]] if i < wins else [[loser], [winner]]))

    def test_points_follow_the_formula(self):
        """Casos 1 e 2: poucas partidas rendem pouca regularidade; muitas rendem os 20 pontos."""
        a, b, c, d = self.players
        with self.at(self.DAY):
            self.series(a, d, 20, 20)   # a: 20 de 20
            self.series(b, c, 36, 60)   # b: 36 de 60
            self.circuits(8, a, b, c, d)
            rows, ranked = self.table()
        entries = {pid: fire_shark_entry(rows[pid]) for pid in ranked}
        self.assertEqual(entries[a.id]['points'], {'win_rate': 50.0, 'presence': 15.0, 'games': 6.7})
        self.assertEqual(entries[b.id]['points'], {'win_rate': 30.0, 'presence': 15.0, 'games': 20.0})
        self.assertEqual([entries[pid]['score'] for pid in ranked], [71.7, 65.0, 55.0, 21.7])

    def test_checkin_counts_even_without_games_that_day(self):
        """Casos 3 e 4: o check-in vale a presença, mesmo sem jogar naquele circuito."""
        a, b, c, d = self.players
        with self.at(self.DAY):
            self.series(a, b, 10, 20)   # as partidas foram num dia sem circuito
            self.circuits(12, a)
            rows, _ = self.table()
        self.assertEqual(rows[a.id].attended_days, 12)
        self.assertEqual(rows[a.id].fire_points['presence'], 22.5)

    def test_nobody_loses_points_for_a_break(self):
        """Ficar um tempo sem ir: outros circuitos e outras partidas não tiram pontos de quem parou."""
        a, b, c, d = self.players
        with self.at(self.DAY):
            self.series(a, b, 15, 30)
            self.circuits(8, a, b)
            before, _ = self.table()
            self.circuits(6, b, first=8)                       # a sumiu por dois meses
            self.series(b, c, 40, 50, day=date(2027, 4, 1))   # e os outros jogaram muito
            after, _ = self.table()
        self.assertEqual(after[a.id].fire_score_exact, before[a.id].fire_score_exact)

    def test_athlete_who_joined_mid_season(self):
        """Caso 5: os circuitos de antes da chegada não pesam; vale o que ele frequentou."""
        a, b, c, d = self.players
        with self.at(self.DAY):
            self.series(d, c, 10, 20, day=date(2027, 3, 1))
            Player.objects.filter(pk=d.pk).update(created_at=timezone.make_aware(datetime(2027, 2, 15)))
            self.circuits(4, a, c)
            self.circuits(8, a, c, d, first=4)
            rows, ranked = self.table()
        self.assertEqual(rows[d.id].attended_days, 8)
        self.assertEqual(rows[d.id].fire_points['presence'], 15.0)
        self.assertIn(d.id, ranked)

    def test_justified_absence_neither_counts_nor_costs(self):
        """Caso 6: falta justificada não dá presença e, como nada é porcentagem, também não tira."""
        a, b, c, d = self.players
        with self.at(self.DAY):
            self.series(a, b, 10, 20)
            days = self.circuits(4, b)
            for gd in days[:3]:
                CourtCheckin.objects.create(gameday=gd, player=a)
            Attendance.objects.create(gameday=days[3], player=a, is_justified=True)
            rows, _ = self.table()
        self.assertEqual(rows[a.id].attended_days, 3)

    def test_unpublished_or_cancelled_circuit_does_not_count(self):
        """Caso 7: circuito não publicado ou sem ninguém na quadra (cancelado) não conta."""
        a, b, c, d = self.players
        with self.at(self.DAY):
            self.series(a, b, 10, 20)
            self.circuits(2, a, b)
            self.circuit(date(2027, 5, 1), a, b, published=False)
            self.circuit(date(2027, 5, 2))
            rows, _ = self.table()
        self.assertEqual(rows[a.id].attended_days, 2)

    def test_title_requirements_and_one_circuit_marathon(self):
        """Casos 8 e 9: todos aparecem; quem não cumpre os requisitos vê o que falta e não disputa o título."""
        a, b, c, d = self.players
        with self.at(self.DAY):
            self.series(a, d, 10, 19)                          # a: 19 partidas
            self.series(d, a, 0, 1)
            marathon = self.circuit(date(2027, 5, 15), b)      # b: 40 partidas num circuito só
            self.series(b, c, 24, 40, day=date(2027, 5, 15))
            self.circuits(8, a, d)
            for i in range(8):                                 # c: 8 circuitos, todos em janeiro
                self.circuit(date(2027, 1, 2) + timedelta(days=i), c)
            self.series(c, b, 20, 20, day=date(2027, 1, 2))
            rows, ranked = self.table()
            pending = [p.id for p in fire_shark_pending()]
        self.assertEqual(rows[a.id].fire_missing, {'games': 0, 'circuits': 0, 'months': 0})
        self.assertEqual(rows[b.id].fire_missing, {'games': 0, 'circuits': 7, 'months': 1})  # mai + jan (jogou com c)
        self.assertEqual(rows[c.id].fire_missing, {'games': 0, 'circuits': 0, 'months': 1})  # jan + mai (jogou com b)
        self.assertEqual(sorted(ranked), sorted([a.id, d.id]))
        self.assertEqual(sorted(pending), sorted([b.id, c.id]))
        self.assertTrue(marathon.court_checkins.filter(player=b).exists())

    def test_ties_follow_win_rate_circuits_and_name(self):
        """Caso 10: mesma nota e mesmo aproveitamento; decide quem foi a mais circuitos, depois o nome."""
        a, b, c, d = self.players
        with self.at(self.DAY):
            self.series(a, c, 10, 20)   # a e c: 50% em 20 partidas, 13 circuitos
            self.series(b, d, 20, 40)   # b e d: 50% em 40 partidas, 8 circuitos
            self.circuits(8, a, b, c, d)
            self.circuits(5, a, c, first=8)
            rows, ranked = self.table(games_target=40, circuits_target=15)
        # 25 + 26 + 10 = 25 + 16 + 20 = 61 para os quatro
        self.assertEqual(len({rows[p].fire_score_exact for p in ranked}), 1)
        self.assertEqual(ranked, [a.id, c.id, b.id, d.id])

    def test_rules_change_with_the_season(self):
        """Caso 11: a pré-temporada segue a fórmula de antes; a Temporada 1 usa a nova, sem misturar resultados."""
        a, b, c, d = self.players
        self.series(a, b, 30, 30, day=date(2026, 10, 1))
        self.series(b, a, 10, 10, day=date(2027, 1, 10))
        self.circuit(date(2026, 10, 1), a, b)
        self.circuit(date(2027, 1, 10), a, b)
        with self.at(date(2026, 12, 20)):
            pre = self.client.get('/api/players/dashboard-stats/').data['season']['fire_shark_rules']
        with self.at(date(2027, 2, 1)):
            season_1 = self.client.get('/api/players/dashboard-stats/').data['season']['fire_shark_rules']
            rows = {p.id: p for p in fire_shark_table()}
        self.assertEqual((pre['mode'], season_1['mode']), ('atual', 'nova'))
        self.assertEqual(season_1['title'], {'games': 20, 'circuits': 8, 'months': 3})
        self.assertEqual((rows[a.id].wins, rows[a.id].total_matches, rows[a.id].attended_days), (0, 10, 1))

    def test_duplicated_corrected_and_deleted_matches(self):
        """Caso 12: jogo da fila salvo duas vezes conta uma; corrigir ou apagar a partida recalcula a nota."""
        a, b, c, d = self.players
        gen = TeamGeneration.objects.create(modality=2, created_by=self.admin)
        red = Team.objects.create(generation=gen, name='Vermelho', color_hex='#f00', order=0)
        blue = Team.objects.create(generation=gen, name='Azul', color_hex='#00f', order=1)

        def teams(red_score, blue_score):
            return [
                {'team_id': red.id, 'team_name': 'Vermelho', 'color_hex': '#f00', 'score': red_score, 'player_ids': [a.id, b.id]},
                {'team_id': blue.id, 'team_name': 'Azul', 'color_hex': '#00f', 'score': blue_score, 'player_ids': [c.id, d.id]},
            ]

        with self.at(self.DAY):
            payload = {
                'match': {'date': '2027-03-01', 'modality': 2, 'team_generation': gen.id},
                'teams': teams(21, 15), 'bracket_key': f'{gen.id}:1',
            }
            match_id = self.client.post('/api/matches/quick/', payload, format='json').data['id']
            self.client.post('/api/matches/quick/', payload, format='json')  # o outro celular salvando o mesmo jogo
            rows, _ = self.table()
            self.assertEqual((rows[a.id].wins, rows[a.id].total_matches), (1, 1))

            self.client.post(f'/api/matches/{match_id}/result/', {'teams': teams(15, 21)}, format='json')  # placar corrigido
            rows, _ = self.table()
            self.assertEqual((rows[a.id].wins, rows[c.id].wins), (0, 1))

            self.client.delete(f'/api/matches/{match_id}/')
            rows, _ = self.table()
            self.assertNotIn(a.id, rows)

    def test_without_matches_or_without_circuits(self):
        """Caso 13: sem partidas não aparece; sem circuitos, a presença vale 0 e falta para o título."""
        a, b, c, d = self.players
        with self.at(self.DAY):
            self.series(a, b, 15, 30)
            rows, ranked = self.table()
        self.assertNotIn(c.id, rows)
        self.assertEqual(ranked, [])
        self.assertEqual(rows[a.id].fire_points, {'win_rate': 25.0, 'presence': 0.0, 'games': 10.0})
        self.assertEqual(rows[a.id].fire_missing['circuits'], 8)

    def test_score_always_between_0_and_100(self):
        """Caso 14: o melhor caso possível dá 100 e ninguém fica abaixo de 0."""
        a, b, c, d = self.players
        with self.at(self.DAY):
            self.series(a, d, 60, 60)
            self.circuits(16, a, d)
            rows, _ = self.table()
        self.assertEqual(rows[a.id].fire_score_exact, 100)
        self.assertEqual(rows[d.id].fire_score_exact, 50)   # 0 vitórias: só presença e regularidade
        self.assertTrue(all(0 <= p.fire_score <= 100 for p in rows.values()))

    def test_screens_show_title_race_and_who_is_still_qualifying(self):
        a, b, c, d = self.players
        with self.at(self.DAY):
            self.series(a, d, 20, 20)
            self.series(b, c, 25, 25)
            self.circuits(8, a, d)
            self.circuit(date(2027, 5, 1), b, c)
            data = self.client.get('/api/players/dashboard-stats/').data
            mine = self.client.get(f'/api/players/{b.id}/stats/').data['season']
        self.assertEqual([r['id'] for r in data['fire_sharks']], [a.id, d.id])
        self.assertEqual([r['id'] for r in data['fire_sharks_pending']], [b.id, c.id])
        self.assertEqual(data['fire_sharks_pending'][0]['missing'], {'games': 0, 'circuits': 7, 'months': 1})  # fev + mai
        self.assertIsNone(mine['fire_shark_rank'])
        self.assertEqual((mine['fire_score'], mine['fire_circuits'], mine['fire_months']), (60.2, 1, 2))  # 50 + 1,9 + 8,3
        self.assertEqual(mine['fire_gains']['miss'], 0.0)   # faltar não tira pontos

    test_rollover_saves_standings_and_resets_elo = None
    test_editing_history_replays_the_season = None
    test_seasons_endpoint_shows_podium = None


class FireSharkPreviewApiTests(FireSharkNewRulesTests):
    """Prévia do admin: só admin e moderador; dá para testar as metas antes de valerem."""

    def test_only_admins_see_the_preview(self):
        athlete = User.objects.create_user('atleta@x.com', 'senha-forte-123', name='Atleta', profile='player')
        self.client.force_authenticate(athlete)
        self.assertEqual(self.client.get('/api/players/fire-shark-preview/').status_code, 403)

    def test_preview_compares_positions_and_accepts_targets(self):
        a, b, c, d = self.players
        with self.at(date(2026, 12, 20)):   # pré-temporada: compara a fórmula de hoje com a nova
            self.series(a, d, 20, 20, day=date(2026, 9, 1))
            self.series(b, c, 18, 30, day=date(2026, 10, 1))
            for i in range(8):
                self.circuit(date(2026, 9, 1) + timedelta(days=10 * i), a, b, c, d)
            data = self.client.get('/api/players/fire-shark-preview/', {'partidas': 20, 'circuitos': 8}).data
            bad = self.client.get('/api/players/fire-shark-preview/', {'circuitos': 'abc'})
        self.assertEqual(bad.status_code, 400)
        self.assertEqual((data['formula']['games_target'], data['formula']['circuits_target']), (20, 8))
        row = next(r for r in data['rows'] if r['id'] == a.id)
        self.assertEqual((row['position'], row['current_position'], row['score']), (1, 1, 100.0))
        self.assertEqual(sum(band['count'] for band in data['scores']['bands']), 4)

    test_points_follow_the_formula = None
    test_checkin_counts_even_without_games_that_day = None
    test_nobody_loses_points_for_a_break = None
    test_athlete_who_joined_mid_season = None
    test_justified_absence_neither_counts_nor_costs = None
    test_unpublished_or_cancelled_circuit_does_not_count = None
    test_title_requirements_and_one_circuit_marathon = None
    test_ties_follow_win_rate_circuits_and_name = None
    test_rules_change_with_the_season = None
    test_duplicated_corrected_and_deleted_matches = None
    test_without_matches_or_without_circuits = None
    test_score_always_between_0_and_100 = None
    test_screens_show_title_race_and_who_is_still_qualifying = None


class SeasonValidationTests(SeasonRolloverTests):
    """Fechamento: o resultado fica provisório até a organização validar; recalcular pede validação de novo."""

    def test_podium_only_after_validation(self):
        a, b, c, d = self.players
        for i in range(12):
            self.play(date(2026, 11, 1) + timedelta(days=i), [a, b], [c, d])
        athlete = User.objects.create_user('atleta@x.com', 'senha-forte-123', name='Atleta', profile='player')
        with self.at(date(2027, 1, 3)):
            admin_view = self.client.get('/api/players/seasons/').data['past'][0]
            self.client.force_authenticate(athlete)
            before = self.client.get('/api/players/seasons/').data['past'][0]
            self.assertEqual(self.client.post('/api/players/seasons/0/validate/').status_code, 403)

            self.client.force_authenticate(self.admin)
            self.assertEqual(self.client.post('/api/players/seasons/0/validate/').status_code, 200)
            self.client.force_authenticate(athlete)
            after = self.client.get('/api/players/seasons/').data['past'][0]

            self.client.force_authenticate(self.admin)
            self.client.post('/api/players/seasons/0/recalculate/')
            recalculated = self.client.get('/api/players/seasons/').data['past'][0]
            missing = self.client.post('/api/players/seasons/1/validate/')
        self.assertFalse(admin_view['validated'])
        self.assertEqual(len(admin_view['podium']['gladiator']), 3)   # o admin confere antes de validar
        self.assertEqual(before['podium']['gladiator'], [])
        self.assertTrue(after['validated'])
        self.assertEqual(after['podium']['gladiator'][0]['wins'], 12)
        self.assertFalse(recalculated['validated'])
        self.assertEqual(missing.status_code, 404)   # a Temporada 1 ainda não terminou

    test_rollover_saves_standings_and_resets_elo = None
    test_editing_history_replays_the_season = None
    test_seasons_endpoint_shows_podium = None
