from rest_framework import serializers
from .models import GameDay, Attendance
from apps.players.serializers import PlayerListSerializer


class AttendanceSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source='player.display_name', read_only=True)
    player_avatar = serializers.CharField(source='player.avatar_url', read_only=True)
    player_position = serializers.CharField(source='player.main_position', read_only=True)
    player_shirt = serializers.IntegerField(source='player.shirt_number', read_only=True)

    class Meta:
        model = Attendance
        fields = ['id', 'gameday', 'player', 'player_name', 'player_avatar',
                  'player_position', 'player_shirt', 'present', 'checked_at']
        read_only_fields = ['checked_at']


class GameDaySerializer(serializers.ModelSerializer):
    total_present = serializers.ReadOnlyField()
    total_players = serializers.ReadOnlyField()
    attendances = AttendanceSerializer(many=True, read_only=True)

    class Meta:
        model = GameDay
        fields = ['id', 'date', 'description', 'location', 'created_by',
                  'total_present', 'total_players', 'attendances', 'created_at']
        read_only_fields = ['created_by', 'created_at']


class GameDayListSerializer(serializers.ModelSerializer):
    total_present = serializers.ReadOnlyField()
    total_players = serializers.ReadOnlyField()

    class Meta:
        model = GameDay
        fields = ['id', 'date', 'description', 'location',
                  'total_present', 'total_players', 'created_at']


class BulkAttendanceSerializer(serializers.Serializer):
    """Para marcar presença de múltiplos jogadores de uma vez."""
    gameday_id = serializers.IntegerField()
    present_player_ids = serializers.ListField(child=serializers.IntegerField())
