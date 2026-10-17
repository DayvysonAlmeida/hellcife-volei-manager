from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q
from django.utils import timezone

from .models import GameDay, Attendance, AttendancePayment, CourtCheckin
from .payments import CircuitPaymentService
from . import finance
from .serializers import GameDaySerializer, GameDayListSerializer, AttendanceSerializer, BulkAttendanceSerializer, CourtCheckinSerializer
from apps.players.models import Player
from apps.core.permissions import IsAdminOrModerator


def _deny_unless_self(request, player_id):
    """
    Ações que mexem na inscrição/pagamento de alguém exigem login e só valem para o próprio
    atleta (ou admin/moderador). Retorna None se permitido, senão a Response de erro.
    """
    user = request.user
    if not user.is_authenticated:
        return Response({'detail': 'Entre na sua conta para fazer isso.'}, status=status.HTTP_401_UNAUTHORIZED)
    if getattr(user, 'profile', None) in ('admin', 'moderator'):
        return None
    if Player.objects.filter(id=player_id, user=user).exists():
        return None
    return Response({'detail': 'Você só pode fazer isso na sua própria inscrição.'}, status=status.HTTP_403_FORBIDDEN)


def _deny_if_linked_account(request, player_id):
    """
    Atleta com conta no app confirma pelo próprio login (ou pela organização).
    Quem não tem conta continua usando o link do grupo.
    """
    if Player.objects.filter(id=player_id, user__isnull=False).exists():
        return _deny_unless_self(request, player_id)
    return None


class GameDayViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_closed', 'is_published']
    ordering = ['-date']

    def get_queryset(self):
        qs = GameDay.objects.all()
        if self.request.query_params.get('active_only') == 'true':
            # Tolerância para madrugadas: circuitos de ontem se ainda for antes das 06:00
            now = timezone.localtime()
            min_date = now.date()
            if now.hour < 6:
                min_date = min_date - timezone.timedelta(days=1)
            qs = qs.filter(is_closed=False, date__gte=min_date)

        if self.action == 'list':
            # Para listagem: usar annotations ao invés de properties (evita N+1)
            return qs.annotate(
                _total_present=Count('attendances', filter=Q(attendances__present=True), distinct=True),
                _total_paid=Count('attendances', filter=Q(attendances__has_paid=True), distinct=True),
                _total_players=Count('attendances', distinct=True),
                _total_court_checkins=Count('court_checkins', distinct=True),
                _total_reserved=Count('attendances', distinct=True, filter=Q(attendances__is_reserved=True) & (
                    Q(attendances__payment_claimed=True)
                    | Q(attendances__reserved_until__isnull=True)
                    | Q(attendances__reserved_until__gt=timezone.now())
                )),
            ).order_by('-date')
        # Para detail: prefetch completo com os jogadores
        return qs.prefetch_related('attendances__player', 'attendances__payments')

    def get_serializer_class(self):
        if self.action == 'list':
            return GameDayListSerializer
        return GameDaySerializer

    def get_permissions(self):
        from rest_framework.permissions import AllowAny
        if self.action in ['checkin_info', 'public_checkin', 'cancel_checkin', 'claim_payment', 'public_add_guest']:
            return [AllowAny()]
        if self.action in [
            'create', 'update', 'partial_update', 'destroy', 'bulk_attendance', 'initialize', 'add_guest',
            'reorder_waitlist', 'toggle_attendance', 'toggle_payment', 'bulk_payment', 'promote_waitlist',
            'refresh_list', 'process_past_absences', 'confirm_payment', 'revert_payment', 'finance_summary',
        ]:
            return [IsAdminOrModerator()]
        return [IsAuthenticated()]

    def get_object(self):
        obj = super().get_object()
        # Reservas vencidas são liberadas sempre que o circuito é acessado (não há worker em segundo plano)
        if obj.requires_prepayment and CircuitPaymentService.expire_reservations(obj):
            obj = super().get_object()
        return obj

    def retrieve(self, request, *args, **kwargs):
        """Retorna o detalhe do GameDay. Se estiver aberto, auto-sincroniza jogadores novos ativos na lista."""
        instance = self.get_object()
        
        if not instance.is_closed:
            base_players = Player.objects.filter(is_guest=False, status='active')
            existing_attendances = set(instance.attendances.values_list('player_id', flat=True))
            
            new_attendances = []
            for p in base_players:
                if p.id not in existing_attendances:
                    new_attendances.append(Attendance(gameday=instance, player=p, present=False))
                    
            if new_attendances:
                Attendance.objects.bulk_create(new_attendances)
                # Recarrega a instância usando o queryset para prefetch correto
                instance = self.get_queryset().get(pk=instance.pk)
                
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='add-guest')
    def add_guest(self, request, pk=None):
        """Adiciona um convidado ao gameday."""
        gameday = self.get_object()
        
        name = request.data.get('name')
        main_position = request.data.get('main_position')
        invited_by = request.data.get('invited_by')
        gender = request.data.get('gender', 'M')

        if not name or not main_position:
            return Response({'detail': 'Nome e Posição são obrigatórios.'}, status=status.HTTP_400_BAD_REQUEST)

        existing_guest = Player.objects.filter(name=name, is_guest=True, attendances__gameday=gameday).first()
        if existing_guest:
            return Response({'detail': 'Um convidado com esse nome já está na lista deste dia.'}, status=status.HTTP_400_BAD_REQUEST)


        # Create Guest Player
        guest_player = Player.objects.create(
            name=name,
            main_position=main_position,
            gender=gender,
            is_guest=True,
            invited_by=invited_by,
            status='active'
        )

        # Create Attendance (Convidados vão SEMPRE para a fila de espera)
        from django.utils import timezone
        Attendance.objects.create(
            gameday=gameday,
            player=guest_player,
            present=False,
            is_waitlist=True,
            waitlist_joined_at=timezone.now()
        )
        detail_msg = 'Convidado adicionado com sucesso!'

        gameday.refresh_from_db()
        return Response({'detail': detail_msg})

    def perform_create(self, serializer):
        gameday = serializer.save(created_by=self.request.user)
        # Cria registros de presença apenas para jogadores ATIVOS (inativos não entram na lista automática)
        base_players = Player.objects.filter(is_guest=False, status='active')
        Attendance.objects.bulk_create([
            Attendance(gameday=gameday, player=p, present=False)
            for p in base_players
        ])

        if gameday.is_published:
            gameday.published_at = timezone.now()
            gameday.save(update_fields=['published_at'])
            self._send_publish_notification(gameday)

    def _send_publish_notification(self, gameday):
        from apps.core.models import User
        from apps.notifications.models import Notification
        date_str = gameday.date.strftime('%d/%m/%Y')
        users = User.objects.filter(profile='player', is_active=True)
        notifications = [
            Notification(
                user=u,
                title='Circuito Liberado! 🏐',
                message=f'A lista para o circuito do dia {date_str} já foi aberta. Entre para confirmar sua presença ou tirar sua falta!',
                type='circuit'
            ) for u in users
        ]
        if notifications:
            Notification.objects.bulk_create(notifications)

    @staticmethod
    def _reservation_payload(attendance, detail):
        return {
            'present': False,
            'is_waitlist': False,
            'is_reserved': True,
            'reserved_until': attendance.reserved_until,
            'amount_due': attendance.amount_due,
            'pix_key': attendance.gameday.pix_key,
            'player_id': attendance.player_id,
            'detail': detail,
        }

    def _check_and_notify_full_circuit(self, gameday):
        if gameday.max_players and not gameday.is_full_notified:
            if gameday.occupied_spots >= gameday.max_players:
                from apps.notifications.models import Notification
                gameday.is_full_notified = True
                gameday.save(update_fields=['is_full_notified'])
                
                present_users = [
                    att.player.user for att in gameday.attendances.filter(present=True).select_related('player__user')
                    if getattr(att.player, 'user', None) and att.player.user.is_active
                ]
                
                notifications = [
                    Notification(
                        user=u,
                        title='Circuito Fechado! 🛑',
                        message='O circuito fechou as vagas! Caso não tenha realizado o pagamento, faça agora para garantir a sua vaga.',
                        type='circuit'
                    ) for u in present_users
                ]
                if notifications:
                    Notification.objects.bulk_create(notifications)

    def perform_update(self, serializer):
        instance = self.get_object()
        was_published = instance.is_published
        was_closed = instance.is_closed
        old_price = instance.effective_price_per_person

        gameday = serializer.save()

        # Circuito encerrado agora: recalcula faltas (mesma regra do botão "Sincronizar faltas")
        if not was_closed and gameday.is_closed:
            sync_absences_logic()

        if gameday.effective_price_per_person != old_price:
            CircuitPaymentService.update_pending_amounts(gameday)

        # Envia notificação APENAS se o status is_published mudou de False para True
        if not was_published and gameday.is_published:
            gameday.published_at = timezone.now()
            gameday.save(update_fields=['published_at'])
            self._send_publish_notification(gameday)

        # Removido o _process_attendance_and_absences para usar apenas o sync_absences_logic() via Sincronizar Faltas ou Lock.

    @action(detail=True, methods=['post'], url_path='bulk-attendance')
    def bulk_attendance(self, request, pk=None):
        """Marca presença em bulk: recebe lista de player_ids presentes."""
        gameday = self.get_object()
        if gameday.is_closed:
            return Response({'detail': 'Circuito encerrado. Não é possível alterar a lista.'}, status=status.HTTP_400_BAD_REQUEST)
            
        present_ids = request.data.get('present_player_ids', [])

        # Marca todos como ausente primeiro
        Attendance.objects.filter(gameday=gameday).update(present=False)

        # Marca os presentes
        updated = Attendance.objects.filter(gameday=gameday, player_id__in=present_ids).update(present=True)

        # Cria registros se não existirem
        existing_player_ids = set(
            Attendance.objects.filter(gameday=gameday).values_list('player_id', flat=True)
        )
        new_players = [pid for pid in present_ids if pid not in existing_player_ids]
        if new_players:
            Attendance.objects.bulk_create([
                Attendance(gameday=gameday, player_id=pid, present=True)
                for pid in new_players
            ])

        gameday.refresh_from_db()
        return Response({
            'detail': f'{gameday.total_present} jogadores marcados como presentes.',
            'total_present': gameday.total_present,
        })

    @action(detail=True, methods=['post'], url_path='bulk-payment')
    def bulk_payment(self, request, pk=None):
        """Marca pagamento em bulk para todos os presentes na lista."""
        gameday = self.get_object()
        if gameday.is_closed:
            return Response({'detail': 'Circuito encerrado. Não é possível alterar a lista.'}, status=status.HTTP_400_BAD_REQUEST)
            
        action_type = request.data.get('action_type') # 'check_all' ou 'uncheck_all'
        
        if action_type == 'check_all':
            for att in gameday.attendances.filter(present=True, has_paid=False):
                CircuitPaymentService.confirm_payment(att, AttendancePayment.METHOD_PIX_MANUAL, confirmed_by=request.user)
        elif action_type == 'uncheck_all':
            for att in gameday.attendances.filter(present=True, has_paid=True):
                CircuitPaymentService.revert_payment(att)
            
        return Response({'detail': 'Pagamentos atualizados em lote com sucesso.'})

    @action(detail=False, methods=['post'], url_path='process-past-absences')
    def process_past_absences(self, request):
        """Processa as faltas retroativamente agrupando por DIA. Zera se o jogador foi a qualquer circuito no dia."""
        days_count = sync_absences_logic()
        return Response({'detail': f'Processamento concluído! {days_count} dias analisados.'})

    @action(detail=False, methods=['get'], url_path='general-stats')
    def general_stats(self, request):
        """Retorna estatísticas gerais de frequência (estilo planilha) para os atletas."""
        from django.db.models import Count
        from django.utils import timezone
        
        # Obter todos os GameDays finalizados (agrupados por data para não duplicar circuitos do mesmo dia)
        finished_gamedays = GameDay.objects.filter(is_closed=True).values('date').distinct()
        finished_dates = sorted([g['date'] for g in finished_gamedays])
        
        players_qs = Player.objects.filter(is_guest=False, status__in=['active', 'inactive'])
        
        # Puxar todos os check-ins na quadra e no-shows para não fazer queries em loop
        court_checkins = CourtCheckin.objects.filter(gameday__is_closed=True).values('player_id', 'gameday__date')
        checkins_by_player = {}
        for c in court_checkins:
            pid = c['player_id']
            date = c['gameday__date']
            if pid not in checkins_by_player:
                checkins_by_player[pid] = set()
            checkins_by_player[pid].add(date)
            
        no_shows = Attendance.objects.filter(was_no_show=True).values('player_id').annotate(count=Count('id'))
        no_shows_map = {n['player_id']: n['count'] for n in no_shows}
        
        stats = []
        for p in players_qs:
            # Quantos dias de jogo ocorreram DESDE que o jogador entrou no sistema?
            player_possible_dates = [d for d in finished_dates if d >= p.created_at.date()]
            total_possible = len(player_possible_dates)
            
            presences = len(checkins_by_player.get(p.id, set()))
            player_no_shows = no_shows_map.get(p.id, 0)
            
            rate = int((presences / total_possible) * 100) if total_possible > 0 else 0
            
            # Request para pegar URL absoluta da foto
            avatar_url = p.avatar.url if p.avatar else None
            if avatar_url and request is not None:
                avatar_url = request.build_absolute_uri(avatar_url)
            
            stats.append({
                'id': p.id,
                'name': p.display_name,
                'status': p.status,
                'avatar_url': avatar_url,
                'total_gamedays': total_possible,
                'presences': presences,
                'no_shows': player_no_shows,
                'attendance_rate': rate,
                'consecutive_absences': p.consecutive_absences
            })
            
        # Ordenar por taxa de assiduidade (maior para menor) e depois por total de presenças
        stats.sort(key=lambda x: (x['attendance_rate'], x['presences']), reverse=True)
        return Response(stats)

    @action(detail=True, methods=['post'], url_path='refresh-list')
    def refresh_list(self, request, pk=None):
        """Atualiza a lista de presença com novos jogadores cadastrados (apenas ativos, excluindo convidados de outros dias)."""
        gameday = self.get_object()
        base_players = Player.objects.filter(is_guest=False, status='active')
        existing_attendances = set(gameday.attendances.values_list('player_id', flat=True))
        
        new_attendances = []
        for p in base_players:
            if p.id not in existing_attendances:
                new_attendances.append(Attendance(gameday=gameday, player=p, present=False))
                
        if new_attendances:
            Attendance.objects.bulk_create(new_attendances)
            
        gameday.refresh_from_db()
        self._check_and_notify_full_circuit(gameday)
        return Response({'detail': f'{len(new_attendances)} novos jogadores adicionados à lista.'})

    @action(detail=True, methods=['patch'], url_path='toggle/(?P<player_id>[^/.]+)')
    def toggle_attendance(self, request, pk=None, player_id=None):
        """Toggle de presença de um jogador específico."""
        from django.utils import timezone
        gameday = self.get_object()
        if gameday.is_closed:
            return Response({'detail': 'Circuito encerrado. Não é possível alterar a lista.'}, status=status.HTTP_400_BAD_REQUEST)
            
        attendance, _ = Attendance.objects.get_or_create(
            gameday=gameday, player_id=player_id
        )
        
        if attendance.present:
            attendance.present = False
            # Estorno de Crédito
            from apps.subscriptions.services import SubscriptionService
            SubscriptionService.refund_attendance(attendance.player, attendance)
            attendance.used_credit = False
            attendance.has_paid = False
            attendance.save()
        elif attendance.is_reserved:
            CircuitPaymentService.release(attendance)
        elif attendance.is_waitlist:
            attendance.is_waitlist = False
            attendance.waitlist_joined_at = None
            attendance.save()
        else:
            if attendance.player.is_guest:
                attendance.is_waitlist = True
                attendance.waitlist_joined_at = timezone.now()
                attendance.present = False
                attendance.save()
            elif gameday.max_players and gameday.occupied_spots >= gameday.max_players:
                attendance.is_waitlist = True
                attendance.waitlist_joined_at = timezone.now()
                attendance.present = False
                attendance.save()
            else:
                attendance.present = True
                attendance.is_waitlist = False
                attendance.waitlist_joined_at = None
                
                # Uso de Crédito pelo Admin Toggle (só em circuitos que cobram créditos)
                if not attendance.used_credit and gameday.credit_cost > 0:
                    from apps.subscriptions.services import SubscriptionService
                    from django.db import transaction
                    try:
                        with transaction.atomic():
                            credit_cost, used_priority = SubscriptionService.process_attendance_checkin(attendance.player, gameday)
                            attendance.credits_used = credit_cost
                            attendance.used_priority = used_priority
                            attendance.used_credit = True
                            attendance.has_paid = True
                    except ValueError:
                        # Se admin forçar, não impede, mas não debita (pois não tem saldo)
                        pass
                        
                attendance.save()
                self._check_and_notify_full_circuit(gameday)
                
        return Response({'present': attendance.present, 'is_waitlist': attendance.is_waitlist, 'player_id': player_id})

    @action(detail=True, methods=['patch'], url_path='toggle-payment/(?P<player_id>[^/.]+)')
    def toggle_payment(self, request, pk=None, player_id=None):
        """Toggle de pagamento de um jogador específico."""
        gameday = self.get_object()
        if gameday.is_closed:
            return Response({'detail': 'Circuito encerrado. Não é possível alterar a lista.'}, status=status.HTTP_400_BAD_REQUEST)
            
        attendance, _ = Attendance.objects.get_or_create(
            gameday=gameday, player_id=player_id
        )
        if attendance.has_paid:
            CircuitPaymentService.revert_payment(attendance)
        else:
            CircuitPaymentService.confirm_payment(
                attendance, AttendancePayment.METHOD_PIX_MANUAL, confirmed_by=request.user
            )
        attendance.refresh_from_db()
        return Response({'has_paid': attendance.has_paid, 'player_id': player_id})

    @action(detail=True, methods=['get'], url_path='checkin-info')
    def checkin_info(self, request, pk=None):
        """Retorna informações resumidas para a tela pública de check-in."""
        from apps.players.filters import _latest_overall_subquery
        
        gameday = self.get_object()
        active_players = Player.objects.filter(status='active').annotate(
            annotated_overall=_latest_overall_subquery()
        ).order_by('name')
        
        attendances = gameday.attendances.all()
        att_map = {a.player_id: a for a in attendances}
        
        players_data = []
        for p in active_players:
            att = att_map.get(p.id)
            players_data.append({
                'id': p.id,
                'name': p.display_name,
                'present': att.present if att else False,
                'is_waitlist': att.is_waitlist if att else False,
                'waitlist_joined_at': att.waitlist_joined_at.isoformat() if att and att.waitlist_joined_at else None,
                'latest_overall': round(p.annotated_overall, 2) if getattr(p, 'annotated_overall', None) else 0.0,
                'has_paid': att.has_paid if att else False,
                'payment_claimed': att.payment_claimed if att else False,
                'used_credit': att.used_credit if att else False,
                'is_priority': att.is_priority if att else False,
                'is_reserved': att.is_reserved if att else False,
                'reserved_until': att.reserved_until if att else None,
                'amount_due': att.amount_due if att else None,
                'main_position': p.main_position,
                'is_guest': p.is_guest,
                'invited_by': p.invited_by,
                'has_account': p.user_id is not None,
                'avatar_url': request.build_absolute_uri(p.avatar.url) if p.avatar else None
            })
            
        return Response({
            'gameday': {
                'id': gameday.id,
                'date': gameday.date,
                'location': gameday.location,
                'description': gameday.description,
                'total_present': sum(1 for a in attendances if a.present),
                'max_players': gameday.max_players,
                'court_price': gameday.court_price,
                'pix_key': gameday.pix_key,
                'credit_cost': gameday.credit_cost,
                'pricing_type': gameday.pricing_type,
                'price_per_person': gameday.effective_price_per_person,
                'requires_prepayment': gameday.requires_prepayment,
                'reservation_hold_minutes': gameday.reservation_hold_minutes,
                'total_reserved': gameday.total_reserved,
                'time': gameday.time,
                'time_end': gameday.time_end,
                'is_closed': gameday.is_closed
            },
            'players': players_data
        })

    @action(detail=True, methods=['post'], url_path='public-checkin')
    def public_checkin(self, request, pk=None):
        """Endpoint público para o próprio jogador fazer check-in."""
        from django.utils import timezone
        gameday = self.get_object()
        
        if gameday.is_closed:
            return Response({'detail': 'As inscrições para este circuito já foram encerradas pela organização.'}, status=status.HTTP_400_BAD_REQUEST)

        player_id = request.data.get('player_id')
        
        if not player_id:
            return Response({'detail': 'ID do jogador não fornecido.'}, status=status.HTTP_400_BAD_REQUEST)
        if denied := _deny_if_linked_account(request, player_id):
            return denied

        attendance, _ = Attendance.objects.get_or_create(
            gameday=gameday, player_id=player_id
        )

        if attendance.present:
            return Response({'detail': 'Você já confirmou sua presença! Para cancelar, fale com a organização.'}, status=status.HTTP_400_BAD_REQUEST)

        if attendance.is_reserved:
            return Response(self._reservation_payload(attendance, 'Sua vaga já está reservada. Falta só o pagamento!'))

        if attendance.player.status == 'inactive':
            return Response(
                {'detail': 'Sua conta está inativa por excesso de faltas. Procure a administração para regularizar.'},
                status=status.HTTP_403_FORBIDDEN,
            )
            
        from apps.subscriptions.services import SubscriptionService
        from django.db import transaction
        
        # Prioridade de 24h removida conforme regra de negócio (todos são membros)
        uses_priority = False
            
        if attendance.player.is_guest:
            if not attendance.is_waitlist:
                attendance.is_waitlist = True
                attendance.waitlist_joined_at = timezone.now()
                attendance.save()
            return Response({
                'present': False, 
                'is_waitlist': True, 
                'player_id': player_id,
                'detail': 'Como convidado, você foi para a Fila de Espera (Prioridade dos membros).'
            })
            
        if gameday.max_players and gameday.occupied_spots >= gameday.max_players:
            if not attendance.is_waitlist:
                attendance.is_waitlist = True
                attendance.waitlist_joined_at = timezone.now()
                if uses_priority:
                    # Se tiver prioridade, gasta apenas prioridade para furar fila, sem gastar crédito ainda
                    cycle = SubscriptionService.get_current_cycle(attendance.player)
                    if cycle and not cycle.subscription.plan.has_unlimited_priority:
                        cycle.priorities_used += 1
                        cycle.save()
                    attendance.is_priority = True
                    attendance.used_priority = True
                attendance.save()
            detail_msg = 'Lista cheia! Você entrou na Fila de Espera VIP (Fura-Fila).' if attendance.is_priority else 'Lista de presença cheia! Você foi adicionado à Fila de Espera.'
            return Response({
                'present': False, 
                'is_waitlist': True, 
                'player_id': player_id,
                'detail': detail_msg
            })
                
        uses_credits = gameday.credit_cost > 0
        has_credit = uses_credits and SubscriptionService.has_enough_credits(attendance.player, gameday.credit_cost)

        # Circuito com pagamento antecipado: reserva a vaga até o pagamento ser confirmado
        if CircuitPaymentService.needs_payment(gameday) and not has_credit:
            CircuitPaymentService.reserve(attendance)
            return Response(self._reservation_payload(attendance, 'Vaga reservada! Faça o pagamento para confirmar sua presença.'))

        # Debita créditos (se o circuito cobra créditos) e salva presença confirmada
        try:
            with transaction.atomic():
                if uses_credits:
                    credit_cost, used_priority = SubscriptionService.process_attendance_checkin(attendance.player, gameday)
                    attendance.credits_used = credit_cost
                    attendance.used_priority = used_priority
                    attendance.used_credit = True
                    attendance.has_paid = True

                attendance.present = True
                attendance.is_waitlist = False
                attendance.waitlist_joined_at = None
                attendance.save()
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        self._check_and_notify_full_circuit(gameday)
        
        return Response({'present': attendance.present, 'is_waitlist': attendance.is_waitlist, 'player_id': player_id})

    @action(detail=True, methods=['post'], url_path='cancel-checkin')
    def cancel_checkin(self, request, pk=None):
        """Endpoint público para o atleta cancelar seu check-in."""
        gameday = self.get_object()
        
        if gameday.is_closed:
            return Response({'detail': 'Este circuito já foi encerrado pela organização.'}, status=status.HTTP_400_BAD_REQUEST)

        player_id = request.data.get('player_id')
        
        if not player_id:
            return Response({'detail': 'ID do jogador não fornecido.'}, status=status.HTTP_400_BAD_REQUEST)
        if denied := _deny_unless_self(request, player_id):
            return denied

        attendance = Attendance.objects.filter(gameday=gameday, player_id=player_id).first()
        
        if not attendance:
            return Response({'detail': 'Nenhuma inscrição encontrada para este jogador.'}, status=status.HTTP_400_BAD_REQUEST)

        if attendance.is_reserved:
            CircuitPaymentService.release(attendance)
            return Response({'detail': 'Sua reserva foi cancelada.', 'player_id': player_id})

        if gameday.court_price and gameday.court_price > 0 and attendance.present:
            return Response({'detail': 'Este é um circuito pago. Para cancelar sua presença confirmada, fale com a organização.'}, status=status.HTTP_400_BAD_REQUEST)

        attendance.present = False
        attendance.is_waitlist = False
        attendance.waitlist_joined_at = None
        
        # Estorno de Crédito e Prioridade
        from apps.subscriptions.services import SubscriptionService
        SubscriptionService.refund_attendance(attendance.player, attendance)
        attendance.used_credit = False
        attendance.has_paid = False
        attendance.is_priority = False
        attendance.save()
        
        return Response({'detail': 'Sua inscrição foi cancelada com sucesso.', 'player_id': player_id})

    @action(detail=True, methods=['post'], url_path='public-add-guest')
    def public_add_guest(self, request, pk=None):
        """Endpoint público para atleta adicionar convidado."""
        from django.utils import timezone
        gameday = self.get_object()
        
        if gameday.is_closed:
            return Response({'detail': 'As inscrições para este circuito já foram encerradas pela organização.'}, status=status.HTTP_400_BAD_REQUEST)

        player_id = request.data.get('player_id')
        name = request.data.get('name')
        main_position = request.data.get('main_position', 'Outro')
        use_free_guest = request.data.get('use_free_guest', False)
        
        if not player_id or not name:
            return Response({'detail': 'Jogador e Nome do convidado são obrigatórios.'}, status=status.HTTP_400_BAD_REQUEST)
        denied = _deny_unless_self(request, player_id) if use_free_guest else _deny_if_linked_account(request, player_id)
        if denied:
            return denied
            
        inviting_player = Player.objects.filter(id=player_id).first()
        if not inviting_player:
            return Response({'detail': 'Jogador não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            
        existing_guest = Player.objects.filter(name=name, is_guest=True, attendances__gameday=gameday).first()
        if existing_guest:
            return Response({'detail': 'Um convidado com esse nome já está na lista deste dia.'}, status=status.HTTP_400_BAD_REQUEST)

        # Tratar uso da Cota Grátis
        from apps.subscriptions.models import SubscriptionCycle
        cycle = SubscriptionCycle.objects.filter(subscription__player_id=player_id, is_active=True).first()
        
        if use_free_guest:
            if not cycle:
                return Response({'detail': 'Nenhuma assinatura ativa encontrada.'}, status=status.HTTP_400_BAD_REQUEST)
            if cycle.free_guests_used >= cycle.subscription.plan.free_guests:
                return Response({'detail': 'Você já usou toda a sua cota de convidados grátis neste ciclo.'}, status=status.HTTP_400_BAD_REQUEST)
                
            cycle.free_guests_used += 1
            cycle.save()

        guest_player = Player.objects.create(
            name=f"{name} (Conv. de {inviting_player.name.split()[0]})",
            main_position=main_position,
            is_guest=True,
            invited_by=inviting_player.name,
            status='active'
        )

        Attendance.objects.create(
            gameday=gameday,
            player=guest_player,
            present=False,
            is_waitlist=True,
            waitlist_joined_at=timezone.now(),
            has_paid=use_free_guest,
            used_credit=use_free_guest
        )
        
        detail_msg = 'Convidado adicionado à fila de espera gratuitamente!' if use_free_guest else 'Convidado adicionado à fila de espera com sucesso!'
        return Response({'detail': detail_msg})

    @action(detail=True, methods=['post'], url_path='promote-waitlist')
    def promote_waitlist(self, request, pk=None):
        """Promove o próximo da fila de espera para presença confirmada."""
        gameday = self.get_object()
        
        if gameday.max_players and gameday.occupied_spots >= gameday.max_players:
            return Response({'detail': 'A lista principal está lotada! Alguém precisa sair ou o limite de jogadores aumentar para poder promover da fila.'}, status=status.HTTP_400_BAD_REQUEST)

        # Promover priorizando is_priority=True, depois membro normal (is_guest=False), depois ordem de chegada
        next_player_att = gameday.attendances.filter(is_waitlist=True).select_related('player').order_by('-is_priority', 'player__is_guest', 'waitlist_joined_at').first()
        
        if not next_player_att:
            return Response({'detail': 'A fila de espera está vazia.'}, status=status.HTTP_400_BAD_REQUEST)
            
        next_player_att.is_waitlist = False
        next_player_att.waitlist_joined_at = None
        next_player_att.present = True
        next_player_att.save()
        self._check_and_notify_full_circuit(gameday)
        
        return Response({
            'detail': f'{next_player_att.player.display_name} foi promovido para a lista principal!',
            'player_id': next_player_att.player_id
        })

    @action(detail=True, methods=['post'], url_path='claim-payment')
    def claim_payment(self, request, pk=None):
        """Atleta informa que pagou o rateio via PIX."""
        gameday = self.get_object()
        player_id = request.data.get('player_id')
        
        if not player_id:
            return Response({'detail': 'ID do jogador não fornecido.'}, status=status.HTTP_400_BAD_REQUEST)
        if denied := _deny_unless_self(request, player_id):
            return denied
            
        try:
            attendance = gameday.attendances.get(player_id=player_id)
        except Attendance.DoesNotExist:
            return Response({'detail': 'Você não está na lista deste circuito.'}, status=status.HTTP_400_BAD_REQUEST)

        if attendance.has_paid:
            return Response({'detail': 'Seu pagamento já foi confirmado.'}, status=status.HTTP_400_BAD_REQUEST)
        if not (attendance.present or attendance.is_reserved):
            return Response({'detail': 'Você não tem vaga neste circuito.'}, status=status.HTTP_400_BAD_REQUEST)

        attendance.payment_claimed = True
        attendance.save()
        
        return Response({'detail': 'Aviso de pagamento enviado com sucesso! O administrador irá confirmar em breve.', 'payment_claimed': True})

    def _get_attendance(self, gameday, player_id):
        if not player_id:
            return None
        return gameday.attendances.filter(player_id=player_id).select_related('player__user').first()

    @action(detail=True, methods=['post'], url_path='confirm-payment')
    def confirm_payment(self, request, pk=None):
        """Admin confirma o pagamento (PIX na chave, dinheiro ou isenção). Confirma a vaga se estava reservada."""
        gameday = self.get_object()
        attendance = self._get_attendance(gameday, request.data.get('player_id'))
        if not attendance:
            return Response({'detail': 'Jogador não está na lista deste circuito.'}, status=status.HTTP_400_BAD_REQUEST)
        if attendance.has_paid:
            return Response({'detail': 'Pagamento já confirmado.'}, status=status.HTTP_400_BAD_REQUEST)

        method = request.data.get('method', AttendancePayment.METHOD_PIX_MANUAL)
        if method not in AttendancePayment.MANUAL_METHODS:
            return Response({'detail': 'Forma de pagamento inválida.'}, status=status.HTTP_400_BAD_REQUEST)

        amount = request.data.get('amount')
        if amount is not None:
            from decimal import Decimal, InvalidOperation
            try:
                amount = Decimal(str(amount))
            except InvalidOperation:
                return Response({'detail': 'Valor inválido.'}, status=status.HTTP_400_BAD_REQUEST)
            if amount < 0:
                return Response({'detail': 'Valor inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        payment = CircuitPaymentService.confirm_payment(attendance, method, amount=amount, confirmed_by=request.user)
        return Response({
            'detail': 'Pagamento confirmado.',
            'player_id': attendance.player_id,
            'payment_id': payment.id,
            'amount': payment.amount,
            'method': payment.method,
        })

    @action(detail=True, methods=['post'], url_path='revert-payment')
    def revert_payment(self, request, pk=None):
        """Admin desfaz uma confirmação de pagamento feita por engano."""
        gameday = self.get_object()
        attendance = self._get_attendance(gameday, request.data.get('player_id'))
        if not attendance:
            return Response({'detail': 'Jogador não está na lista deste circuito.'}, status=status.HTTP_400_BAD_REQUEST)
        CircuitPaymentService.revert_payment(attendance)
        return Response({'detail': 'Pagamento desfeito.', 'player_id': attendance.player_id})

    @action(detail=True, methods=['get'], url_path='finance')
    def finance_summary(self, request, pk=None):
        """Resumo financeiro do circuito (previsto, arrecadado, a receber, saldo)."""
        return Response(CircuitPaymentService.summary(self.get_object()))

    @action(detail=True, methods=['post'], url_path='reorder-waitlist')
    def reorder_waitlist(self, request, pk=None):
        """Reordena a fila de espera conforme a ordem de IDs recebida."""
        gameday = self.get_object()
        attendance_ids = request.data.get('attendance_ids', [])
        
        if not attendance_ids:
            return Response({'detail': 'Lista de IDs vazia.'}, status=status.HTTP_400_BAD_REQUEST)
        
        from django.utils import timezone
        base_time = timezone.now()
        
        waitlist_atts = gameday.attendances.filter(is_waitlist=True, id__in=attendance_ids)
        att_map = {att.id: att for att in waitlist_atts}
        
        to_update = []
        for i, att_id in enumerate(attendance_ids):
            att = att_map.get(att_id)
            if att:
                from datetime import timedelta
                att.waitlist_joined_at = base_time + timedelta(seconds=i)
                to_update.append(att)
        
        if to_update:
            Attendance.objects.bulk_update(to_update, ['waitlist_joined_at'])
        
        return Response({'detail': f'Fila reordenada com sucesso! ({len(to_update)} atualizados)'})




class CircuitFinanceViewSet(viewsets.ViewSet):
    """Relatórios financeiros dos circuitos (somente admin/moderador)."""
    permission_classes = [IsAdminOrModerator]

    @action(detail=False, methods=['get'])
    def overview(self, request):
        from datetime import datetime
        month_param = request.query_params.get('month')
        try:
            month = datetime.strptime(month_param, '%Y-%m').date() if month_param else timezone.localdate()
        except ValueError:
            return Response({'detail': 'Mês inválido. Use o formato AAAA-MM.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(finance.overview(month))

    @action(detail=False, methods=['get'])
    def claims(self, request):
        return Response(finance.payment_claims())

    @action(detail=False, methods=['get'])
    def debtors(self, request):
        try:
            days = min(max(int(request.query_params.get('days', 60)), 1), 365)
        except ValueError:
            days = 60
        return Response(finance.debtors(days))


def sync_absences_logic():
    """Função central para processar faltas e no-shows (Agrupado por Dia)."""
    from django.db.models import Count, Q
    from django.utils import timezone
    
    all_gamedays = GameDay.objects.prefetch_related('court_checkins', 'attendances').order_by('date')
    today = timezone.localdate()
    
    players_qs = list(Player.objects.filter(status__in=['active', 'inactive'], is_guest=False))
    
    for p in players_qs:
        p.consecutive_absences = 0
        
    Attendance.objects.all().update(was_no_show=False)
    attendances_to_update = []
    
    # Agrupar circuitos por data
    gamedays_by_date = {}
    for g in all_gamedays:
        if g.date not in gamedays_by_date:
            gamedays_by_date[g.date] = []
        gamedays_by_date[g.date].append(g)
        
    for date, gamedays in gamedays_by_date.items():
        # Um dia só "encerrou" se a data passou ou foi fechado.
        # REGRA NOVA: Só consideramos Circuitos que foram PUBLICADOS e tiveram pelo menos 1 pessoa na quadra
        # Se não teve ninguém na quadra (court_checkins vazio) ou não foi publicado, o evento não ocorreu de fato.
        finished_gamedays = [
            g for g in gamedays 
            if (g.is_closed or g.date < today) and g.is_published and len(g.court_checkins.all()) > 0
        ]
        
        if not finished_gamedays:
            continue
            
        # Quem foi na quadra hoje (apenas em circuitos já encerrados/verificados)
        daily_checkin_pids = set()
        for g in finished_gamedays:
            daily_checkin_pids.update(c.player_id for c in g.court_checkins.all())
            
        # Gerar No-shows para circuitos fechados/passados
        for g in finished_gamedays:
            g_checkin_pids = set(c.player_id for c in g.court_checkins.all())
            for att in g.attendances.all():
                # Falta justificada não vira no-show
                if att.present and att.player_id not in g_checkin_pids and not att.is_justified:
                    att.was_no_show = True
                    attendances_to_update.append(att)

        daily_justified_pids = {
            att.player_id for g in finished_gamedays for att in g.attendances.all() if att.is_justified
        }

        # Atualizar faltas dos jogadores para este dia
        for p in players_qs:
            if p.created_at.date() > date:
                continue

            # Dias até o Ponto de Reset (zerado manualmente pelo admin) são ignorados
            if p.absences_reset_date and date <= p.absences_reset_date:
                p.consecutive_absences = 0
                continue

            if p.id in daily_checkin_pids:
                # Foi na quadra. Zera!
                p.consecutive_absences = 0
            elif p.id in daily_justified_pids:
                # Falta justificada: não zera, mas também não soma
                pass
            elif finished_gamedays:
                # Não foi na quadra (ou não se inscreveu ou deu no-show)
                p.consecutive_absences += 1
                if p.consecutive_absences >= 10:
                    p.status = 'inactive'
                    
    if attendances_to_update:
        Attendance.objects.bulk_update(attendances_to_update, ['was_no_show'])
        
    Player.objects.bulk_update(players_qs, ['consecutive_absences', 'status'])
    return len(gamedays_by_date)



class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Attendance.objects.all().select_related('player', 'gameday').prefetch_related('payments')
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['gameday', 'player', 'present', 'was_no_show', 'is_justified']

    @action(detail=True, methods=['post'], url_path='justify')
    def justify(self, request, pk=None):
        from apps.core.permissions import IsAdminOrModerator
        if not IsAdminOrModerator().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)
            
        attendance = self.get_object()
        justification_text = request.data.get('justification_text', '')
        
        attendance.is_justified = True
        attendance.justification_text = justification_text
        attendance.save()
        
        return Response({'detail': 'Falta justificada com sucesso!', 'is_justified': True})


class CourtCheckinViewSet(viewsets.ModelViewSet):
    queryset = CourtCheckin.objects.all().select_related('player', 'gameday')
    serializer_class = CourtCheckinSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['gameday', 'player']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'toggle', 'bulk_toggle']:
            return [IsAdminOrModerator()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['post'], url_path='toggle')
    def toggle(self, request):
        """Toggle de chegada na quadra de um jogador específico."""
        gameday_id = request.data.get('gameday_id')
        player_id = request.data.get('player_id')
        
        if not gameday_id or not player_id:
            return Response({'detail': 'Faltando gameday_id ou player_id.'}, status=status.HTTP_400_BAD_REQUEST)
            
        gameday = GameDay.objects.filter(id=gameday_id).first()
        if gameday and gameday.is_closed:
            return Response({'detail': 'Circuito encerrado. Não é possível alterar a tiragem de falta.'}, status=status.HTTP_400_BAD_REQUEST)
            
        checkin = CourtCheckin.objects.filter(gameday_id=gameday_id, player_id=player_id).first()
        
        if checkin:
            checkin.delete()
            return Response({'arrived': False, 'player_id': player_id})
        else:
            CourtCheckin.objects.create(gameday_id=gameday_id, player_id=player_id)
            Player.reactivate_inactive([player_id])
            return Response({'arrived': True, 'player_id': player_id})

    @action(detail=False, methods=['post'], url_path='bulk-toggle')
    def bulk_toggle(self, request):
        """Toggle em lote para Tiragem de Falta (Marcar Todos / Desmarcar Todos)"""
        gameday_id = request.data.get('gameday_id')
        player_ids = request.data.get('player_ids', [])
        action_type = request.data.get('action_type') # 'check_all' ou 'uncheck_all'

        if not gameday_id:
            return Response({'detail': 'Faltando gameday_id.'}, status=status.HTTP_400_BAD_REQUEST)
            
        gameday = GameDay.objects.filter(id=gameday_id).first()
        if gameday and gameday.is_closed:
            return Response({'detail': 'Circuito encerrado. Não é possível alterar a tiragem de falta.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if action_type == 'uncheck_all':
            CourtCheckin.objects.filter(gameday_id=gameday_id).delete()
        elif action_type == 'check_all':
            existing = set(CourtCheckin.objects.filter(gameday_id=gameday_id).values_list('player_id', flat=True))
            new_checkins = [
                CourtCheckin(gameday_id=gameday_id, player_id=pid)
                for pid in player_ids if pid not in existing
            ]
            if new_checkins:
                CourtCheckin.objects.bulk_create(new_checkins)
                Player.reactivate_inactive([c.player_id for c in new_checkins])
                
        return Response({'detail': 'Operação em lote concluída com sucesso!'})
