from rest_framework import serializers
from .models import HallOfFameEntry, RegulationText


class HallOfFameSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    player_name = serializers.CharField(source='player.display_name', read_only=True)
    player_avatar = serializers.CharField(source='player.avatar_url', read_only=True)
    player_position = serializers.CharField(source='player.main_position', read_only=True)
    player_shirt = serializers.IntegerField(source='player.shirt_number', read_only=True)
    awarded_by_name = serializers.CharField(source='awarded_by.name', read_only=True)

    class Meta:
        model = HallOfFameEntry
        fields = [
            'id', 'category', 'category_display', 'player', 'player_name',
            'player_avatar', 'player_position', 'player_shirt',
            'year', 'description', 'awarded_by', 'awarded_by_name', 'created_at'
        ]
        read_only_fields = ['awarded_by', 'created_at']

    def create(self, validated_data):
        validated_data['awarded_by'] = self.context['request'].user
        return super().create(validated_data)


class RegulationTextSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.CharField(source='updated_by.name', read_only=True, allow_null=True)

    class Meta:
        model = RegulationText
        fields = ['id', 'title', 'content', 'updated_at', 'updated_by', 'updated_by_name']
        read_only_fields = ['id', 'updated_at', 'updated_by', 'updated_by_name']

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)