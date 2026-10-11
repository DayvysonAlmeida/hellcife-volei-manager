import hmac
from decimal import Decimal, InvalidOperation
from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
from django.db import IntegrityError
from django.utils import timezone
from datetime import timedelta
from apps.core.permissions import IsAdminOrModerator
from .models import Plan, UserSubscription, AsaasCustomer, ExtraCreditPurchase, SubscriptionCycle
from .serializers import PlanSerializer, UserSubscriptionSerializer
from .services import SubscriptionService
from .asaas_client import AsaasClient

class PlanViewSet(viewsets.ModelViewSet):
    serializer_class = PlanSerializer

    def get_queryset(self):
        user = self.request.user
        if getattr(user, 'profile', '') in ['admin', 'moderator'] or getattr(user, 'is_staff', False):
            return Plan.objects.all()
        return Plan.objects.filter(is_active=True)

    def get_permissions(self):
        from rest_framework.permissions import AllowAny, IsAuthenticated
        from apps.core.permissions import IsAdminOrModerator
        if self.action in ['list', 'retrieve', 'subscribe']:
            return [IsAuthenticated()]
        return [IsAdminOrModerator()]

    @action(detail=True, methods=['post'])
    def subscribe(self, request, pk=None):
        plan = self.get_object()
        player = getattr(request.user, 'player_profile', None)
        if not player:
            return Response({'error': 'Perfil de jogador não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        
        cpf = request.data.get('cpf')
        if not cpf:
            return Response({'error': 'CPF é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)
            
        existing_sub = UserSubscription.objects.filter(player=player, status__in=['active', 'PENDING_PAYMENT']).first()
        if existing_sub and existing_sub.plan == plan:
            return Response({'error': f'Você já possui o plano {plan.name} ativo.'}, status=status.HTTP_400_BAD_REQUEST)

        client = AsaasClient()
        
        if existing_sub and existing_sub.asaas_subscription_id:
            try:
                client.cancel_subscription(existing_sub.asaas_subscription_id)
            except Exception as e:
                print("Aviso: Falha ao cancelar assinatura antiga no Asaas:", str(e))
        
        # 1. Recuperar ou criar Customer
        try:
            customer = AsaasCustomer.objects.get(player=player)
        except AsaasCustomer.DoesNotExist:
            customer = AsaasCustomer(player=player)
            
        if not customer.customer_id:
            try:
                asaas_cust = client.create_customer(name=player.name, cpfCnpj=cpf, email=request.user.email)
                customer.customer_id = asaas_cust['id']
                customer.cpf = cpf
                customer.save()
            except IntegrityError:
                return Response({'error': 'Este CPF já está sendo utilizado por outra conta no sistema.'}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback; traceback.print_exc()
                error_str = str(e).lower()
                if 'cpf' in error_str or 'cnpj' in error_str:
                    return Response({'error': 'O CPF informado já está vinculado a outra conta no Asaas.'}, status=status.HTTP_400_BAD_REQUEST)
                return Response({'error': f'Erro ao criar cliente no Asaas: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Criar Subscrição no Asaas
        next_due_date = (timezone.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        try:
            sub_data = client.create_subscription(
                customer_id=customer.customer_id, 
                value=float(plan.price), 
                nextDueDate=next_due_date, 
                description=f'Assinatura {plan.name} - {player.name}'
            )
        except Exception as e:
            import traceback; traceback.print_exc()
            return Response({'error': f'Erro ao criar assinatura no Asaas: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Criar Subscrição Local
        subscription, _ = UserSubscription.objects.update_or_create(
            player=player,
            defaults={
                'plan': plan,
                'status': 'PENDING_PAYMENT',
                'next_billing_date': next_due_date,
                'asaas_subscription_id': sub_data['id']
            }
        )

        # 4. Pegar PIX QR Code do Asaas
        return Response({
            'message': 'Assinatura criada com sucesso. Aguardando pagamento.',
            'subscription_id': subscription.id,
            'payment_url': sub_data.get('invoiceUrl')
        }, status=status.HTTP_201_CREATED)

class UserSubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = UserSubscriptionSerializer

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        # Atletas só podem ler a própria assinatura e comprar créditos.
        # Qualquer alteração direta no registro é restrita a admin/moderador.
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrModerator()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or getattr(user, 'profile', '') in ['admin', 'moderator']:
            return UserSubscription.objects.all()
        return UserSubscription.objects.filter(player__user=user)
        
    @action(detail=False, methods=['get'])
    def my_subscription(self, request):
        player = getattr(request.user, 'player_profile', None)
        if not player:
            return Response({'error': 'Perfil de jogador não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        from apps.subscriptions.services import SubscriptionService
        
        subscription = UserSubscription.objects.filter(player=player).exclude(status='canceled').order_by('-id').first()
        if subscription:
            serializer = self.get_serializer(subscription)
            data = serializer.data
        else:
            data = {
                'plan': None, 
                'status': 'inactive', 
                'current_cycle': None
            }
            
        data['total_credits_available'] = SubscriptionService.get_total_credits_available(player)
        data['standalone_credits'] = player.standalone_credits
        return Response(data)
            
    @action(detail=False, methods=['post'])
    def buy_extra_credits(self, request):
        player = getattr(request.user, 'player_profile', None)
        if not player:
             return Response({'error': 'Perfil de jogador não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
             
        # Valida a quantidade enviada pelo cliente
        try:
            amount = Decimal(str(request.data.get('amount', 1)))
        except (InvalidOperation, ValueError):
            return Response({'error': 'Quantidade de créditos inválida.'}, status=status.HTTP_400_BAD_REQUEST)

        if (
            not amount.is_finite()
            or amount <= 0
            or amount > Decimal('20')
            or amount != amount.quantize(Decimal('0.1'))
        ):
            return Response(
                {'error': 'Quantidade de créditos inválida (permitido de 0.1 a 20).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # O preço é SEMPRE calculado no servidor; o valor enviado pelo cliente é ignorado.
        price_paid = (amount * Decimal(str(settings.EXTRA_CREDIT_UNIT_PRICE))).quantize(Decimal('0.01'))
        cpf = request.data.get('cpf')

        client = AsaasClient()
        try:
            customer = AsaasCustomer.objects.get(player=player)
        except AsaasCustomer.DoesNotExist:
            customer = AsaasCustomer(player=player)
            
        if not customer.customer_id:
            if not cpf:
                return Response({'error': 'CPF é obrigatório para a primeira compra.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                asaas_cust = client.create_customer(name=player.name, cpfCnpj=cpf, email=request.user.email)
                customer.customer_id = asaas_cust['id']
                customer.cpf = cpf
                customer.save()
            except IntegrityError:
                return Response({'error': 'Este CPF já está sendo utilizado por outra conta no sistema.'}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback; traceback.print_exc()
                error_str = str(e).lower()
                if 'cpf' in error_str or 'cnpj' in error_str:
                    return Response({'error': 'O CPF informado já está vinculado a outra conta no Asaas.'}, status=status.HTTP_400_BAD_REQUEST)
                return Response({'error': f'Erro Asaas ao criar cliente: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        due_date = timezone.now().strftime('%Y-%m-%d')
        try:
            pay_data = client.create_payment(
                customer_id=customer.customer_id,
                value=float(price_paid),
                dueDate=due_date,
                description=f'Compra de {amount} créditos avulsos - {player.name}'
            )
            qr_data = client.get_pix_qr_code(pay_data['id'])
        except Exception as e:
            import traceback; traceback.print_exc()
            return Response({'error': f'Erro Asaas: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        
        cycle = SubscriptionCycle.objects.filter(subscription__player=player, is_active=True).first()
        ExtraCreditPurchase.objects.create(
            player=player,
            cycle=cycle,
            credits_amount=amount,
            price_paid=price_paid,
            asaas_payment_id=pay_data['id'],
            payment_url=pay_data.get('invoiceUrl'),
            pix_copy_paste=qr_data.get('payload'),
            status='PENDING'
        )
        return Response({
            'message': 'Cobrança PIX gerada com sucesso.',
            'payment_url': pay_data.get('invoiceUrl'),
            'pix_copy_paste': qr_data.get('payload'),
            'payment_id': pay_data.get('id')
        }, status=status.HTTP_201_CREATED)

class AsaasWebhookView(views.APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        # Autenticação do webhook: o Asaas envia o token configurado no painel
        # no header 'asaas-access-token'.
        expected_token = settings.ASAAS_WEBHOOK_TOKEN
        if expected_token:
            received_token = request.headers.get('asaas-access-token', '')
            if not hmac.compare_digest(received_token.encode(), expected_token.encode()):
                return Response({'error': 'Token inválido.'}, status=status.HTTP_401_UNAUTHORIZED)
        elif not settings.DEBUG:
            # Em produção, sem token configurado, recusa tudo (fail closed).
            return Response({'error': 'Webhook não configurado.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        event = request.data.get('event')
        payment = request.data.get('payment', {})
        
        payment_id = payment.get('id')
        subscription_id = payment.get('subscription')

        if event == 'PAYMENT_RECEIVED':
            if subscription_id:
                try:
                    sub = UserSubscription.objects.get(asaas_subscription_id=subscription_id)
                    sub.status = 'active'
                    sub.save()
                    SubscriptionService.renew_cycle(sub)
                except UserSubscription.DoesNotExist:
                    pass
            else:
                try:
                    purchase = ExtraCreditPurchase.objects.get(asaas_payment_id=payment_id)
                    if purchase.status != 'PAID':
                        purchase.status = 'PAID'
                        purchase.save()
                        if purchase.cycle:
                            purchase.cycle.credits_balance += purchase.credits_amount
                            purchase.cycle.save()
                        else:
                            purchase.player.standalone_credits += purchase.credits_amount
                            purchase.player.save(update_fields=['standalone_credits'])
                except ExtraCreditPurchase.DoesNotExist:
                    pass
        elif event == 'PAYMENT_OVERDUE':
            if subscription_id:
                try:
                    sub = UserSubscription.objects.get(asaas_subscription_id=subscription_id)
                    sub.status = 'past_due'
                    sub.save()
                except UserSubscription.DoesNotExist:
                    pass
        elif event in ['PAYMENT_DELETED', 'PAYMENT_REFUNDED']:
            if subscription_id:
                try:
                    sub = UserSubscription.objects.get(asaas_subscription_id=subscription_id)
                    sub.status = 'canceled'
                    sub.save()
                except UserSubscription.DoesNotExist:
                    pass

        return Response({'status': 'ok'})


class FinanceDashboardView(views.APIView):
    def get_permissions(self):
        from apps.core.permissions import IsAdminOrModerator
        return [IsAdminOrModerator()]

    def get(self, request):
        now = timezone.now()
        current_month = now.month
        current_year = now.year

        active_subs = UserSubscription.objects.filter(status='active')
        total_plans_revenue = sum(sub.plan.price for sub in active_subs)

        pending_subs = UserSubscription.objects.filter(status='PENDING_PAYMENT')
        total_pending_revenue = sum(sub.plan.price for sub in pending_subs)

        extra_credits = ExtraCreditPurchase.objects.filter(
            status='PAID',
            created_at__month=current_month,
            created_at__year=current_year
        )
        total_extras_revenue = sum(ec.price_paid for ec in extra_credits)

        total_expenses = 1200.00

        total_revenue = float(total_plans_revenue + total_extras_revenue)
        balance = total_revenue - total_expenses

        return Response({
            'total_revenue': total_revenue,
            'total_plans_revenue': float(total_plans_revenue),
            'total_extras_revenue': float(total_extras_revenue),
            'total_pending_revenue': float(total_pending_revenue),
            'total_expenses': total_expenses,
            'balance': balance,
            'month': current_month,
            'year': current_year
        })
