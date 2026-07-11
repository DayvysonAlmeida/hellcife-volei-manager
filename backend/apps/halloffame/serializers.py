from rest_framework import serializers
from .models import HallOfFameEntry


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
