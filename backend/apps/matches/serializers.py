from rest_framework import serializers
from .models import Match, MatchTeam, MatchPlayer


class MatchPlayerSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source='player.display_name', read_only=True)
    player_avatar = serializers.CharField(source='player.avatar_url', read_only=True)
    player_shirt = serializers.IntegerField(source='player.shirt_number', read_only=True)
    player_invited_by = serializers.CharField(source='player.invited_by', read_only=True)

    class Meta:
        model = MatchPlayer
        fields = ['id', 'player', 'player_name', 'player_avatar', 'player_shirt', 'player_invited_by',
                  'match_team', 'mvp', 'best_attacker', 'best_server', 'best_defender',
                  'best_setter', 'best_libero', 'best_blocker', 'best_opposite']


class MatchTeamSerializer(serializers.ModelSerializer):
    match_players = MatchPlayerSerializer(many=True, read_only=True)

    class Meta:
        model = MatchTeam
        fields = ['id', 'match', 'team_name', 'color_hex', 'score', 'winner', 'team', 'match_players']


class MatchSerializer(serializers.ModelSerializer):
    match_teams = MatchTeamSerializer(many=True, read_only=True)
    modality_display = serializers.CharField(source='get_modality_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = Match
        fields = ['id', 'date', 'location', 'modality', 'modality_display',
                  'gameday', 'team_generation', 'notes',
                  'created_by', 'created_by_name', 'match_teams', 'created_at']
        read_only_fields = ['created_by', 'created_at']


class MatchListPlayerSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source='player.display_name', read_only=True)
    player_avatar = serializers.CharField(source='player.avatar_url', read_only=True)
    player_position = serializers.CharField(source='player.main_position', read_only=True)
    player_shirt = serializers.IntegerField(source='player.shirt_number', read_only=True)
    player_is_guest = serializers.BooleanField(source='player.is_guest', read_only=True)
    player_invited_by = serializers.CharField(source='player.invited_by', read_only=True)

    class Meta:
        model = MatchPlayer
        fields = ['id', 'player', 'player_name', 'player_avatar', 'player_position',
                  'player_shirt', 'player_is_guest', 'player_invited_by', 'mvp', 'best_attacker', 'best_server', 'best_defender',
                  'best_setter', 'best_libero', 'best_blocker', 'best_opposite']


class MatchListTeamSerializer(serializers.ModelSerializer):
    match_players = MatchListPlayerSerializer(many=True, read_only=True)

    class Meta:
        model = MatchTeam
        fields = ['id', 'team_name', 'color_hex', 'score', 'winner', 'match_players']


class MatchListSerializer(serializers.ModelSerializer):
    modality_display = serializers.CharField(source='get_modality_display', read_only=True)
    match_teams = MatchListTeamSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = Match
        fields = ['id', 'date', 'location', 'modality', 'modality_display',
                  'gameday', 'notes', 'created_by_name', 'match_teams', 'created_at']


class MatchWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = ['id', 'date', 'location', 'modality', 'gameday', 'team_generation', 'notes']
        read_only_fields = ['id']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
