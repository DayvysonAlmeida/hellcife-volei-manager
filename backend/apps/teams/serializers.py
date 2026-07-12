from rest_framework import serializers
from .models import TeamGeneration, Team, TeamPlayer


class TeamPlayerSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source='player.display_name', read_only=True)
    player_position = serializers.CharField(source='player.main_position', read_only=True)
    player_overall = serializers.SerializerMethodField()
    player_avatar = serializers.CharField(source='player.avatar_url', read_only=True)
    player_shirt = serializers.IntegerField(source='player.shirt_number', read_only=True)

    class Meta:
        model = TeamPlayer
        fields = ['id', 'player', 'player_name', 'player_position',
                  'player_overall', 'player_avatar', 'player_shirt', 'order_in_team']

    def get_player_overall(self, obj):
        return obj.player.latest_overall


class TeamSerializer(serializers.ModelSerializer):
    team_players = TeamPlayerSerializer(many=True, read_only=True)

    class Meta:
        model = Team
        fields = ['id', 'generation', 'name', 'color', 'color_hex',
                  'avg_overall', 'order', 'team_players']


class TeamGenerationSerializer(serializers.ModelSerializer):
    teams = TeamSerializer(many=True, read_only=True)
    modality_display = serializers.CharField(source='get_modality_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    gameday_date = serializers.DateField(source='gameday.date', read_only=True)
    gameday_time = serializers.TimeField(source='gameday.time', read_only=True)
    gameday_location = serializers.CharField(source='gameday.location', read_only=True)

    class Meta:
        model = TeamGeneration
        fields = ['id', 'gameday', 'gameday_date', 'gameday_time', 'gameday_location', 'modality', 'modality_display',
                  'created_by', 'created_by_name', 'notes', 'balance_score',
                  'teams', 'created_at']
        read_only_fields = ['created_by', 'balance_score', 'created_at']


class GenerateTeamsInputSerializer(serializers.Serializer):
    modality = serializers.IntegerField(min_value=2, max_value=6)
    gameday_id = serializers.IntegerField(required=False, allow_null=True)
    player_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_null=True)
    save = serializers.BooleanField(default=False)
    notes = serializers.CharField(required=False, allow_blank=True)
