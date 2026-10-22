"""
Gera o par de chaves VAPID do Web Push.

Rode uma vez e guarde as duas no Cloud Run (a privada, de preferência, no Secret Manager).
Trocar as chaves depois invalida as inscrições dos aparelhos: cada um precisa se inscrever de novo.
"""
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.core.management.base import BaseCommand


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


class Command(BaseCommand):
    help = 'Gera as chaves VAPID (VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY) para o Web Push.'

    def handle(self, *args, **options):
        key = ec.generate_private_key(ec.SECP256R1())
        private_raw = key.private_numbers().private_value.to_bytes(32, 'big')
        public_raw = key.public_key().public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint,
        )
        self.stdout.write(f'VAPID_PUBLIC_KEY={b64url(public_raw)}')
        self.stdout.write(f'VAPID_PRIVATE_KEY={b64url(private_raw)}')
        self.stdout.write('VAPID_CLAIM_EMAIL=<e-mail de contato do responsável pelo app>')
