from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from apps.core.models import User
from apps.players.models import Player, StarHistory
from .models import Evaluation, EvaluationHistory


class AuthorshipTests(TestCase):
    """Fica registrado quem avaliou e quem lançou cada estrela; o nome só aparece para a staff."""

    def setUp(self):
        self.moderator = User.objects.create_user('mod@x.com', 'senha-forte-123', name='Moderadora Ana', profile='moderator')
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin Beto', profile='admin')
        self.athlete = User.objects.create_user('mari@x.com', 'senha-forte-123', name='Mari', profile='player')
        self.mari = Player.objects.create(name='Mari', main_position='setter', gender='F', user=self.athlete)
        self.client = APIClient()

    def test_evaluation_records_the_evaluator_and_the_last_edit(self):
        self.client.force_authenticate(self.moderator)
        created = self.client.post('/api/evaluations/', {'player': self.mari.id, 'date': str(date.today()), 'attack': 8}, format='json')
        self.assertEqual(created.status_code, 201)

        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(f"/api/evaluations/{created.data['id']}/", {'attack': 9}, format='json').status_code, 200)

        row = self.client.get(f'/api/evaluations/by-player/{self.mari.id}/').data[0]
        self.assertEqual((row['evaluator_name'], row['evaluator_profile']), ('Moderadora Ana', 'moderator'))
        self.assertEqual(row['last_edit']['by'], 'Admin Beto')
        # a cópia guardada no histórico mantém quem avaliou
        self.assertEqual(EvaluationHistory.objects.get().previous_data['evaluator_name'], 'Moderadora Ana')

    def test_athlete_does_not_see_who_evaluated(self):
        Evaluation.objects.create(player=self.mari, evaluator=self.moderator, date=date.today())
        self.client.force_authenticate(self.athlete)

        row = self.client.get(f'/api/evaluations/by-player/{self.mari.id}/').data[0]
        self.assertEqual((row['evaluator'], row['evaluator_name'], row['last_edit']), (None, None, None))

    def test_star_history_records_who_gave_and_removed(self):
        self.client.force_authenticate(self.moderator)
        self.client.patch(f'/api/players/{self.mari.id}/update_stars/', {'attack_stars': 2}, format='json')
        self.client.force_authenticate(self.admin)
        self.client.patch(f'/api/players/{self.mari.id}/update_stars/', {'attack_stars': 1}, format='json')
        StarHistory.objects.create(player=self.mari, category='mvp', action='add')  # lançamento antigo, sem autor

        rows = self.client.get('/api/players/stars-history/').data
        self.assertEqual(
            [(r['action'], r['count'], r['given_by_name']) for r in rows],
            [('add', 1, None), ('remove', 1, 'Admin Beto'), ('add', 2, 'Moderadora Ana')],
        )
        self.assertEqual(rows[1]['given_by_profile'], 'admin')

        self.client.force_authenticate(self.athlete)
        self.assertTrue(all(r['given_by_name'] is None for r in self.client.get('/api/players/stars-history/').data))
