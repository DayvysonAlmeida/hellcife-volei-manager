from rest_framework import serializers
from .models import Plan, UserSubscription, SubscriptionCycle, ExtraCreditPurchase, TemporaryGuest

class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = '__all__'

class SubscriptionCycleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionCycle
        fields = '__all__'

class UserSubscriptionSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)
    plan_id = serializers.PrimaryKeyRelatedField(queryset=Plan.objects.all(), source='plan', write_only=True, required=False)
    current_cycle = serializers.SerializerMethodField()
    player_name = serializers.CharField(source='player.name', read_only=True)
    
    class Meta:
        model = UserSubscription
        fields = '__all__'
        
    def get_current_cycle(self, obj):
        from .services import SubscriptionService
        cycle = SubscriptionService.get_current_cycle(obj.player)
        if cycle:
            return SubscriptionCycleSerializer(cycle).data
        return None

class ExtraCreditPurchaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtraCreditPurchase
        fields = '__all__'

class TemporaryGuestSerializer(serializers.ModelSerializer):
    class Meta:
        model = TemporaryGuest
        fields = '__all__'
