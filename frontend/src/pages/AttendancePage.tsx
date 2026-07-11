import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, CalendarCheck, ChevronRight, Check, Users, Shuffle, RefreshCw } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { OverallBadge } from '@/components/ui/OverallBadge';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { attendanceService, teamsService } from '@/services';
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

  const [activeTab, setActiveTab] = useState<'attendance' | 'teams'>('attendance');
  const [selectedModality, setSelectedModality] = useState<number>(6);

  const { data: gameDaysData, isLoading } = useQuery({
    queryKey: ['gamedays'],
    queryFn: () => attendanceService.listGameDays(),
  });

  const { data: gameDayDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['gameday', selectedGameDay?.id],
    queryFn: () => attendanceService.getGameDay(selectedGameDay!.id),
    enabled: !!selectedGameDay,
  });

  // Buscar gerações de times do gameday
  const { data: generationsData, isLoading: loadingGenerations } = useQuery({
    queryKey: ['team-generations', selectedGameDay?.id],
    queryFn: () => teamsService.list({ gameday_id: selectedGameDay!.id }),
    enabled: !!selectedGameDay && activeTab === 'teams',
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

  const generateTeamsMutation = useMutation({
    mutationFn: () => teamsService.generate({ modality: selectedModality, gameday_id: selectedGameDay!.id, save: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-generations', selectedGameDay?.id] });
    },
  });

  const movePlayerMutation = useMutation({
    mutationFn: ({ generationId, playerId, targetTeamId }: { generationId: number, playerId: number, targetTeamId: number }) =>
      teamsService.movePlayer(generationId, playerId, targetTeamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-generations', selectedGameDay?.id] });
    },
  });

  const gameDays = gameDaysData?.results || [];
  const latestGeneration = generationsData?.results?.[0];

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

              <div className="flex gap-4 border-b border-border mb-4">
                <button
                  onClick={() => setActiveTab('attendance')}
                  className={`pb-2 text-sm font-medium transition-colors ${activeTab === 'attendance' ? 'border-b-2 border-red text-red' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Lista de Presença
                </button>
                <button
                  onClick={() => setActiveTab('teams')}
                  className={`pb-2 text-sm font-medium transition-colors ${activeTab === 'teams' ? 'border-b-2 border-red text-red' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Times Gerados
                </button>
              </div>

              {activeTab === 'attendance' ? (
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
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4 justify-between items-end">
                    <div>
                      <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">Gerar novos times</label>
                      <div className="flex gap-2">
                        <select
                          value={selectedModality}
                          onChange={(e) => setSelectedModality(Number(e.target.value))}
                          className="input text-sm py-1.5"
                        >
                          <option value="2">2v2</option>
                          <option value="3">3v3</option>
                          <option value="4">4v4</option>
                          <option value="5">5v5</option>
                          <option value="6">6v6</option>
                        </select>
                        <button
                          onClick={() => generateTeamsMutation.mutate()}
                          disabled={generateTeamsMutation.isPending || !canEdit}
                          className="btn-primary py-1.5 px-3 flex items-center gap-2 text-sm"
                        >
                          {generateTeamsMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Shuffle size={14} />}
                          Gerar
                        </button>
                      </div>
                    </div>
                  </div>

                  {loadingGenerations ? (
                    <PageLoading />
                  ) : !latestGeneration ? (
                    <EmptyState message="Nenhum time gerado para este dia ainda." icon="🏐" />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-text-muted">Modalidade: {latestGeneration.modality_display}</span>
                        <span className="text-green-400">Bal: {(10 - latestGeneration.balance_score * 10).toFixed(1)}%</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {latestGeneration.teams.map((team: any) => (
                          <div key={team.id} className="card overflow-hidden">
                            <div className="h-1.5" style={{ backgroundColor: team.color_hex }} />
                            <div className="p-3">
                              <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-sm" style={{ color: team.color_hex }}>{team.name}</h3>
                                <span className="font-display font-bold text-lg" style={{ color: team.color_hex }}>{team.avg_overall.toFixed(1)}</span>
                              </div>
                              <div className="space-y-1">
                                {team.team_players.map((tp: any) => (
                                  <div key={tp.id} className="flex items-center gap-2 p-1.5 rounded bg-surface group relative">
                                    <Avatar name={tp.player_name} src={tp.player_avatar} size="sm" className="w-6 h-6" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-text-primary text-xs font-medium truncate">{tp.player_name}</p>
                                    </div>
                                    <OverallBadge overall={tp.player_overall} size="sm" className="scale-75 origin-right" />
                                    
                                    {canEdit && (
                                      <div className="absolute inset-y-0 right-0 hidden group-hover:flex items-center bg-surface px-1">
                                        <select
                                          className="text-[10px] bg-background border border-border rounded px-1 py-0.5 text-text-primary"
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              movePlayerMutation.mutate({
                                                generationId: latestGeneration.id,
                                                playerId: tp.player,
                                                targetTeamId: Number(e.target.value)
                                              });
                                            }
                                          }}
                                          value=""
                                        >
                                          <option value="">Mover...</option>
                                          {latestGeneration.teams.filter((t: any) => t.id !== team.id).map((t: any) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
