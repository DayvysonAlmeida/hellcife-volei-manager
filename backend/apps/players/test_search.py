from rest_framework.test import APIClient

from apps.core.models import User
from apps.core.testing import CacheIsolatedTestCase as TestCase
from .models import Player


class PlayerSearchTests(TestCase):
    """Busca da tela de atletas: sem acento, camisa exata, WhatsApp e nome civil só para a staff."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')
        self.athlete = User.objects.create_user('atleta@x.com', 'senha-forte-123', name='Atleta')
        carla_user = User.objects.create_user('carla@x.com', 'senha-forte-123', name='Carla')
        create = lambda name, **kw: Player.objects.create(name=name, main_position='setter', **kw)
        create('João Pedro', nickname='Jota', legal_name='João Pedro Albuquerque', shirt_number=12, phone='(81) 99999-1234')
        create('Maria', shirt_number=1, gender='F')
        create('Carla', shirt_number=10, gender='F', user=carla_user)
        create('Visitante', is_guest=True, invited_by='Ângela')

    def found(self, user=None, **params):
        self.client.force_authenticate(user or self.admin)
        response = self.client.get('/api/players/', {'include_guests': 'true', **params})
        self.assertEqual(response.status_code, 200, response.data)
        return {p['name'] for p in response.data['results']}

    def test_ignores_accents_and_case(self):
        self.assertEqual(self.found(search='joao'), {'João Pedro'})
        self.assertEqual(self.found(search='JOÃO'), {'João Pedro'})
        self.assertEqual(self.found(search='jota'), {'João Pedro'})

    def test_shirt_number_is_exact(self):
        self.assertEqual(self.found(search='1'), {'Maria'})
        self.assertEqual(self.found(search='#12'), {'João Pedro'})

    def test_every_word_must_match_some_field(self):
        self.assertEqual(self.found(search='joao albuquerque'), {'João Pedro'})
        self.assertEqual(self.found(search='joao maria'), set())

    def test_guest_found_by_who_invited(self):
        self.assertEqual(self.found(search='angela'), {'Visitante'})

    def test_staff_finds_by_legal_name_email_and_whatsapp(self):
        self.assertEqual(self.found(search='albuquerque'), {'João Pedro'})
        self.assertEqual(self.found(search='carla@x'), {'Carla'})
        self.assertEqual(self.found(search='+55 81 99999-1234'), {'João Pedro'})
        self.assertEqual(self.found(search='1234'), {'João Pedro'})

    def test_athletes_cannot_search_private_fields(self):
        for term in ('albuquerque', 'carla@x', '99999-1234', '1234'):
            self.assertEqual(self.found(self.athlete, search=term), set(), term)
        self.assertEqual(self.found(self.athlete, search='joao'), {'João Pedro'})

    def test_gender_and_app_account_filters(self):
        self.assertEqual(self.found(gender='F'), {'Maria', 'Carla'})
        self.assertEqual(self.found(has_account='true'), {'Carla'})
        self.assertEqual(self.found(has_account='false', is_guest='false'), {'João Pedro', 'Maria'})
