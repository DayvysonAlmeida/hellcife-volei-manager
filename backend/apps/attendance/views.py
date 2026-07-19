from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q

from .models import GameDay, Attendance
from .serializers import GameDaySerializer, GameDayListSerializer, AttendanceSerializer, BulkAttendanceSerializer
from apps.players.models import Player
from apps.core.permissions import IsAdminOrModerator


class GameDayViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    ordering = ['-date']

    def get_queryset(self):
        if self.action == 'list':
            # Para listagem: usar annotations ao invés de properties (evita N+1)
            return GameDay.objects.all().annotate(
                _total_present=Count('attendances', filter=Q(attendances__present=True)),
                _total_players=Count('attendances'),
            ).order_by('-date')
        # Para detail: prefetch completo com os jogadores
        return GameDay.objects.all().prefetch_related('attendances__player')

    def get_serializer_class(self):
        if self.action == 'list':
            return GameDayListSerializer
        return GameDaySerializer

    def get_permissions(self):
        from rest_framework.permissions import AllowAny
        if self.action in ['checkin_info', 'public_checkin']:
            return [AllowAny()]
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'bulk_attendance', 'initialize', 'add_guest']:
            return [IsAdminOrModerator()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['post'], url_path='add-guest')
    def add_guest(self, request, pk=None):
        """Adiciona um convidado ao gameday."""
        gameday = self.get_object()
        
        name = request.data.get('name')
        main_position = request.data.get('main_position')
        invited_by = request.data.get('invited_by')

        if not name or not main_position:
            return Response({'detail': 'Nome e Posição são obrigatórios.'}, status=status.HTTP_400_BAD_REQUEST)

        # Create Guest Player
        guest_player = Player.objects.create(
            name=name,
            main_position=main_position,
            is_guest=True,
            invited_by=invited_by,
            status='active'
        )

        # Create Attendance
        Attendance.objects.create(
            gameday=gameday,
            player=guest_player,
            present=True
        )

        gameday.refresh_from_db()
        return Response({'detail': 'Convidado adicionado com sucesso!'})

    def perform_create(self, serializer):
        gameday = serializer.save(created_by=self.request.user)
        # Cria registros de presença para todos os jogadores (exceto convidados de outras peladas)
        base_players = Player.objects.filter(is_guest=False)
        Attendance.objects.bulk_create([
            Attendance(gameday=gameday, player=p, present=False)
            for p in base_players
        ])

    @action(detail=True, methods=['post'], url_path='bulk-attendance')
    def bulk_attendance(self, request, pk=None):
        """Marca presença em bulk: recebe lista de player_ids presentes."""
        gameday = self.get_object()
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

    @action(detail=True, methods=['post'], url_path='refresh-list')
    def refresh_list(self, request, pk=None):
        """Atualiza a lista de presença com novos jogadores cadastrados (incluindo inativos, excluindo convidados de outros dias)."""
        gameday = self.get_object()
        base_players = Player.objects.filter(is_guest=False)
        existing_attendances = set(gameday.attendances.values_list('player_id', flat=True))
        
        new_attendances = []
        for p in base_players:
            if p.id not in existing_attendances:
                new_attendances.append(Attendance(gameday=gameday, player=p, present=False))
                
        if new_attendances:
            Attendance.objects.bulk_create(new_attendances)
            
        gameday.refresh_from_db()
        return Response({'detail': f'{len(new_attendances)} novos jogadores adicionados à lista.'})

    @action(detail=True, methods=['patch'], url_path='toggle/(?P<player_id>[^/.]+)')
    def toggle_attendance(self, request, pk=None, player_id=None):
        """Toggle de presença de um jogador específico."""
        gameday = self.get_object()
        attendance, _ = Attendance.objects.get_or_create(
            gameday=gameday, player_id=player_id
        )
        attendance.present = not attendance.present
        attendance.save()
        return Response({'present': attendance.present, 'player_id': player_id})

    @action(detail=True, methods=['patch'], url_path='toggle-payment/(?P<player_id>[^/.]+)')
    def toggle_payment(self, request, pk=None, player_id=None):
        """Toggle de pagamento de um jogador específico."""
        gameday = self.get_object()
        attendance, _ = Attendance.objects.get_or_create(
            gameday=gameday, player_id=player_id
        )
        attendance.has_paid = not attendance.has_paid
        attendance.save()
        return Response({'has_paid': attendance.has_paid, 'player_id': player_id})

    @action(detail=True, methods=['get'], url_path='checkin-info')
    def checkin_info(self, request, pk=None):
        """Retorna informações resumidas para a tela pública de check-in."""
        gameday = self.get_object()
        active_players = Player.objects.filter(status='active').order_by('name')
        
        present_ids = set(gameday.attendances.filter(present=True).values_list('player_id', flat=True))
        
        players_data = []
        for p in active_players:
            players_data.append({
                'id': p.id,
                'name': p.display_name,
                'present': p.id in present_ids,
                'is_guest': p.is_guest
            })
            
        return Response({
            'gameday': {
                'id': gameday.id,
                'date': gameday.date,
                'location': gameday.location,
                'description': gameday.description,
                'total_present': len(present_ids),
                'max_players': gameday.max_players
            },
            'players': players_data
        })

    @action(detail=True, methods=['post'], url_path='public-checkin')
    def public_checkin(self, request, pk=None):
        """Endpoint público para o próprio jogador fazer check-in."""
        gameday = self.get_object()
        player_id = request.data.get('player_id')
        
        if not player_id:
            return Response({'detail': 'ID do jogador não fornecido.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if gameday.max_players and gameday.total_present >= gameday.max_players:
            # Verifica se ele já estava presente (caso esteja querendo desmarcar)
            att = Attendance.objects.filter(gameday=gameday, player_id=player_id).first()
            if not att or not att.present:
                return Response({'detail': 'Lista de presença cheia!'}, status=status.HTTP_400_BAD_REQUEST)
                
        attendance, _ = Attendance.objects.get_or_create(
            gameday=gameday, player_id=player_id
        )
        attendance.present = not attendance.present
        attendance.save()
        
        return Response({'present': attendance.present, 'player_id': player_id})


class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Attendance.objects.all().select_related('player', 'gameday')
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['gameday', 'player', 'present']
