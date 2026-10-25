from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import User
from apps.notifications.models import Notification
from .identity import cpf_fingerprint, set_cpf
from .models import Player

WELCOME = 'Bem-vindo(a) ao Hellcife Vôlei! 🏐'


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', FRONTEND_URL='https://app.test')
class MakeMemberTests(TestCase):
    """Convidado vira membro com nome limpo, WhatsApp e, se tiver e-mail, convite para criar a senha."""

    def setUp(self):
        cache.clear()
        self.staff = User.objects.create_user('mod@x.com', 'senha-forte-123', name='Mod', profile='moderator')
        self.host = Player.objects.create(name='Beto', main_position='outside', gender='M')
        self.guest = Player.objects.create(
            name='Carla (Conv. de Beto)', main_position='libero', gender='F', is_guest=True, invited_by_player=self.host,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.staff)

    def make_member(self, **data):
        return self.client.post(f'/api/players/{self.guest.id}/make-member/', data, format='json')

    def test_guest_becomes_member_with_invite_and_welcome(self):
        response = self.make_member(phone='(81) 98877-6655', email='carla@x.com')

        self.assertEqual(response.status_code, 200)
        self.guest.refresh_from_db()
        self.assertEqual((self.guest.is_guest, self.guest.name, self.guest.phone, self.guest.status), (False, 'Carla', '81988776655', 'active'))
        user = self.guest.user
        self.assertFalse(user.has_usable_password())  # a pessoa cria a senha pelo convite
        self.assertTrue(Notification.objects.filter(user=user, title=WELCOME).exists())
        self.assertIn('/reset-password?uid=', mail.outbox[0].body)
        self.assertIn('convite=1', mail.outbox[0].body)
        self.assertTrue(response.data['invite_sent'])
        self.assertTrue(response.data['whatsapp_url'].startswith('https://wa.me/5581988776655?text='))
        self.assertIn('Fala, Carla!', response.data['welcome_text'])

    def test_without_email_still_becomes_member_and_gets_the_whatsapp_text(self):
        response = self.make_member(phone='81988776655')
        self.assertEqual(response.status_code, 200)
        self.guest.refresh_from_db()
        self.assertIsNone(self.guest.user)
        self.assertFalse(response.data['invite_sent'])
        self.assertIn('Peça à organização', response.data['welcome_text'])
        self.assertEqual(len(mail.outbox), 0)

    def test_whatsapp_is_required_and_email_must_be_free(self):
        self.assertIn('phone', self.make_member().data)
        self.assertIn('email', self.make_member(phone='81988776655', email='MOD@x.com').data)

    def test_only_staff_makes_members(self):
        athlete = User.objects.create_user('a@x.com', 'senha-forte-123', name='A', profile='player')
        self.client.force_authenticate(athlete)
        self.assertEqual(self.make_member(phone='81988776655').status_code, 403)


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', FRONTEND_URL='https://app.test')
class CreateAccessInviteTests(TestCase):
    def setUp(self):
        cache.clear()
        self.staff = User.objects.create_user('mod@x.com', 'senha-forte-123', name='Mod', profile='moderator')
        self.player = Player.objects.create(name='Duda', main_position='middle', gender='F', phone='81911112222')
        self.client = APIClient()
        self.client.force_authenticate(self.staff)

    def test_without_password_sends_an_invite(self):
        response = self.client.post(f'/api/players/{self.player.id}/create-access/', {'email': 'duda@x.com'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['invite_sent'])
        self.assertIsNone(response.data['password'])
        self.player.refresh_from_db()
        self.assertFalse(self.player.user.has_usable_password())
        self.assertIn('convite=1', mail.outbox[0].body)

    def test_with_password_works_as_before_and_still_welcomes(self):
        response = self.client.post(f'/api/players/{self.player.id}/create-access/', {'email': 'duda@x.com', 'password': 'senha-da-staff'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.player.refresh_from_db()
        self.assertTrue(self.player.user.check_password('senha-da-staff'))
        self.assertTrue(Notification.objects.filter(user=self.player.user, title=WELCOME).exists())


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', FRONTEND_URL='https://app.test')
class ExistingMemberSignupTests(TestCase):
    """Membro antigo sem conta que se cadastra pelo app: passa, e a aprovação já sugere ligar a ele."""

    def setUp(self):
        cache.clear()
        self.staff = User.objects.create_user('mod@x.com', 'senha-forte-123', name='Mod', profile='moderator')
        self.client = APIClient()

    def signup(self, **changes):
        return self.client.post('/api/auth/signup/', {
            'name': 'Mari', 'email': 'mari@x.com', 'password': 'quadra-de-areia-9', 'password_confirm': 'quadra-de-areia-9',
            'phone': '81999991234', 'gender': 'F', 'main_position': 'setter', 'accept_terms': True, 'cpf': '529.982.247-25', **changes,
        }, format='json')

    def test_same_whatsapp_as_an_old_member_without_account_is_a_claim(self):
        old = Player.objects.create(name='Mariana', main_position='setter', gender='F', phone='(81) 99999-1234')
        self.assertEqual(self.signup().status_code, 201)

        signup = Player.objects.get(user__email='mari@x.com')
        self.assertEqual(signup.claims_player, old)
        staff = APIClient()
        staff.force_authenticate(self.staff)
        row = staff.get('/api/players/signups/').data[0]
        self.assertEqual((row['claims_player'], row['claims_player_name']), (old.id, 'Mariana'))

        staff.post(f'/api/players/signups/{signup.id}/approve/', {'player_id': old.id}, format='json')
        old.refresh_from_db()
        self.assertEqual((old.user.email, old.cpf_hash), ('mari@x.com', cpf_fingerprint('52998224725')))

    def test_cpf_already_on_the_old_member_stays_there(self):
        old = Player.objects.create(name='Mariana', main_position='setter', gender='F')
        set_cpf(old, '52998224725')
        old.save()
        self.assertEqual(self.signup().status_code, 201)
        signup = Player.objects.get(user__email='mari@x.com')
        self.assertEqual((signup.claims_player, signup.cpf_hash), (old, None))

    def test_whatsapp_of_someone_with_account_is_still_refused(self):
        owner = User.objects.create_user('dono@x.com', 'senha-forte-123', name='Dono', profile='player')
        Player.objects.create(name='Dono', main_position='setter', gender='M', phone='81999991234', user=owner)
        self.assertIn('phone', self.signup().data)


class OnboardingTests(TestCase):
    """"Comece por aqui": para quem ganhou acesso há pouco, até completar ou dispensar."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user('novo@x.com', 'senha-forte-123', name='Novo', profile='player')
        self.player = Player.objects.create(name='Novo', main_position='outside', gender='M', user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def onboarding(self):
        return self.client.get('/api/players/me/').data['onboarding']

    def test_new_member_sees_the_steps_and_they_get_checked(self):
        self.assertEqual(self.onboarding(), {'complete_data': False, 'notifications': False, 'regulation': False, 'first_checkin': False})
        self.client.post('/api/players/me/regulation-seen/')
        self.assertTrue(self.onboarding()['regulation'])

    def test_dismissed_or_old_access_does_not_show(self):
        self.client.post('/api/players/me/dismiss-onboarding/')
        self.assertIsNone(self.onboarding())

        Player.objects.filter(pk=self.player.pk).update(onboarding_dismissed_at=None)
        User.objects.filter(pk=self.user.pk).update(date_joined=timezone.now() - timedelta(days=90))
        self.assertIsNone(self.onboarding())

    def test_other_people_never_see_it(self):
        other = User.objects.create_user('outro@x.com', 'senha-forte-123', name='Outro', profile='moderator')
        self.client.force_authenticate(other)
        self.assertIsNone(self.client.get(f'/api/players/{self.player.id}/').data['onboarding'])
