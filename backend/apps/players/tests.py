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
