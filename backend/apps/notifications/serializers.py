import base64
import binascii

from rest_framework import serializers
from .models import Notification
from .push import is_allowed_endpoint

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'type', 'url', 'is_read', 'created_at']
        read_only_fields = ['id', 'created_at']


def _decoded_length(value):
    try:
        return len(base64.urlsafe_b64decode(value + '=' * (-len(value) % 4)))
    except (binascii.Error, ValueError):
        return -1


class PushKeysSerializer(serializers.Serializer):
    p256dh = serializers.CharField(max_length=200)
    auth = serializers.CharField(max_length=100)

    def validate_p256dh(self, value):
        # Ponto P-256 sem compressão: 65 bytes
        if _decoded_length(value) != 65:
            raise serializers.ValidationError('Chave do aparelho inválida.')
        return value

    def validate_auth(self, value):
        if _decoded_length(value) != 16:
            raise serializers.ValidationError('Segredo do aparelho inválido.')
        return value


class PushSubscriptionSerializer(serializers.Serializer):
    """Inscrição vinda do navegador (PushSubscription.toJSON())."""
    endpoint = serializers.URLField(max_length=1000)
    keys = PushKeysSerializer()

    def validate_endpoint(self, value):
        if not is_allowed_endpoint(value):
            raise serializers.ValidationError('Serviço de push não reconhecido.')
        return value
