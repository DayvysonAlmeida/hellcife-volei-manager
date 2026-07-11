import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, CalendarCheck, ChevronRight, Check, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { attendanceService } from '@/services';
import { formatDate } from '@/lib/utils';
import type { GameDay } from '@/types';
import { useAuth } from '@/store/AuthContext';

export function AttendancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';

  const [selectedGameDay, setSelectedGameDay] = useState<GameDay | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newLocation, setNewLocation] = useState('');

  const { data: gameDaysData, isLoading } = useQuery({
    queryKey: ['gamedays'],
    queryFn: () => attendanceService.listGameDays(),
  });

  const { data: gameDayDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['gameday', selectedGameDay?.id],
    queryFn: () => attendanceService.getGameDay(selectedGameDay!.id),
    enabled: !!selectedGameDay,
  });

  const createMutation = useMutation({
    mutationFn: () => attendanceService.createGameDay({ date: newDate, location: newLocation }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gamedays'] });
      setShowNewForm(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ gamedayId, playerId }: { gamedayId: number; playerId: number }) =>
      attendanceService.toggleAttendance(gamedayId, playerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gameday', selectedGameDay?.id] }),
  });

  const gameDays = gameDaysData?.results || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Controle de Presença</h1>
          <p className="page-subtitle">Registro de presença por dia de jogo.</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowNewForm(!showNewForm)} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Novo dia de jogo
          </button>
        )}
      </div>

      {/* New gameday form */}
      {showNewForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5 border-red/20"
        >
          <h3 className="font-display text-base tracking-wider text-text-primary mb-4">NOVO DIA DE JOGO</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wider">Data *</label>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="input w-full mt-1" />
            </div>
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wider">Local</label>
              <input placeholder="Ex: Quadra HellCife" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} className="input w-full mt-1" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNewForm(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="btn-primary text-sm">
              Criar dia de jogo
            </button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Game days list */}
        <div className="card p-4">
          <h2 className="font-display text-base tracking-wider text-text-primary mb-3 flex items-center gap-2">
            <CalendarCheck size={16} className="text-red" />
            DIAS DE JOGO
          </h2>
          {isLoading ? (
            <PageLoading />
          ) : gameDays.length === 0 ? (
            <EmptyState message="Nenhum dia de jogo cadastrado." icon="📅" />
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {gameDays.map((gd) => (
                <button
                  key={gd.id}
                  onClick={() => setSelectedGameDay(gd)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-all text-left
                    ${selectedGameDay?.id === gd.id ? 'bg-red/10 border border-red/30' : 'hover:bg-surface border border-transparent'}`}
                >
                  <div>
                    <p className="text-text-primary text-sm font-medium">{formatDate(gd.date)}</p>
                    {gd.location && <p className="text-text-muted text-xs">{gd.location}</p>}
                    <div className="flex items-center gap-1 mt-1">
                      <Users size={11} className="text-text-muted" />
                      <span className="text-text-muted text-xs">{gd.total_present}/{gd.total_players}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-text-muted" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Attendance detail */}
        <div className="lg:col-span-2">
          {!selectedGameDay ? (
            <div className="card flex items-center justify-center py-24">
              <div className="text-center">
                <CalendarCheck size={40} className="text-red mx-auto mb-4 opacity-50" />
                <p className="text-text-muted">Selecione um dia de jogo para gerenciar a presença</p>
              </div>
            </div>
          ) : loadingDetail ? (
            <PageLoading />
          ) : gameDayDetail ? (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl tracking-wider text-text-primary">
                    {formatDate(gameDayDetail.date)}
                  </h2>
                  {gameDayDetail.location && (
                    <p className="text-text-muted text-sm">{gameDayDetail.location}</p>
                  )}
                </div>
                <div className="text-center">
                  <p className="font-display text-3xl text-red">{gameDayDetail.total_present}</p>
                  <p className="text-text-muted text-xs">de {gameDayDetail.total_players} presentes</p>
                </div>
              </div>

              <div className="divider" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {gameDayDetail.attendances.map((att) => (
                  <motion.button
                    key={att.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (canEdit) {
                        toggleMutation.mutate({ gamedayId: gameDayDetail.id, playerId: att.player });
                      }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                      ${att.present
                        ? 'bg-green-950/30 border-green-800/50'
                        : 'bg-surface border-border hover:border-border-subtle'
                      } ${!canEdit ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <Avatar name={att.player_name} src={att.player_avatar} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary text-sm font-medium truncate">{att.player_name}</p>
                      <PositionBadge position={att.player_position} />
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                      ${att.present ? 'bg-green-500' : 'bg-border'}`}>
                      {att.present && <Check size={12} className="text-white" />}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
