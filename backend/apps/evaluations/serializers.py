from rest_framework import serializers
from apps.core.permissions import is_staff_profile
from .models import Evaluation, EvaluationHistory


class EvaluationSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source='player.display_name', read_only=True)
    evaluator_name = serializers.CharField(source='evaluator.name', read_only=True)
    evaluator_profile = serializers.CharField(source='evaluator.profile', read_only=True)
    last_edit = serializers.SerializerMethodField()

    class Meta:
        model = Evaluation
        fields = [
            'id', 'player', 'player_name', 'evaluator', 'evaluator_name', 'evaluator_profile', 'last_edit',
            'date', 'notes',
            'serve', 'reception', 'passing', 'setting', 'attack', 'block',
            'defense', 'recovery', 'positioning', 'communication',
            'tactical_iq', 'conditioning', 'consistency',
            'overall', 'created_at',
        ]
        read_only_fields = ['overall', 'created_at']

    AUTHOR_FIELDS = ('evaluator', 'evaluator_name', 'evaluator_profile', 'last_edit')

    def get_last_edit(self, obj):
        """Última alteração depois de registrada: quem mudou e quando (usa o histórico pré-carregado)."""
        history = sorted(obj.history.all(), key=lambda h: h.changed_at, reverse=True)
        if not history:
            return None
        last = history[0]
        return {'by': last.changed_by.name if last.changed_by else None, 'at': last.changed_at.isoformat()}

    def to_representation(self, obj):
        data = super().to_representation(obj)
        # Quem avaliou: só a staff vê (o atleta vê as próprias notas, sem o nome de quem deu)
        if not is_staff_profile(getattr(self.context.get('request'), 'user', None)):
            for field in self.AUTHOR_FIELDS:
                data[field] = None
        return data

    def create(self, validated_data):
        validated_data['evaluator'] = self.context['request'].user
        return super().create(validated_data)


class EvaluationHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.name', read_only=True)

    class Meta:
        model = EvaluationHistory
        fields = ['id', 'evaluation', 'changed_by', 'changed_by_name', 'changed_at', 'previous_data', 'new_data']
        read_only_fields = fields
