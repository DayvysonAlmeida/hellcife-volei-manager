from rest_framework import serializers
from .models import Player, Badge, PlayerBadge
from .elo_service import get_elo_tier, get_elo_progress
from .rankings import elo_calibration, season_match_count


class EloCalibrationMixin:
    """
    Faixa de Elo só depois da calibração (10 partidas na temporada), igual ao ranking de Elo.
    Antes disso a faixa vem como 'calibrating' e sem barra de progresso, em todas as telas.
    """

    def _season_games(self, obj):
        games = self.context.get('season_matches')  # a lista calcula de uma vez para todos
        if games is not None:
            return games.get(obj.id, 0)
        cache = self.__dict__.setdefault('_season_games_cache', {})
        if obj.id not in cache:
            cache[obj.id] = season_match_count(obj.id)
        return cache[obj.id]

    def get_elo_calibration(self, obj):
        return elo_calibration(self._season_games(obj))

    def get_elo_tier(self, obj):
        return 'calibrating' if self.get_elo_calibration(obj)['calibrating'] else obj.elo_tier

    def get_elo_tier_data(self, obj):
        return None if self.get_elo_calibration(obj)['calibrating'] else get_elo_progress(obj.elo)


class PlayerListSerializer(EloCalibrationMixin, serializers.ModelSerializer):
    latest_overall = serializers.SerializerMethodField()
    display_name = serializers.ReadOnlyField()
    main_position_display = serializers.CharField(source='get_main_position_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    avatar_url = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()
    elo_tier = serializers.SerializerMethodField()
    elo_tier_data = serializers.SerializerMethodField()
    elo_calibration = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = [
            'id', 'name', 'nickname', 'display_name', 'shirt_number',
            'main_position', 'main_position_display', 'secondary_position',
            'avatar_url', 'status', 'status_display', 'latest_overall',
            'mini_stars', 'big_stars', 'mvp_stars', 'attack_stars', 'defense_stars',
            'setter_stars', 'pass_stars', 'block_stars',
            'created_at', 'is_guest', 'invited_by', 'guest_overall', 'consecutive_absences', 'stats',
            'gender',
            'elo', 'elo_tier', 'elo_tier_data', 'elo_calibration',
        ]

    def get_latest_overall(self, obj):
        """Usa a annotation do queryset se disponível, senão faz fallback para a property."""
        if hasattr(obj, 'annotated_overall'):
            return obj.annotated_overall if obj.annotated_overall else None
        # Fallback: usa evaluations já prefetchados se existirem
        if hasattr(obj, '_prefetched_objects_cache') and 'evaluations' in obj._prefetched_objects_cache:
            evals = list(obj.evaluations.all())
            if evals:
                evals.sort(key=lambda e: e.date, reverse=True)
                return evals[0].overall
            return None
        # Último fallback: query individual
        eval_ = obj.evaluations.order_by('-date').first()
        return eval_.overall if eval_ else None

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request is not None:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_stats(self, obj):
        if hasattr(obj, 'total_matches'):
            win_rate = (obj.wins / obj.total_matches * 100) if obj.total_matches > 0 else 0
            
            # Calcular win_streak a partir dos match_appearances prefetchados
            streak = 0
            if hasattr(obj, '_prefetched_objects_cache') and 'match_appearances' in obj._prefetched_objects_cache:
                appearances = list(obj.match_appearances.all())
                # Filtra apenas os que tem match_team e match associados, e ordena por data decrescente
                valid_apps = [app for app in appearances if app.match_team and app.match_team.match]
                valid_apps.sort(key=lambda a: a.match_team.match.date, reverse=True)
                
                for app in valid_apps:
                    if app.match_team.winner:
                        streak += 1
                    else:
                        break

            return {
                'matches': obj.total_matches,
                'win_rate': round(win_rate, 1),
                'wins': obj.wins,
                'win_rank': self.context.get('global_win_ranks', {}).get(obj.id, None),
                'fire_shark_rank': self.context.get('global_fire_sharks', {}).get(obj.id, None),
                'win_streak': streak,
                'mvp': obj.mvps,
                'best_attacker': obj.best_attackers,
                'best_server': obj.best_servers,
                'best_defender': obj.best_defenders,
            }
        return None


class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = '__all__'


class PlayerBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer(read_only=True)

    class Meta:
        model = PlayerBadge
        fields = ['id', 'badge', 'awarded_at']


class PlayerDetailSerializer(EloCalibrationMixin, serializers.ModelSerializer):
    latest_overall = serializers.SerializerMethodField()
    display_name = serializers.ReadOnlyField()
    main_position_display = serializers.CharField(source='get_main_position_display', read_only=True)
    secondary_position_display = serializers.CharField(source='get_secondary_position_display', read_only=True)
    dominant_hand_display = serializers.CharField(source='get_dominant_hand_display', read_only=True)
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    avatar_url = serializers.SerializerMethodField()
    badges = PlayerBadgeSerializer(many=True, read_only=True)
    elo_tier = serializers.SerializerMethodField()
    elo_tier_data = serializers.SerializerMethodField()
    elo_calibration = serializers.SerializerMethodField()
    legal_name = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = [
            'id', 'name', 'nickname', 'display_name', 'shirt_number',
            'age', 'height', 'weight',
            'main_position', 'main_position_display',
            'secondary_position', 'secondary_position_display',
            'dominant_hand', 'dominant_hand_display',
            'gender', 'gender_display',
            'phone', 'instagram', 'avatar', 'avatar_url', 'notes',
            'status', 'status_display',
            'user', 'latest_overall',
            'mini_stars', 'big_stars',
            'mvp_stars', 'attack_stars', 'defense_stars',
            'setter_stars', 'pass_stars', 'block_stars',
            'created_at', 'updated_at',
            'is_guest', 'invited_by', 'guest_overall', 'consecutive_absences', 'badges', 'legal_name',
            'elo', 'elo_tier', 'elo_tier_data', 'elo_calibration',
        ]

    def get_latest_overall(self, obj):
        """Usa evaluations prefetchados quando disponível."""
        if hasattr(obj, '_prefetched_objects_cache') and 'evaluations' in obj._prefetched_objects_cache:
            evals = list(obj.evaluations.all())
            if evals:
                evals.sort(key=lambda e: e.date, reverse=True)
                return evals[0].overall
            return None
        eval_ = obj.evaluations.order_by('-date').first()
        return eval_.overall if eval_ else None

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request is not None:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_legal_name(self, obj):
        """Nome civil: só a staff vê (no app aparece o nome social)."""
        request = self.context.get('request')
        if getattr(getattr(request, 'user', None), 'profile', None) in ('admin', 'moderator'):
            return obj.legal_name
        return None


class PlayerWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = [
            'id', 'name', 'nickname', 'shirt_number', 'age', 'height', 'weight',
            'main_position', 'secondary_position', 'dominant_hand', 'gender',
            'phone', 'instagram', 'avatar', 'notes', 'status', 'user',
            'mini_stars', 'big_stars', 'mvp_stars', 'attack_stars', 'defense_stars',
            'setter_stars', 'pass_stars', 'block_stars',
            'is_guest', 'guest_overall', 'legal_name',
        ]
        read_only_fields = ['id']
