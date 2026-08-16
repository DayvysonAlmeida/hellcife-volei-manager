from django.contrib import admin
from .models import (
    AsaasCustomer,
    Plan,
    UserSubscription,
    SubscriptionCycle,
    ExtraCreditPurchase,
    TemporaryGuest
)

@admin.register(AsaasCustomer)
class AsaasCustomerAdmin(admin.ModelAdmin):
    list_display = ['player', 'customer_id', 'cpf']
    search_fields = ['player__name', 'customer_id', 'cpf']
    autocomplete_fields = ['player']


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'price', 'credits', 'is_active', 'priorities', 'free_guests']
    list_filter = ['is_active', 'has_unlimited_priority']
    search_fields = ['name']


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['player', 'plan', 'status', 'start_date', 'next_billing_date']
    list_filter = ['status', 'plan']
    search_fields = ['player__name', 'asaas_subscription_id']
    autocomplete_fields = ['player']
    date_hierarchy = 'next_billing_date'


@admin.register(SubscriptionCycle)
class SubscriptionCycleAdmin(admin.ModelAdmin):
    list_display = ['subscription', 'start_date', 'end_date', 'credits_balance', 'is_active']
    list_filter = ['is_active', 'start_date']
    search_fields = ['subscription__player__name']
    autocomplete_fields = ['subscription']
    date_hierarchy = 'start_date'


@admin.register(ExtraCreditPurchase)
class ExtraCreditPurchaseAdmin(admin.ModelAdmin):
    list_display = ['player', 'credits_amount', 'price_paid', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['player__name', 'asaas_payment_id']
    autocomplete_fields = ['player']
    date_hierarchy = 'created_at'


@admin.register(TemporaryGuest)
class TemporaryGuestAdmin(admin.ModelAdmin):
    list_display = ['guest_player', 'sponsor', 'cycle_added', 'is_paid_guest', 'created_at']
    list_filter = ['is_paid_guest', 'created_at']
    search_fields = ['guest_player__name', 'sponsor__name']
    autocomplete_fields = ['sponsor', 'guest_player', 'cycle_added']
    date_hierarchy = 'created_at'
