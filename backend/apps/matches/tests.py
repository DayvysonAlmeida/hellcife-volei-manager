from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from apps.core.models import User
from apps.players.models import Player
from apps.teams.models import Team, TeamGeneration
from .models import Match, MatchPlayer


class SaveScoreTests(TestCase):
    """Salvar placar pela tela de pelada (/matches/quick/) e pelo formulário (/result/)."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.client.force_authenticate(self.admin)
        self.players = [Player.objects.create(name=f'P{i}', main_position='setter') for i in range(4)]
        self.gen = TeamGeneration.objects.create(modality=2, created_by=self.admin)
        self.red = Team.objects.create(generation=self.gen, name='Time Vermelho', color_hex='#f00', order=0)
        self.blue = Team.objects.create(generation=self.gen, name='Time Azul', color_hex='#00f', order=1)

    def teams_payload(self, borrowed_id=None):
        p = self.players
        return [
            {'team_id': self.red.id, 'team_name': 'Time Vermelho', 'color_hex': '#f00', 'score': 21,
             'player_ids': [p[0].id, p[1].id], 'mvp_ids': [p[0].id],
             'borrowed_ids': [borrowed_id] if borrowed_id else []},
            {'team_id': self.blue.id, 'team_name': 'Time Azul', 'color_hex': '#00f', 'score': 15,
             'player_ids': [p[2].id, p[3].id]},
        ]

    def test_quick_save_records_score_and_borrowed_player(self):
        """Antes falhava com 'NOT NULL constraint failed: matches_matchplayer.is_borrowed'."""
        response = self.client.post('/api/matches/quick/', {
            'match': {'date': str(date.today()), 'modality': 2, 'team_generation': self.gen.id},
            'teams': self.teams_payload(borrowed_id=self.players[1].id),
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)

        match = Match.objects.get()
        self.assertEqual(sorted(match.match_teams.values_list('score', 'winner')), [(15, False), (21, True)])
        borrowed = MatchPlayer.objects.get(match=match, player=self.players[1])
        self.assertTrue(borrowed.is_borrowed)
        self.assertFalse(MatchPlayer.objects.get(match=match, player=self.players[0]).is_borrowed)
        self.assertTrue(MatchPlayer.objects.get(match=match, player=self.players[0]).mvp)

        played = next(p for t in response.data['match_teams'] for p in t['match_players'] if p['player'] == self.players[1].id)
        self.assertTrue(played['is_borrowed'])

    def test_add_result_replaces_previous_result(self):
        match = Match.objects.create(date=date.today(), modality=2, created_by=self.admin)
        url = f'/api/matches/{match.id}/result/'
        self.assertEqual(self.client.post(url, {'teams': self.teams_payload()}, format='json').status_code, 200)
        self.assertEqual(self.client.post(url, {'teams': self.teams_payload(borrowed_id=self.players[0].id)}, format='json').status_code, 200)
        self.assertEqual(MatchPlayer.objects.filter(match=match).count(), 4)
        self.assertTrue(MatchPlayer.objects.get(match=match, player=self.players[0]).is_borrowed)
