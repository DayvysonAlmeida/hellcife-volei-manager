from datetime import date, timedelta

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.attendance.frequency import circuit_days, days_between
from apps.attendance.models import CourtCheckin, GameDay
from apps.core.models import User
from apps.evaluations.models import Evaluation
from apps.matches.models import Match, MatchPlayer, MatchTeam
from .models import Player
from .rankings import elo_top, fire_shark_ranking, season_stats
from .seasons import ensure_current_season

HEAVY_FIELDS = {'stats', 'elo_tier', 'elo_tier_data', 'elo_calibration'}


class LightPlayerListTests(TestCase):
    """?lite=1: telas que só escolhem atletas recebem o cadastro e a nota, sem as contas das partidas."""

    def setUp(self):
        admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.client = APIClient()
        self.client.force_authenticate(admin)
        self.athlete_user = User.objects.create_user('ana@x.com', 'senha-forte-123', name='Ana')
        self.ana = Player.objects.create(name='Ana', main_position='setter', user=self.athlete_user)
        self.bia = Player.objects.create(name='Bia', main_position='setter')
        Evaluation.objects.create(player=self.bia, date=date.today(), attack=9)
        self.play(3)

    def play(self, times):
        for _ in range(times):
            match = Match.objects.create(date=date.today(), modality=2)
            for won, p in ((True, self.ana), (False, self.bia)):
                MatchPlayer.objects.create(match=match, match_team=MatchTeam.objects.create(match=match, team_name='T', winner=won), player=p)

    def rows(self, client=None, **params):
        response = (client or self.client).get('/api/players/', {'page_size': 50, **params})
        return {p['id']: p for p in response.data['results']}

    def test_light_list_has_the_registration_and_the_grade(self):
        rows = self.rows(lite=1)
        self.assertEqual(set(rows), {self.ana.id, self.bia.id})
        self.assertFalse(HEAVY_FIELDS & set(rows[self.bia.id]))
        full = self.rows()[self.bia.id]
        self.assertEqual(rows[self.bia.id]['latest_overall'], full['latest_overall'])
        self.assertEqual(rows[self.bia.id]['display_name'], 'Bia')
        self.assertTrue(HEAVY_FIELDS <= set(full))  # sem o parâmetro, a lista completa continua igual

    def test_light_list_does_not_grow_with_matches(self):
        with CaptureQueriesContext(connection) as before:
            self.rows(lite=1)
        self.play(5)
        with CaptureQueriesContext(connection) as after:
            self.rows(lite=1)
        self.assertEqual(len(after), len(before))
        self.assertFalse(any('matches_matchplayer' in q['sql'] for q in after.captured_queries))

    def test_light_list_keeps_the_grade_private_for_athletes(self):
        athlete = APIClient()
        athlete.force_authenticate(self.athlete_user)
        rows = self.rows(client=athlete, lite=1)
        self.assertIsNone(rows[self.bia.id]['latest_overall'])  # a nota dos outros só a staff vê

    def test_full_list_computes_season_numbers_once(self):
        with CaptureQueriesContext(connection) as ctx:
            self.rows()
        # season_stats é a única consulta que parte da tabela de times da partida (placar de cada time)
        season_reads = [q for q in ctx.captured_queries if 'FROM "matches_matchteam"' in q['sql']]
        self.assertEqual(len(season_reads), 1)


class SeasonNumbersOnceTests(TestCase):
    """Passar as contas já feitas dá o mesmo resultado que refazer (Fire Shark, Elo e dias de circuito)."""

    def setUp(self):
        self.ana = Player.objects.create(name='Ana', main_position='setter')
        self.bia = Player.objects.create(name='Bia', main_position='setter')
        for days_ago in (1, 8):
            gameday = GameDay.objects.create(date=date.today() - timedelta(days=days_ago), is_published=True, is_closed=True)
            CourtCheckin.objects.create(gameday=gameday, player=self.ana)
        for _ in range(12):
            match = Match.objects.create(date=date.today(), modality=2)
            for won, p in ((True, self.ana), (False, self.bia)):
                MatchPlayer.objects.create(match=match, match_team=MatchTeam.objects.create(match=match, team_name='T', winner=won), player=p)

    def test_same_ranking_with_precomputed_numbers(self):
        season = ensure_current_season()
        stats = season_stats(season)
        days = days_between(circuit_days(), season.start_date, season.end_date)
        self.assertEqual(days, circuit_days(season.start_date, season.end_date))

        def summary(players):
            return [(p.id, p.fire_score, p.circuits) for p in players]

        self.assertEqual(summary(fire_shark_ranking(season, stats=stats, days=days)), summary(fire_shark_ranking(season)))
        self.assertEqual(elo_top(stats=stats), elo_top())
