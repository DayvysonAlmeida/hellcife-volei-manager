from rest_framework import serializers
from .models import GameDay, Attendance, CourtCheckin
from apps.players.serializers import PlayerListSerializer


class AttendanceSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source='player.display_name', read_only=True)
    player_avatar = serializers.CharField(source='player.avatar_url', read_only=True)
    player_position = serializers.CharField(source='player.main_position', read_only=True)
    player_shirt = serializers.IntegerField(source='player.shirt_number', read_only=True)
    player_status = serializers.CharField(source='player.status', read_only=True)
    player_is_guest = serializers.BooleanField(source='player.is_guest', read_only=True)
    player_invited_by = serializers.CharField(source='player.invited_by', read_only=True)
    gameday_date = serializers.DateField(source='gameday.date', read_only=True)
    gameday_location = serializers.CharField(source='gameday.location', read_only=True)

    class Meta:
        model = Attendance
        fields = ['id', 'gameday', 'player', 'player_name', 'player_avatar',
                  'player_position', 'player_shirt', 'player_status', 'player_is_guest', 'player_invited_by', 'present', 'has_paid', 'checked_at',
                  'was_no_show', 'is_justified', 'justification_text', 'is_waitlist', 'waitlist_joined_at',
                  'gameday_date', 'gameday_location']
        read_only_fields = ['checked_at']


class CourtCheckinSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source='player.display_name', read_only=True)
    player_avatar = serializers.CharField(source='player.avatar_url', read_only=True)
    player_position = serializers.CharField(source='player.main_position', read_only=True)
    player_is_guest = serializers.BooleanField(source='player.is_guest', read_only=True)

    class Meta:
        model = CourtCheckin
        fields = ['id', 'gameday', 'player', 'player_name', 'player_avatar', 'player_position', 'player_is_guest', 'arrived_at']
        read_only_fields = ['arrived_at']


class GameDaySerializer(serializers.ModelSerializer):
    total_present = serializers.ReadOnlyField()
    total_players = serializers.ReadOnlyField()
    attendances = AttendanceSerializer(many=True, read_only=True)
    court_checkins = CourtCheckinSerializer(many=True, read_only=True)

    class Meta:
        model = GameDay
        fields = ['id', 'date', 'time', 'time_end', 'court_price', 'max_players', 'description', 'location', 'created_by',
                  'total_present', 'total_players', 'attendances', 'court_checkins', 'created_at', 'is_closed']
        read_only_fields = ['created_by', 'created_at']


class GameDayListSerializer(serializers.ModelSerializer):
    total_present = serializers.IntegerField(source='_total_present', read_only=True)
    total_paid = serializers.IntegerField(source='_total_paid', read_only=True)
    total_players = serializers.IntegerField(source='_total_players', read_only=True)
    total_court_checkins = serializers.IntegerField(source='_total_court_checkins', read_only=True)

    class Meta:
        model = GameDay
        fields = ['id', 'date', 'time', 'time_end', 'court_price', 'max_players', 'description', 'location',
                  'total_present', 'total_paid', 'total_players', 'total_court_checkins', 'created_at', 'is_closed']


class BulkAttendanceSerializer(serializers.Serializer):
    """Para marcar presença de múltiplos jogadores de uma vez."""
    gameday_id = serializers.IntegerField()
    present_player_ids = serializers.ListField(child=serializers.IntegerField())
