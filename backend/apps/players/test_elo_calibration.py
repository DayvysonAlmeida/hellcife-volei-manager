from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from apps.core.models import User
from apps.matches.models import Match, MatchPlayer, MatchTeam
from .models import Player


class EloCalibrationTests(TestCase):
    """A faixa de Elo só aparece depois de 10 partidas na temporada, igual em todas as telas."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('ana@x.com', 'senha-forte-123', name='Ana')
        self.ana = Player.objects.create(name='Ana', main_position='setter', user=self.user)
        self.bia = Player.objects.create(name='Bia', main_position='setter')
        admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.admin = APIClient()
        self.admin.force_authenticate(admin)
        self.client.force_authenticate(self.user)

    def play(self, times):
        for _ in range(times):
            match = Match.objects.create(date=date.today(), modality=2)
            for won, p in ((True, self.ana), (False, self.bia)):
                MatchPlayer.objects.create(match=match, match_team=MatchTeam.objects.create(match=match, team_name='T', winner=won), player=p)

    def screens(self):
        listing = self.admin.get('/api/players/', {'page_size': 50}).data['results']
        return [
            next(p for p in listing if p['id'] == self.ana.id),           # lista de atletas (admin)
            self.admin.get(f'/api/players/{self.ana.id}/').data,          # perfil aberto pelo admin
            self.client.get('/api/players/me/').data,                     # o próprio atleta
        ]

    def test_new_athlete_is_calibrating_everywhere(self):
        self.play(9)
        for data in self.screens():
            self.assertEqual(data['elo_tier'], 'calibrating')
            self.assertIsNone(data['elo_tier_data'])
            self.assertEqual(data['elo_calibration'], {'calibrating': True, 'games': 9, 'needed': 10, 'missing': 1})

    def test_tier_appears_after_ten_games(self):
        self.play(10)
        for data in self.screens():
            self.assertNotEqual(data['elo_tier'], 'calibrating')
            self.assertIsNotNone(data['elo_tier_data'])
            self.assertFalse(data['elo_calibration']['calibrating'])
