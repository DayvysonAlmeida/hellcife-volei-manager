from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import GameDay, Attendance
from .serializers import GameDaySerializer, GameDayListSerializer, AttendanceSerializer, BulkAttendanceSerializer
from apps.players.models import Player
from apps.core.permissions import IsAdminOrModerator


class GameDayViewSet(viewsets.ModelViewSet):
    queryset = GameDay.objects.all().prefetch_related('attendances__player')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    ordering = ['-date']

    def get_serializer_class(self):
        if self.action == 'list':
            return GameDayListSerializer
        return GameDaySerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'bulk_attendance', 'initialize']:
            return [IsAdminOrModerator()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        gameday = serializer.save(created_by=self.request.user)
        # Cria registros de presença para todos os jogadores ativos
        active_players = Player.objects.filter(status='active')
        Attendance.objects.bulk_create([
            Attendance(gameday=gameday, player=p, present=False)
            for p in active_players
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


class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Attendance.objects.all().select_related('player', 'gameday')
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['gameday', 'player', 'present']
