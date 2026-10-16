from django.test import TestCase
from rest_framework.test import APIClient

from apps.core.models import User
from .models import RegulationText

URL = '/api/hall-of-fame/regulation/'


class RegulationTextApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.player = User.objects.create_user('atleta@x.com', 'senha-forte-123', name='Atleta')
        self.moderator = User.objects.create_user(
            'mod@x.com', 'senha-forte-123', name='Mod', profile='moderator'
        )

    def test_authenticated_user_reads_regulation(self):
        self.client.force_authenticate(self.player)
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], 1)
        # Texto original migrado do frontend (migração 0003)
        self.assertIn('Apresentação', response.data['content'])
        self.assertIn('Faltas sem Justificativa', response.data['content'])

    def test_player_cannot_edit(self):
        self.client.force_authenticate(self.player)
        response = self.client.put(f'{URL}1/', {'title': 'X', 'content': '<p>x</p>'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_moderator_edits_singleton(self):
        self.client.force_authenticate(self.moderator)
        response = self.client.put(f'{URL}1/', {'title': 'Novo', 'content': '<p>regras</p>'}, format='json')
        self.assertEqual(response.status_code, 200)
        reg = RegulationText.objects.get()
        self.assertEqual((reg.pk, reg.content, reg.updated_by), (1, '<p>regras</p>', self.moderator))

    def test_content_is_required(self):
        self.client.force_authenticate(self.moderator)
        response = self.client.put(f'{URL}1/', {'title': 'Novo'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_delete_not_allowed(self):
        self.client.force_authenticate(self.moderator)
        self.assertEqual(self.client.delete(f'{URL}1/').status_code, 405)
