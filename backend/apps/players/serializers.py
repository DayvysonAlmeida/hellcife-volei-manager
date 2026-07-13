from rest_framework import serializers
from .models import Player


class PlayerListSerializer(serializers.ModelSerializer):
    latest_overall = serializers.SerializerMethodField()
    display_name = serializers.ReadOnlyField()
    main_position_display = serializers.CharField(source='get_main_position_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    avatar_url = serializers.ReadOnlyField()

    class Meta:
        model = Player
        fields = [
            'id', 'name', 'nickname', 'display_name', 'shirt_number',
            'main_position', 'main_position_display', 'secondary_position',
            'avatar_url', 'status', 'status_display', 'latest_overall',
            'mini_stars', 'big_stars', 'created_at', 'is_guest', 'invited_by'
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


class PlayerDetailSerializer(serializers.ModelSerializer):
    latest_overall = serializers.SerializerMethodField()
    display_name = serializers.ReadOnlyField()
    main_position_display = serializers.CharField(source='get_main_position_display', read_only=True)
    secondary_position_display = serializers.CharField(source='get_secondary_position_display', read_only=True)
    dominant_hand_display = serializers.CharField(source='get_dominant_hand_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    avatar_url = serializers.ReadOnlyField()

    class Meta:
        model = Player
        fields = [
            'id', 'name', 'nickname', 'display_name', 'shirt_number',
            'age', 'height', 'weight',
            'main_position', 'main_position_display',
            'secondary_position', 'secondary_position_display',
            'dominant_hand', 'dominant_hand_display',
            'phone', 'instagram', 'avatar', 'avatar_url', 'notes',
            'status', 'status_display',
            'user', 'latest_overall',
            'mini_stars', 'big_stars',
            'created_at', 'updated_at',
            'is_guest', 'invited_by'
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


class PlayerWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = [
            'id', 'name', 'nickname', 'shirt_number', 'age', 'height', 'weight',
            'main_position', 'secondary_position', 'dominant_hand',
            'phone', 'instagram', 'avatar', 'notes', 'status', 'user',
            'mini_stars', 'big_stars',
        ]
        read_only_fields = ['id']
