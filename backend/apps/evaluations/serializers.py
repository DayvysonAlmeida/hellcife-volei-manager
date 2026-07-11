from rest_framework import serializers
from .models import Evaluation, EvaluationConfig, EvaluationHistory


class EvaluationConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationConfig
        fields = '__all__'


class EvaluationSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source='player.display_name', read_only=True)
    evaluator_name = serializers.CharField(source='evaluator.name', read_only=True)

    class Meta:
        model = Evaluation
        fields = [
            'id', 'player', 'player_name', 'evaluator', 'evaluator_name',
            'date', 'notes',
            'serve', 'reception', 'passing', 'setting', 'attack', 'block',
            'defense', 'recovery', 'positioning', 'communication',
            'tactical_iq', 'conditioning', 'consistency',
            'overall', 'created_at',
        ]
        read_only_fields = ['overall', 'created_at']

    def create(self, validated_data):
        validated_data['evaluator'] = self.context['request'].user
        return super().create(validated_data)


class EvaluationHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.name', read_only=True)

    class Meta:
        model = EvaluationHistory
        fields = ['id', 'evaluation', 'changed_by', 'changed_by_name', 'changed_at', 'previous_data', 'new_data']
        read_only_fields = fields
