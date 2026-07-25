from rest_framework import serializers
from .models import Player


class PlayerListSerializer(serializers.ModelSerializer):
    latest_overall = serializers.SerializerMethodField()
    display_name = serializers.ReadOnlyField()
    main_position_display = serializers.CharField(source='get_main_position_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    avatar_url = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = [
            'id', 'name', 'nickname', 'display_name', 'shirt_number',
            'main_position', 'main_position_display', 'secondary_position',
            'avatar_url', 'status', 'status_display', 'latest_overall',
            'mini_stars', 'big_stars', 'mvp_stars', 'attack_stars', 'defense_stars',
            'setter_stars', 'pass_stars', 'block_stars',
            'created_at', 'is_guest', 'invited_by', 'consecutive_absences', 'stats',
            'gender'
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
                'win_streak': streak,
                'mvp': obj.mvps,
                'best_attacker': obj.best_attackers,
                'best_server': obj.best_servers,
                'best_defender': obj.best_defenders,
            }
        return None


class PlayerDetailSerializer(serializers.ModelSerializer):
    latest_overall = serializers.SerializerMethodField()
    display_name = serializers.ReadOnlyField()
    main_position_display = serializers.CharField(source='get_main_position_display', read_only=True)
    secondary_position_display = serializers.CharField(source='get_secondary_position_display', read_only=True)
    dominant_hand_display = serializers.CharField(source='get_dominant_hand_display', read_only=True)
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    avatar_url = serializers.SerializerMethodField()

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
            'is_guest', 'invited_by', 'consecutive_absences'
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


class PlayerWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = [
            'id', 'name', 'nickname', 'shirt_number', 'age', 'height', 'weight',
            'main_position', 'secondary_position', 'dominant_hand', 'gender',
            'phone', 'instagram', 'avatar', 'notes', 'status', 'user',
            'mini_stars', 'big_stars', 'mvp_stars', 'attack_stars', 'defense_stars',
            'setter_stars', 'pass_stars', 'block_stars',
            'is_guest',
        ]
        read_only_fields = ['id']
