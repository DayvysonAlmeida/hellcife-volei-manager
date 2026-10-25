from django.core import mail
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from apps.core.models import User
from .identity import canonical_email, canonical_phone, cpf_fingerprint, valid_cpf
from .models import Player

AUTH = '/api/auth'


def make_cpf(base):
    """CPF válido a partir de 9 dígitos (calcula os verificadores)."""
    digits = [int(d) for d in f'{base:09d}']
    for size in (9, 10):
        total = sum(d * (size + 1 - i) for i, d in enumerate(digits))
        digits.append((total * 10) % 11 % 10)
    return ''.join(map(str, digits))


class IdentityRulesTests(SimpleTestCase):
    def test_cpf_check_digits(self):
        self.assertEqual(valid_cpf('529.982.247-25'), '52998224725')
        self.assertIsNone(valid_cpf('529.982.247-24'))
        self.assertIsNone(valid_cpf('111.111.111-11'))
        self.assertIsNone(valid_cpf('123'))
        self.assertEqual(valid_cpf(make_cpf(123456789)), make_cpf(123456789))

    def test_same_inbox_written_another_way(self):
        self.assertEqual(canonical_email('N.Ome+volei@GMAIL.com'), 'nome@gmail.com')
        self.assertEqual(canonical_email('nome@googlemail.com'), 'nome@gmail.com')
        self.assertEqual(canonical_email('n.ome+x@hotmail.com'), 'n.ome@hotmail.com')  # ponto só some no Gmail

    def test_phone_with_or_without_country_code(self):
        self.assertEqual(canonical_phone('+55 (81) 99999-1234'), '81999991234')
        self.assertEqual(canonical_phone('81 99999-1234'), '81999991234')


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', FRONTEND_URL='https://app.test')
class OnePersonOneAccountTests(TestCase):
    """CPF obrigatório e único, WhatsApp único e e-mail normalizado: a mesma pessoa não cria outra conta."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def signup(self, **changes):
        data = {
            'name': 'Mari', 'email': 'mari@gmail.com', 'password': 'quadra-de-areia-9', 'password_confirm': 'quadra-de-areia-9',
            'phone': '(81) 99999-1234', 'gender': 'F', 'main_position': 'setter', 'accept_terms': True,
            'cpf': '529.982.247-25', **changes,
        }
        return self.client.post(f'{AUTH}/signup/', data, format='json')

    def test_cpf_is_required_valid_and_never_stored_open(self):
        self.assertIn('cpf', self.signup(cpf='').data)
        self.assertIn('cpf', self.signup(cpf='529.982.247-24').data)

        self.assertEqual(self.signup().status_code, 201)
        player = Player.objects.get(user__email='mari@gmail.com')
        self.assertEqual(player.cpf_last2, '25')
        self.assertEqual(player.cpf_hash, cpf_fingerprint('52998224725'))
        self.assertNotIn('52998224725', player.cpf_hash)

    def test_same_cpf_or_whatsapp_cannot_open_another_account(self):
        self.signup()
        taken_cpf = self.signup(email='outra@x.com', phone='81988887777')
        self.assertEqual(taken_cpf.status_code, 400)
        self.assertIn('CPF já tem cadastro', taken_cpf.data['cpf'][0])

        taken_phone = self.signup(email='outra@x.com', cpf=make_cpf(111222333), phone='+55 81 99999-1234')
        self.assertEqual(taken_phone.status_code, 400)
        self.assertIn('WhatsApp', taken_phone.data['phone'][0])

    def test_gmail_written_another_way_is_the_same_account(self):
        self.signup()
        again = self.signup(email='M.ari+2@gmail.com', cpf=make_cpf(222333444), phone='81977776666')
        self.assertEqual(again.status_code, 201)  # mesma resposta: não revela que existe
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(len(mail.outbox), 2)  # quem não confirmou recebe o link de novo

    @override_settings(CPF_PEPPER='', DEBUG=False)
    def test_without_the_secret_key_signup_waits_instead_of_storing_wrong(self):
        response = self.signup()
        self.assertEqual(response.status_code, 503)
        self.assertFalse(User.objects.exists())


class ProfileAndStaffCpfTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user('mari@x.com', 'senha-forte-123', name='Mari', profile='player')
        self.player = Player.objects.create(name='Mari', main_position='setter', gender='F', user=self.user)
        self.staff = User.objects.create_user('mod@x.com', 'senha-forte-123', name='Mod', profile='moderator')
        self.client = APIClient()

    def test_athlete_sees_what_is_missing_and_fills_the_cpf_once(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get('/api/players/me/').data['missing_data'], ['cpf', 'phone'])

        response = self.client.patch('/api/players/me/', {'cpf': '529.982.247-25', 'phone': '81999991234'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.data['cpf_masked'], response.data['missing_data']), ('***.***.***-25', []))

        again = self.client.patch('/api/players/me/', {'cpf': make_cpf(333444555)}, format='json')
        self.assertEqual(again.status_code, 400)
        self.assertIn('fale com a organização', again.data['cpf'][0])

    def test_profile_cannot_take_someone_elses_whatsapp_or_cpf(self):
        other = Player.objects.create(name='Bia', main_position='libero', gender='F', phone='(81) 98888-7777')
        from .identity import set_cpf
        set_cpf(other, make_cpf(444555666))
        other.save()
        self.client.force_authenticate(self.user)

        self.assertIn('phone', self.client.patch('/api/players/me/', {'phone': '81988887777'}, format='json').data)
        self.assertIn('cpf', self.client.patch('/api/players/me/', {'cpf': make_cpf(444555666)}, format='json').data)

    def test_staff_can_replace_the_cpf_and_others_never_see_it(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.patch(f'/api/players/{self.player.id}/', {'cpf': '529.982.247-25'}, format='json').status_code, 200)
        self.assertEqual(self.client.patch(f'/api/players/{self.player.id}/', {'cpf': make_cpf(555666777)}, format='json').status_code, 200)
        self.player.refresh_from_db()
        self.assertEqual(self.player.cpf_last2, make_cpf(555666777)[-2:])

        other = User.objects.create_user('bia@x.com', 'senha-forte-123', name='Bia', profile='player')
        self.client.force_authenticate(other)
        self.assertIsNone(self.client.get(f'/api/players/{self.player.id}/').data['cpf_masked'])

    def test_incomplete_filter_for_the_staff(self):
        complete = Player.objects.create(name='Duda', main_position='middle', gender='F', phone='81911112222')
        from .identity import set_cpf
        set_cpf(complete, make_cpf(666777888))
        complete.save()
        self.client.force_authenticate(self.staff)

        ids = [p['id'] for p in self.client.get('/api/players/', {'incomplete': 'true', 'page_size': 50}).data['results']]
        self.assertIn(self.player.id, ids)
        self.assertNotIn(complete.id, ids)


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', FRONTEND_URL='https://app.test')
class ApprovalDuplicatesTests(TestCase):
    """Na aprovação a staff vê os avisos de repetido, e ligar a um atleta existente leva o CPF junto."""

    def setUp(self):
        cache.clear()
        self.staff = User.objects.create_user('mod@x.com', 'senha-forte-123', name='Mod', profile='moderator')
        self.existing = Player.objects.create(name='Mariana Souza', main_position='setter', gender='F', phone='81999991234')
        APIClient().post(f'{AUTH}/signup/', {
            'name': 'Mari', 'legal_name': 'Mariana Souza', 'email': 'mari@x.com', 'password': 'quadra-de-areia-9',
            'password_confirm': 'quadra-de-areia-9', 'phone': '81977776666', 'gender': 'F', 'main_position': 'setter',
            'accept_terms': True, 'cpf': '529.982.247-25',
        }, format='json')
        self.client = APIClient()
        self.client.force_authenticate(self.staff)

    def test_pending_list_warns_about_similar_people(self):
        signup = self.client.get('/api/players/signups/').data[0]
        self.assertIn('Nome igual ao de Mariana Souza.', signup['duplicates'])

    def test_linking_to_an_existing_athlete_carries_the_cpf(self):
        signup_id = self.client.get('/api/players/signups/').data[0]['id']
        response = self.client.post(f'/api/players/signups/{signup_id}/approve/', {'player_id': self.existing.id}, format='json')

        self.assertEqual(response.status_code, 200)
        self.existing.refresh_from_db()
        self.assertEqual(self.existing.cpf_hash, cpf_fingerprint('52998224725'))
        self.assertEqual(Player.objects.filter(cpf_hash__isnull=False).count(), 1)


class LegacyDuplicatePhoneTests(TestCase):
    """Quem já divide o WhatsApp com um cadastro antigo continua salvando o perfil (a regra vale ao trocar o número)."""

    def test_unchanged_shared_phone_does_not_block_the_profile(self):
        Player.objects.create(name='Bia', main_position='libero', gender='F', phone='81988887777')
        user = User.objects.create_user('ale@x.com', 'senha-forte-123', name='Ale', profile='player')
        Player.objects.create(name='Ale', main_position='outside', gender='M', user=user, phone='(81) 98888-7777')
        client = APIClient()
        client.force_authenticate(user)

        response = client.patch('/api/players/me/', {'phone': '81988887777', 'cpf': '529.982.247-25'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['cpf_masked'], '***.***.***-25')
