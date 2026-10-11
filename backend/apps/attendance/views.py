from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q
from django.utils import timezone

from .models import GameDay, Attendance, CourtCheckin
from .serializers import GameDaySerializer, GameDayListSerializer, AttendanceSerializer, BulkAttendanceSerializer, CourtCheckinSerializer
from apps.players.models import Player
from apps.core.permissions import IsAdminOrModerator


class GameDayViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_closed', 'is_published']
    ordering = ['-date']

    def get_queryset(self):
        qs = GameDay.objects.all()
        if self.request.query_params.get('active_only') == 'true':
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
                _total_court_checkins=Count('court_checkins', distinct=True)
            ).order_by('-date')
        # Para detail: prefetch completo com os jogadores
        return qs.prefetch_related('attendances__player')

    def perform_update(self, serializer):
        was_closed = serializer.instance.is_closed
        instance = serializer.save()
        if not was_closed and instance.is_closed:
            sync_absences_logic()

    def get_serializer_class(self):
        if self.action == 'list':
            return GameDayListSerializer
        return GameDaySerializer

    def get_permissions(self):
        from rest_framework.permissions import AllowAny
        if self.action in ['checkin_info', 'public_checkin']:
            return [AllowAny()]
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'bulk_attendance', 'initialize', 'add_guest', 'reorder_waitlist']:
            return [IsAdminOrModerator()]
        return [IsAuthenticated()]

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

    def _check_and_notify_full_circuit(self, gameday):
        if gameday.max_players and not gameday.is_full_notified:
            if gameday.total_present >= gameday.max_players:
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

        gameday = serializer.save()

        # Envia notificação APENAS se o status is_published mudou de False para True
        if not was_published and gameday.is_published:
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
            Attendance.objects.filter(gameday=gameday, present=True).update(has_paid=True)
        elif action_type == 'uncheck_all':
            Attendance.objects.filter(gameday=gameday, present=True).update(has_paid=False)
            
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
            attendance.save()
        elif attendance.is_waitlist:
            attendance.is_waitlist = False
            attendance.waitlist_joined_at = None
            attendance.save()
        else:
            # Bloquear jogadores inativos de se inscreverem
            if attendance.player.status == 'inactive':
                return Response({'detail': 'Sua conta está inativa por excesso de faltas. Procure a administração para regularizar.'}, status=status.HTTP_403_FORBIDDEN)
                
            if attendance.player.is_guest:
                attendance.is_waitlist = True
                attendance.waitlist_joined_at = timezone.now()
                attendance.present = False
                attendance.save()
            elif gameday.max_players and gameday.total_present >= gameday.max_players:
                attendance.is_waitlist = True
                attendance.waitlist_joined_at = timezone.now()
                attendance.present = False
                attendance.save()
            else:
                attendance.present = True
                attendance.is_waitlist = False
                attendance.waitlist_joined_at = None
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
        attendance.has_paid = not attendance.has_paid
        attendance.save()
        
        if attendance.has_paid and getattr(attendance.player, 'user', None) and attendance.player.user.is_active:
            from apps.notifications.models import Notification
            Notification.objects.create(
                user=attendance.player.user,
                title='Pagamento Confirmado! 💰',
                message='Seu pagamento foi recebido com sucesso. Obrigado e vamos pro jogo! 🏐',
                type='financial'
            )
            
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
                'main_position': p.main_position,
                'is_guest': p.is_guest,
                'invited_by': p.invited_by,
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

        attendance, _ = Attendance.objects.get_or_create(
            gameday=gameday, player_id=player_id
        )

        if attendance.present:
            return Response({'detail': 'Você já confirmou sua presença! Para cancelar, fale com a organização.'}, status=status.HTTP_400_BAD_REQUEST)
            
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
            
        if gameday.max_players and gameday.total_present >= gameday.max_players:
            if not attendance.is_waitlist:
                attendance.is_waitlist = True
                attendance.waitlist_joined_at = timezone.now()
                attendance.save()
            return Response({
                'present': False, 
                'is_waitlist': True, 
                'player_id': player_id,
                'detail': 'Lista de presença cheia! Você foi adicionado à Fila de Espera.'
            })
                
        attendance.present = True
        attendance.is_waitlist = False
        attendance.waitlist_joined_at = None
        attendance.save()
        self._check_and_notify_full_circuit(gameday)
        
        return Response({'present': attendance.present, 'is_waitlist': attendance.is_waitlist, 'player_id': player_id})

    @action(detail=True, methods=['post'], url_path='cancel-checkin')
    def cancel_checkin(self, request, pk=None):
        """Endpoint público para o atleta cancelar seu check-in."""
        gameday = self.get_object()
        player_id = request.data.get('player_id')
        
        if not player_id:
            return Response({'detail': 'ID do jogador não fornecido.'}, status=status.HTTP_400_BAD_REQUEST)

        attendance = Attendance.objects.filter(gameday=gameday, player_id=player_id).first()
        
        if not attendance:
            return Response({'detail': 'Nenhuma inscrição encontrada para este jogador.'}, status=status.HTTP_400_BAD_REQUEST)

        if gameday.court_price and gameday.court_price > 0 and attendance.present:
            return Response({'detail': 'Este é um circuito pago. Para cancelar sua presença confirmada, fale com a organização.'}, status=status.HTTP_400_BAD_REQUEST)

        attendance.present = False
        attendance.is_waitlist = False
        attendance.waitlist_joined_at = None
        attendance.save()
        
        return Response({'detail': 'Sua inscrição foi cancelada com sucesso.', 'player_id': player_id})

    @action(detail=True, methods=['post'], url_path='promote-waitlist')
    def promote_waitlist(self, request, pk=None):
        """Promove o próximo da fila de espera para presença confirmada."""
        gameday = self.get_object()
        
        if gameday.max_players and gameday.total_present >= gameday.max_players:
            return Response({'detail': 'A lista principal está lotada! Alguém precisa sair ou o limite de jogadores aumentar para poder promover da fila.'}, status=status.HTTP_400_BAD_REQUEST)

        next_player_att = gameday.attendances.filter(is_waitlist=True).select_related('player').order_by('player__is_guest', 'waitlist_joined_at').first()
        
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
            
        try:
            attendance = gameday.attendances.get(player_id=player_id)
        except Attendance.DoesNotExist:
            return Response({'detail': 'Você não está na lista deste circuito.'}, status=status.HTTP_400_BAD_REQUEST)
            
        attendance.payment_claimed = True
        attendance.save()
        
        return Response({'detail': 'Aviso de pagamento enviado com sucesso! O administrador irá confirmar em breve.', 'payment_claimed': True})

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



def sync_absences_logic():
    """Função central para processar faltas e no-shows (Agrupado por Dia)."""
    from django.db.models import Count, Q
    from django.utils import timezone
    
    all_gamedays = GameDay.objects.prefetch_related('court_checkins', 'attendances').order_by('date')
    today = timezone.now().date()
    
    players_qs = list(Player.objects.filter(status__in=['active', 'inactive'], is_guest=False))
    
    for p in players_qs:
        p.consecutive_absences = 0
        
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
                # O jogador ganha falta se estava inscrito, NÃO teve check-in físico E não teve falta justificada
                should_be_no_show = att.present and (att.player_id not in g_checkin_pids) and not att.is_justified
                
                # Atualizar apenas se o status estiver divergente
                if att.was_no_show != should_be_no_show:
                    att.was_no_show = should_be_no_show
                    attendances_to_update.append(att)
                    
        # Quem tem falta justificada hoje (para proteção das faltas consecutivas)
        daily_justified_pids = set()
        for g in finished_gamedays:
            daily_justified_pids.update(
                att.player_id for att in g.attendances.all() if att.is_justified
            )
                    
        # Atualizar faltas dos jogadores para este dia
        for p in players_qs:
            if p.created_at.date() > date:
                continue
                
            # Verifica se essa data já foi "perdoada" pelo reset
            if p.absences_reset_date and date <= p.absences_reset_date:
                p.consecutive_absences = 0
                continue
                
            if p.id in daily_checkin_pids:
                # Foi na quadra. Zera e reativa!
                p.consecutive_absences = 0
                p.status = 'active'
            elif p.id in daily_justified_pids:
                # Tem falta justificada neste dia. O sistema não zera, mas protege para não aumentar.
                pass
            elif finished_gamedays:
                # Não foi na quadra nem teve justificativa
                p.consecutive_absences += 1
                if p.consecutive_absences >= 10:
                    p.status = 'inactive'
                    
    if attendances_to_update:
        Attendance.objects.bulk_update(attendances_to_update, ['was_no_show'])
        
    Player.objects.bulk_update(players_qs, ['consecutive_absences', 'status'])
    return len(gamedays_by_date)



class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Attendance.objects.all().select_related('player', 'gameday')
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
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'toggle']:
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
                
        return Response({'detail': 'Operação em lote concluída com sucesso!'})
