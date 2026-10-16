from rest_framework import serializers
from .models import TeamGeneration, Team, TeamPlayer


class TeamPlayerSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source='player.display_name', read_only=True)
    player_position = serializers.CharField(source='player.main_position', read_only=True)
    player_overall = serializers.SerializerMethodField()
    player_avatar = serializers.CharField(source='player.avatar_url', read_only=True)
    player_shirt = serializers.IntegerField(source='player.shirt_number', read_only=True)
    player_is_guest = serializers.BooleanField(source='player.is_guest', read_only=True)

    class Meta:
        model = TeamPlayer
        fields = ['id', 'player', 'player_name', 'player_position',
                  'player_overall', 'player_avatar', 'player_shirt', 'player_is_guest', 'order_in_team']

    def get_player_overall(self, obj):
        """Usa evaluations prefetchados quando disponível para evitar N+1."""
        player = obj.player
        if hasattr(player, '_prefetched_objects_cache') and 'evaluations' in player._prefetched_objects_cache:
            evals = list(player.evaluations.all())
            if evals:
                evals.sort(key=lambda e: e.date, reverse=True)
                return evals[0].overall
            return None
        return player.latest_overall


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
    removed_players = serializers.SerializerMethodField()

    def get_removed_players(self, obj):
        return [
            {'id': p.id, 'name': p.display_name, 'avatar_url': p.avatar_url}
            for p in obj.removed_players.all()
        ]

    class Meta:
        model = TeamGeneration
        fields = ['id', 'gameday', 'gameday_date', 'gameday_time', 'gameday_location', 'modality', 'modality_display',
                  'created_by', 'created_by_name', 'notes', 'balance_score', 'is_locked',
                  'teams', 'removed_players', 'created_at']
        read_only_fields = ['created_by', 'balance_score', 'created_at']


class GenerateTeamsInputSerializer(serializers.Serializer):
    modality = serializers.IntegerField(min_value=2, max_value=6)
    gameday_id = serializers.IntegerField(required=False, allow_null=True)
    player_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_null=True)
    save = serializers.BooleanField(default=False)
    notes = serializers.CharField(required=False, allow_blank=True)
