from datetime import timedelta
from unittest import mock

from django.core import mail, signing
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.core.models import User
from apps.notifications.models import Notification
from .models import Player
from .rankings import ranked_players
from .signup import CONFIRM_SALT, confirmation_token

AUTH = '/api/auth'


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', FRONTEND_URL='https://app.test')
class SignupFlowTests(TestCase):
    """Cadastro pelo app: confirmar o e-mail, aguardar a staff e só então entrar nas listas."""

    def setUp(self):
        cache.clear()  # zera o limite de tentativas entre os testes
        self.client = APIClient()
        self.admin = User.objects.create_user('admin@x.com', 'senha-forte-123', name='Admin', profile='admin')

    def signup(self, **changes):
        data = {
            'name': 'Mari', 'legal_name': 'Mariana Souza', 'email': 'Mari@Exemplo.com', 'password': 'quadra-de-areia-9',
            'password_confirm': 'quadra-de-areia-9', 'phone': '(81) 99999-1234', 'gender': 'F',
            'main_position': 'setter', 'accept_terms': True, 'cpf': '529.982.247-25', **changes,
        }
        return self.client.post(f'{AUTH}/signup/', data, format='json')

    def link_token(self):
        body = mail.outbox[-1].body
        return body.split('confirmar-email?token=')[1].split()[0]

    def login(self, password='quadra-de-areia-9'):
        return self.client.post(f'{AUTH}/login/', {'email': 'mari@exemplo.com', 'password': password}, format='json')

    def test_signup_creates_a_pending_athlete_and_sends_the_link(self):
        response = self.signup()
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email='mari@exemplo.com')
        player = user.player_profile
        self.assertEqual((user.email_confirmed, player.status, player.name, player.legal_name), (False, 'pending', 'Mari', 'Mariana Souza'))
        self.assertIsNotNone(player.terms_accepted_at)
        self.assertEqual(player.phone, '81999991234')
        self.assertIn('https://app.test/confirmar-email?token=', mail.outbox[0].body)
        self.assertNotIn(player.id, [p.id for p in ranked_players()])  # fora de rankings, listas e sorteio

    def test_login_waits_for_the_email_confirmation(self):
        self.signup()
        blocked = self.login()
        self.assertEqual((blocked.status_code, blocked.data['code']), (403, 'email_not_confirmed'))
        self.assertEqual(self.login(password='errada-123').status_code, 401)  # senha errada não revela nada

        confirmed = self.client.post(f'{AUTH}/confirm-email/', {'token': self.link_token()}, format='json')
        self.assertEqual(confirmed.status_code, 200)
        self.assertEqual(self.login().status_code, 200)
        staff = Notification.objects.get(user=self.admin)
        self.assertEqual((staff.title, staff.url), ('Novo cadastro 🙋', '/players?aba=pendentes'))

    def test_link_used_twice_expired_or_tampered_does_not_work(self):
        self.signup()
        token = self.link_token()
        self.client.post(f'{AUTH}/confirm-email/', {'token': token}, format='json')
        self.assertEqual(self.client.post(f'{AUTH}/confirm-email/', {'token': token}, format='json').data['code'], 'used')
        self.assertEqual(self.client.post(f'{AUTH}/confirm-email/', {'token': token + 'x'}, format='json').data['code'], 'invalid')

        user = User.objects.get(email='mari@exemplo.com')
        user.email_confirmed = False
        user.save()
        old_link = confirmation_token(user)
        with mock.patch('django.core.signing.time.time', return_value=signing.time.time() + timedelta(hours=49).total_seconds()):
            expired = self.client.post(f'{AUTH}/confirm-email/', {'token': old_link}, format='json')
        self.assertEqual(expired.data['code'], 'expired')
        self.assertEqual(signing.loads(confirmation_token(user), salt=CONFIRM_SALT)['e'], 'mari@exemplo.com')

    def test_same_answer_whether_the_email_exists_or_not(self):
        self.signup()
        again = self.signup(name='Outra')
        self.assertEqual(again.status_code, 201)
        self.assertEqual(User.objects.filter(email='mari@exemplo.com').count(), 1)
        self.assertEqual(len(mail.outbox), 2)  # quem ainda não confirmou recebe o link de novo
        resent = self.client.post(f'{AUTH}/resend-confirmation/', {'email': 'ninguem@x.com'}, format='json')
        self.assertEqual(resent.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)

    def test_validation_and_robot_bait(self):
        self.assertEqual(self.signup(accept_terms=False).status_code, 400)
        self.assertEqual(self.signup(password_confirm='outra-senha-99').status_code, 400)
        self.assertEqual(self.signup(phone='123').status_code, 400)
        self.assertEqual(self.signup(name=' ').status_code, 400)
        robot = self.signup(website='http://spam.test')
        self.assertEqual(robot.status_code, 201)
        self.assertFalse(User.objects.filter(email='mari@exemplo.com').exists())

    def test_signup_is_rate_limited(self):
        codes = [self.signup(email=f'p{i}@x.com').status_code for i in range(11)]
        self.assertEqual(codes[-1], 429)

    def staff_client(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        return client

    def test_staff_approves_as_a_new_athlete(self):
        self.signup()
        player = Player.objects.get(user__email='mari@exemplo.com')
        staff = self.staff_client()
        listing = staff.get('/api/players/signups/').data
        self.assertEqual([(s['name'], s['legal_name'], s['email_confirmed']) for s in listing], [('Mari', 'Mariana Souza', False)])
        self.assertNotIn(player.id, [p['id'] for p in staff.get('/api/players/', {'page_size': 50}).data['results']])

        self.assertEqual(staff.post(f'/api/players/signups/{player.id}/approve/').status_code, 200)
        player.refresh_from_db()
        self.assertEqual((player.status, player.user.email_confirmed), ('active', True))
        self.assertEqual(Notification.objects.get(user=player.user).title, 'Cadastro aprovado! 🏐')
        self.assertIn(player.id, [p.id for p in ranked_players()])

    def test_staff_links_the_account_to_an_existing_athlete(self):
        veteran = Player.objects.create(name='Mariana', main_position='setter')
        self.signup(instagram='@mari.volei')
        signup = Player.objects.get(user__email='mari@exemplo.com')
        candidates = [c['id'] for c in self.staff_client().get('/api/players/signups/candidates/').data]
        self.assertEqual(candidates, [veteran.id])  # só quem não tem acesso (nem o próprio cadastro pendente)
        response = self.staff_client().post(f'/api/players/signups/{signup.id}/approve/', {'player_id': veteran.id}, format='json')
        self.assertEqual(response.status_code, 200)
        veteran.refresh_from_db()
        self.assertEqual((veteran.user.email, veteran.instagram, veteran.legal_name), ('mari@exemplo.com', 'mari.volei', 'Mariana Souza'))
        self.assertFalse(Player.objects.filter(id=signup.id).exists())  # sem atleta duplicado

    def test_staff_rejects_and_only_staff_sees_the_pending_list(self):
        self.signup()
        signup = Player.objects.get(user__email='mari@exemplo.com')
        athlete = APIClient()
        athlete.force_authenticate(signup.user)
        self.assertEqual(athlete.get('/api/players/signups/').status_code, 403)

        self.assertEqual(self.staff_client().post(f'/api/players/signups/{signup.id}/reject/').status_code, 200)
        self.assertFalse(User.objects.filter(email='mari@exemplo.com').exists())
        self.assertIn('não foi aprovado', mail.outbox[-1].body)

    def test_legal_name_is_only_for_the_staff(self):
        player = Player.objects.create(name='Mari', legal_name='Mariana Souza', main_position='setter')
        other = User.objects.create_user('outro@x.com', 'senha-forte-123', name='Outro')
        athlete = APIClient()
        athlete.force_authenticate(other)
        self.assertIsNone(athlete.get(f'/api/players/{player.id}/').data['legal_name'])
        self.assertEqual(self.staff_client().get(f'/api/players/{player.id}/').data['legal_name'], 'Mariana Souza')

    def test_gender_is_self_declared(self):
        self.assertEqual(self.signup(gender='NB').status_code, 201)
        self.assertEqual(Player.objects.get(user__email='mari@exemplo.com').get_gender_display(), 'Pessoa não binária')
        self.assertEqual(self.signup(email='x@x.com', gender='X').status_code, 400)
        guest = self.staff_client().post('/api/attendance/gamedays/0/add-guest/', {'name': 'V', 'main_position': 'setter', 'gender': 'X'}, format='json')
        self.assertIn(guest.status_code, (400, 404))
