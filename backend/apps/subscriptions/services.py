from decimal import Decimal
from django.utils import timezone
from django.db import models, transaction
from .models import UserSubscription, SubscriptionCycle, ExtraCreditPurchase
from apps.attendance.models import GameDay, Attendance

class SubscriptionService:
    @staticmethod
    def get_current_cycle(player):
        """Retorna o ciclo ativo atual do jogador, ou None se não houver."""
        try:
            subscription = UserSubscription.objects.get(player=player, status='active')
            # Verifica se existe um ciclo válido para a data de hoje
            today = timezone.localdate()
            cycle = subscription.cycles.filter(is_active=True, start_date__lte=today, end_date__gte=today).first()
            return cycle
        except UserSubscription.DoesNotExist:
            return None

    @staticmethod
    def get_total_credits_available(player):
        """Retorna o total de créditos disponíveis (plano + avulsos)."""
        total = getattr(player, 'standalone_credits', Decimal('0.0'))
        cycle = SubscriptionService.get_current_cycle(player)
        if cycle:
            total += cycle.credits_balance
        return total

    @staticmethod
    def add_extra_credits(player, amount, price_paid, asaas_payment_id=None):
        """Adiciona créditos avulsos ao ciclo atual do jogador."""
        cycle = SubscriptionService.get_current_cycle(player)
        if not cycle:
            raise ValueError("Jogador não possui um ciclo ativo para receber créditos.")
            
        with transaction.atomic():
            ExtraCreditPurchase.objects.create(
                player=player,
                cycle=cycle,
                credits_amount=amount,
                price_paid=price_paid,
                asaas_payment_id=asaas_payment_id
            )
            cycle.credits_balance += Decimal(str(amount))
            cycle.save()

    @staticmethod
    def has_enough_credits(player, amount):
        """Verifica se o jogador tem créditos suficientes."""
        return SubscriptionService.get_total_credits_available(player) >= amount
        
    @staticmethod
    def check_priority_access(player, gameday):
        """
        Verifica se o jogador tem acesso na janela de prioridade de 24h.
        Retorna: (pode_acessar, usa_prioridade_do_ciclo)
        """
        base_time = gameday.published_at if getattr(gameday, 'published_at', None) else gameday.created_at
        time_diff = timezone.now() - base_time
        is_priority_window = time_diff.total_seconds() < 86400 # 24 horas
        
        if not is_priority_window:
            return True, False # Lista aberta para todos, não consome prioridade
            
        cycle = SubscriptionService.get_current_cycle(player)
        if not cycle:
            return False, False # Não assinantes ou sem ciclo não entram nas 24h iniciais
            
        plan = cycle.subscription.plan
        if plan.has_unlimited_priority:
            return True, True # Acesso concedido (ilimitado)
            
        if cycle.priorities_used < plan.priorities:
            return True, True # Acesso concedido (tem sobrando)
            
        return False, False

    @staticmethod
    def process_attendance_checkin(player, gameday):
        """
        Valida regras de negócio e debita créditos/prioridade.
        Retorna: (credits_used, used_priority)
        Deve ser chamado de dentro de uma transaction.atomic() na view.
        """
        uses_priority = False
            
        credit_cost = gameday.credit_cost
        if not SubscriptionService.has_enough_credits(player, credit_cost):
            raise ValueError(f"Créditos insuficientes. Você precisa de {credit_cost} créditos.")
            
        cycle = SubscriptionService.get_current_cycle(player)
        remaining_to_debit = Decimal(str(credit_cost))
        
        if cycle and cycle.credits_balance > 0:
            if cycle.credits_balance >= remaining_to_debit:
                cycle.credits_balance -= remaining_to_debit
                remaining_to_debit = Decimal('0.0')
            else:
                remaining_to_debit -= cycle.credits_balance
                cycle.credits_balance = Decimal('0.0')
            
        if remaining_to_debit > 0:
            player.standalone_credits -= remaining_to_debit
            player.save(update_fields=['standalone_credits'])
        
        # Debita prioridade (se aplicável e se não for infinita)
        if cycle and uses_priority and not cycle.subscription.plan.has_unlimited_priority:
            cycle.priorities_used += 1
            
        if cycle:
            cycle.save()
        
        return credit_cost, uses_priority

    @staticmethod
    def refund_attendance(player, attendance):
        """Estorna os créditos e prioridade quando o usuário sai da lista (cancelamento válido)."""
        with transaction.atomic():
            if attendance.credits_used > 0:
                cycle = SubscriptionService.get_current_cycle(player)
                if cycle:
                    cycle.credits_balance += attendance.credits_used
                    cycle.save()
                else:
                    player.standalone_credits += attendance.credits_used
                    player.save(update_fields=['standalone_credits'])
                attendance.credits_used = Decimal('0.0')
                
            if attendance.used_priority:
                cycle = SubscriptionService.get_current_cycle(player)
                if cycle and cycle.priorities_used > 0:
                    cycle.priorities_used -= 1
                    cycle.save()
                attendance.used_priority = False
                
            attendance.save()

    @staticmethod
    def renew_cycle(subscription):
        """Cria um novo ciclo de 30 dias para a assinatura."""
        today = timezone.localdate()
        from dateutil.relativedelta import relativedelta
        import datetime
        
        # Encontra o último ciclo ativo
        last_active = subscription.cycles.filter(is_active=True).order_by('-end_date').first()
        
        if last_active and last_active.end_date > today:
            # Se ainda tem ciclo ativo, o novo ciclo começará no dia seguinte ao vencimento do atual
            start_date = last_active.end_date + datetime.timedelta(days=1)
        else:
            # Se não tem ou já venceu, desativa todos e começa hoje
            subscription.cycles.update(is_active=False)
            start_date = today
            
        end_date = start_date + relativedelta(months=1)
        
        cycle = SubscriptionCycle.objects.create(
            subscription=subscription,
            start_date=start_date,
            end_date=end_date,
            credits_balance=subscription.plan.credits,
            is_active=True
        )
        return cycle
