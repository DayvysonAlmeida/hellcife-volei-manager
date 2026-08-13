from django.core.management.base import BaseCommand
from apps.subscriptions.models import UserSubscription
from apps.subscriptions.asaas_client import AsaasClient
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Valida e sincroniza o status das assinaturas ativas no banco de dados com a API do Asaas.'

    def handle(self, *args, **kwargs):
        client = AsaasClient()
        # Seleciona todas as assinaturas que estão ativas ou pendentes localmente, 
        # mas que possuem um ID do Asaas para consultar.
        subscriptions = UserSubscription.objects.filter(asaas_subscription_id__isnull=False).exclude(status='canceled')
        
        self.stdout.write(self.style.NOTICE(f'Encontradas {subscriptions.count()} assinaturas para validar...'))

        updated_count = 0
        for sub in subscriptions:
            try:
                asaas_data = client.get_subscription(sub.asaas_subscription_id)
                asaas_status = asaas_data.get('status')
                
                # Mapeamento básico de status do Asaas para o status local
                # Status no Asaas: ACTIVE, INACTIVE, EXPIRED, OVERDUE, etc.
                new_status = sub.status
                
                if asaas_status == 'ACTIVE':
                    new_status = 'active'
                elif asaas_status == 'OVERDUE':
                    new_status = 'past_due'
                elif asaas_status in ['INACTIVE', 'EXPIRED', 'DELETED']:
                    new_status = 'canceled'
                
                if sub.status != new_status:
                    self.stdout.write(
                        self.style.WARNING(
                            f'Assinatura {sub.id} (Player {sub.player.id}): Status alterado de {sub.status} para {new_status}'
                        )
                    )
                    sub.status = new_status
                    sub.save()
                    updated_count += 1
                else:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Assinatura {sub.id} (Player {sub.player.id}): Status sincronizado ({sub.status})'
                        )
                    )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'Erro ao consultar assinatura {sub.id} no Asaas: {str(e)}'
                    )
                )

        self.stdout.write(self.style.SUCCESS(f'Validação concluída! {updated_count} assinaturas atualizadas.'))
