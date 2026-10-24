from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.core.models import User
from .models import Player

ME = '/api/players/me/'
# GIF de 1 pixel: basta para o upload ser uma imagem de verdade
GIF = b'GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
IN_MEMORY = {**settings.STORAGES, 'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'}}


class MyProfileTests(TestCase):
    """O atleta edita os próprios dados; o que mexe no jogo (posições, camisa, estrelas, Elo, status) fica com a staff."""

    def setUp(self):
        self.user = User.objects.create_user('mari@x.com', 'quadra-de-areia-9', name='Mari', profile='player')
        self.player = Player.objects.create(
            name='Mari', legal_name='Mariana Souza', main_position='setter', gender='F', user=self.user,
            shirt_number=7, mvp_stars=2, elo=612,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_athlete_edits_the_allowed_fields(self):
        response = self.client.patch(ME, {
            'name': '  Mari Souza ', 'nickname': 'Mazinha', 'gender': 'NB', 'phone': '(81) 98888-7777',
            'instagram': '@mari.volei', 'age': 29, 'height': '1.68', 'weight': '61.5', 'dominant_hand': 'left',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Mari Souza')
        self.player.refresh_from_db()
        self.assertEqual(
            (self.player.nickname, self.player.gender, self.player.phone, self.player.instagram, self.player.dominant_hand),
            ('Mazinha', 'NB', '81988887777', 'mari.volei', 'left'),
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.name, 'Mari Souza')  # o nome do login acompanha o nome social

    def test_fields_owned_by_the_staff_are_ignored(self):
        response = self.client.patch(ME, {
            'main_position': 'opposite', 'secondary_position': 'libero', 'shirt_number': 10, 'status': 'inactive',
            'mvp_stars': 5, 'elo': 1500, 'standalone_credits': 9, 'notes': 'oi', 'user': None, 'nickname': 'Mazinha',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.player.refresh_from_db()
        self.assertEqual(
            (self.player.main_position, self.player.secondary_position, self.player.shirt_number, self.player.status,
             self.player.mvp_stars, self.player.elo, self.player.standalone_credits, self.player.user_id),
            ('setter', None, 7, 'active', 2, 612, 0, self.user.id),
        )
        self.assertEqual(self.player.nickname, 'Mazinha')

    def test_invalid_values_are_rejected(self):
        response = self.client.patch(ME, {'name': ' ', 'phone': '1234', 'gender': 'X', 'height': '3.10'}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {'name', 'phone', 'gender', 'height'})

    def test_athlete_sees_its_own_legal_name_but_not_others(self):
        other = Player.objects.create(name='Bia', legal_name='Beatriz Lima', main_position='libero')

        self.assertEqual(self.client.get(ME).data['legal_name'], 'Mariana Souza')
        self.assertIsNone(self.client.get(f'/api/players/{other.id}/').data['legal_name'])

    @override_settings(STORAGES=IN_MEMORY)
    def test_photo_upload_only_accepts_images_and_can_be_removed(self):
        not_image = SimpleUploadedFile('a.txt', b'oi', content_type='text/plain')
        self.assertEqual(self.client.patch(ME, {'avatar': not_image}, format='multipart').status_code, 400)

        photo = SimpleUploadedFile('eu.gif', GIF, content_type='image/gif')
        response = self.client.patch(ME, {'avatar': photo}, format='multipart')
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data['avatar_url'])

        response = self.client.patch(ME, {'remove_avatar': True}, format='json')
        self.assertIsNone(response.data['avatar_url'])

    def test_user_without_athlete_profile_gets_404(self):
        staff = User.objects.create_user('staff@x.com', 'senha-forte-123', name='Staff', profile='admin')
        self.client.force_authenticate(staff)

        self.assertEqual(self.client.patch(ME, {'nickname': 'x'}, format='json').status_code, 404)


class ChangePasswordTests(TestCase):
    """Troca de senha de quem já está logado: confere a senha atual e exige 8 caracteres."""

    def setUp(self):
        self.user = User.objects.create_user('mari@x.com', 'quadra-de-areia-9', name='Mari', profile='player')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def change(self, old='quadra-de-areia-9', new='rede-alta-2026', confirm=None):
        return self.client.post('/api/auth/change-password/', {
            'old_password': old, 'new_password': new, 'new_password_confirm': confirm or new,
        }, format='json')

    def test_changes_the_password(self):
        self.assertEqual(self.change().status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('rede-alta-2026'))

    def test_rejects_wrong_current_password_short_or_mismatched_new_password(self):
        self.assertIn('old_password', self.change(old='errada-123').data)
        self.assertIn('new_password', self.change(new='curta').data)
        self.assertIn('new_password_confirm', self.change(confirm='outra-senha-99').data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('quadra-de-areia-9'))

    def test_requires_login(self):
        self.assertEqual(APIClient().post('/api/auth/change-password/', {}, format='json').status_code, 401)
