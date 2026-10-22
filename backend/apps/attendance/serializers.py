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
    paid_method = serializers.SerializerMethodField()

    def get_paid_method(self, obj):
        """Forma do pagamento válido mais recente (usa o prefetch de payments quando houver)."""
        paid = [p for p in obj.payments.all() if p.status == 'paid']
        return max(paid, key=lambda p: p.created_at).method if paid else None

    class Meta:
        model = Attendance
        fields = ['id', 'gameday', 'player', 'player_name', 'player_avatar',
                  'player_position', 'player_shirt', 'player_status', 'player_is_guest', 'player_invited_by', 'present', 'has_paid', 'payment_claimed', 'checked_at',
                  'was_no_show', 'is_justified', 'justification_text', 'is_waitlist', 'waitlist_joined_at',
                  'gameday_date', 'gameday_location', 'used_credit', 'credits_used', 'used_priority',
                  'is_reserved', 'reserved_until', 'amount_due', 'paid_method']
        read_only_fields = ['checked_at']


class CourtCheckinSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source='player.display_name', read_only=True)
    player_avatar = serializers.CharField(source='player.avatar_url', read_only=True)
    player_position = serializers.CharField(source='player.main_position', read_only=True)
    player_is_guest = serializers.BooleanField(source='player.is_guest', read_only=True)
    player_invited_by = serializers.CharField(source='player.invited_by', read_only=True)

    class Meta:
        model = CourtCheckin
        fields = ['id', 'gameday', 'player', 'player_name', 'player_avatar', 'player_position', 'player_is_guest', 'player_invited_by', 'arrived_at']
        read_only_fields = ['arrived_at']


PRICING_FIELDS = ['credit_cost', 'pricing_type', 'price_per_person', 'requires_prepayment', 'reservation_hold_minutes',
                  'suggested_price_per_person', 'effective_price_per_person']


class GameDayPricingMixin(serializers.Serializer):
    suggested_price_per_person = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)
    effective_price_per_person = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = getattr(self, 'instance', None)
        pricing_type = attrs.get('pricing_type', getattr(instance, 'pricing_type', GameDay.PRICING_SPLIT))
        price = attrs.get('price_per_person', getattr(instance, 'price_per_person', None))
        if price is not None and price < 0:
            raise serializers.ValidationError({'price_per_person': 'O valor não pode ser negativo.'})
        if pricing_type == GameDay.PRICING_FIXED and price is None:
            raise serializers.ValidationError({'price_per_person': 'Informe a taxa por pessoa do evento.'})

        requires_prepayment = attrs.get('requires_prepayment', getattr(instance, 'requires_prepayment', False))
        if requires_prepayment and price is None:
            # Sem valor definido, o rateio é sugerido como quadra ÷ vagas; sem vagas não há como sugerir
            court_price = attrs.get('court_price', getattr(instance, 'court_price', None))
            max_players = attrs.get('max_players', getattr(instance, 'max_players', 0))
            if not (court_price and max_players):
                raise serializers.ValidationError({
                    'price_per_person': 'Para exigir pagamento, informe o valor por pessoa ou o valor da quadra e o limite de vagas.'
                })
        return attrs


class GameDaySerializer(GameDayPricingMixin, serializers.ModelSerializer):
    total_present = serializers.ReadOnlyField()
    total_players = serializers.ReadOnlyField()
    total_reserved = serializers.ReadOnlyField()
    attendances = AttendanceSerializer(many=True, read_only=True)
    court_checkins = CourtCheckinSerializer(many=True, read_only=True)

    class Meta:
        model = GameDay
        fields = ['id', 'date', 'time', 'time_end', 'court_price', 'max_players', 'pix_key', 'description', 'location', 'arena_name', 'created_by',
                  'total_present', 'total_players', 'total_reserved', 'attendances', 'court_checkins', 'created_at',
                  'is_closed', 'is_published', *PRICING_FIELDS]
        read_only_fields = ['created_by', 'created_at']


class GameDayListSerializer(GameDayPricingMixin, serializers.ModelSerializer):
    total_present = serializers.IntegerField(source='_total_present', read_only=True)
    total_paid = serializers.IntegerField(source='_total_paid', read_only=True)
    total_players = serializers.IntegerField(source='_total_players', read_only=True)
    total_court_checkins = serializers.IntegerField(source='_total_court_checkins', read_only=True)
    total_reserved = serializers.IntegerField(source='_total_reserved', read_only=True)

    class Meta:
        model = GameDay
        fields = ['id', 'date', 'time', 'time_end', 'court_price', 'max_players', 'pix_key', 'description', 'location', 'arena_name',
                  'total_present', 'total_paid', 'total_players', 'total_court_checkins', 'total_reserved', 'created_at', 'is_closed',
                  'is_published', *PRICING_FIELDS]


class BulkAttendanceSerializer(serializers.Serializer):
    """Para marcar presença de múltiplos jogadores de uma vez."""
    gameday_id = serializers.IntegerField()
    present_player_ids = serializers.ListField(child=serializers.IntegerField())
