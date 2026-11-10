from datetime import date

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.core.models import User
from apps.evaluations.models import Evaluation
from apps.players.models import Player
from .models import Attendance, GameDay


class CheckinInfoLightTests(TestCase):
    """O check-in busca só as colunas que usa, sem uma consulta a mais por atleta."""

    def setUp(self):
        admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.client = APIClient()
        self.client.force_authenticate(admin)
        self.gameday = GameDay.objects.create(date=date.today())
        user = User.objects.create_user('ana@x.com', 'senha-forte-123', name='Ana')
        self.ana = Player.objects.create(name='Ana Maria', nickname='Ana', main_position='setter', user=user, avatar='avatars/ana.jpg')
        Evaluation.objects.create(player=self.ana, date=date.today(), attack=9)
        Attendance.objects.create(gameday=self.gameday, player=self.ana, present=True)
        self.guest = Player.objects.create(name='Convidada', main_position='libero', is_guest=True, invited_by='Ana')

    def get(self):
        return self.client.get(f'/api/attendance/gamedays/{self.gameday.id}/checkin-info/').data

    def test_same_data_as_before(self):
        rows = {p['id']: p for p in self.get()['players']}
        ana, guest = rows[self.ana.id], rows[self.guest.id]
        self.assertEqual((ana['name'], ana['main_position'], ana['present'], ana['has_account']), ('Ana', 'setter', True, True))
        self.assertTrue(ana['avatar_url'].endswith('avatars/ana.jpg'))
        self.assertEqual(ana['latest_overall'], round(Evaluation.objects.get().overall, 2))
        self.assertEqual((guest['is_guest'], guest['invited_by'], guest['has_account'], guest['avatar_url']), (True, 'Ana', False, None))

    def test_no_extra_query_per_athlete(self):
        with CaptureQueriesContext(connection) as before:
            self.get()
        for i in range(5):
            Player.objects.create(name=f'Extra {i}', nickname=f'X{i}', main_position='setter', avatar=f'avatars/{i}.jpg')
        with CaptureQueriesContext(connection) as after:
            data = self.get()
        self.assertEqual(len(after), len(before))
        self.assertEqual(len(data['players']), 7)
