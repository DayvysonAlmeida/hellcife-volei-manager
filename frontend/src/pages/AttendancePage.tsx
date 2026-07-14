import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, CalendarCheck, ChevronRight, Check, Users, Shuffle, RefreshCw, Trash2, DollarSign, Share2, ChevronLeft } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { OverallBadge } from '@/components/ui/OverallBadge';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { attendanceService, teamsService } from '@/services';
import { formatDate } from '@/lib/utils';
import type { GameDay, Position } from '@/types';
import { useAuth } from '@/store/AuthContext';
import toast from 'react-hot-toast';

export function AttendancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';

  const [selectedGameDay, setSelectedGameDay] = useState<GameDay | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('19:30');
  const [newLocation, setNewLocation] = useState('');
  const [newMaxPlayers, setNewMaxPlayers] = useState<number | ''>('');


  // Guest modal state
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPosition, setGuestPosition] = useState<Position>('outside');
  const [guestInvitedBy, setGuestInvitedBy] = useState(user?.name || '');

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
    mutationFn: () => attendanceService.createGameDay({ 
      date: newDate, 
      time: newTime,
      location: newLocation,
      max_players: newMaxPlayers === '' ? undefined : newMaxPlayers
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gamedays'] });
      setShowNewForm(false);
      toast.success('Lista de pelada criada com sucesso!');
    },
    onError: (err: any) => {
      if (err.response?.data?.date) {
        toast.error('Já existe uma pelada cadastrada com esta data!');
      } else {
        toast.error('Erro ao criar a lista de pelada.');
      }
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ gamedayId, playerId }: { gamedayId: number; playerId: number }) =>
      attendanceService.toggleAttendance(gamedayId, playerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gameday', selectedGameDay?.id] }),
  });

  const togglePaymentMutation = useMutation({
    mutationFn: ({ gamedayId, playerId }: { gamedayId: number; playerId: number }) =>
      attendanceService.togglePayment(gamedayId, playerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gameday', selectedGameDay?.id] }),
  });

  const refreshMutation = useMutation({
    mutationFn: () => attendanceService.refreshList(selectedGameDay!.id),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['gameday', selectedGameDay?.id] });
      toast.success(data.detail || 'Lista atualizada com novos jogadores!');
    },
    onError: () => {
      toast.error('Erro ao atualizar a lista de presença.');
    }
  });

  const addGuestMutation = useMutation({
    mutationFn: (data: { name: string; main_position: Position; invited_by: string }) => 
      attendanceService.addGuest(selectedGameDay!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gameday', selectedGameDay?.id] });
      setShowGuestModal(false);
      setGuestName('');
      toast.success('Convidado adicionado à pelada!');
    },
    onError: () => {
      toast.error('Erro ao adicionar convidado.');
    }
  });

  const deleteGameDayMutation = useMutation({
    mutationFn: (id: number) => attendanceService.deleteGameDay(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gamedays'] });
      setSelectedGameDay(null);
      toast.success('Dia de jogo cancelado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao cancelar o dia de jogo.');
    }
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
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
            <div className="sm:col-span-1">
              <label className="text-text-muted text-xs uppercase tracking-wider">Data *</label>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="input w-full mt-1" />
            </div>
            <div className="sm:col-span-1">
              <label className="text-text-muted text-xs uppercase tracking-wider">Hora</label>
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="input w-full mt-1" />
            </div>
            <div className="sm:col-span-1">
              <label className="text-text-muted text-xs uppercase tracking-wider">Limite (Jogadores)</label>
              <input type="number" placeholder="Ilimitado" value={newMaxPlayers} onChange={(e) => setNewMaxPlayers(e.target.value === '' ? '' : Number(e.target.value))} min={0} className="input w-full mt-1" />
            </div>
            <div className="sm:col-span-1">
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
        <div className={`card p-4 ${selectedGameDay ? 'hidden lg:block' : 'block'}`}>
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
                <div key={gd.id} className="relative">
                  <div
                    onClick={() => setSelectedGameDay(gd)}
                    role="button"
                    tabIndex={0}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-all text-left cursor-pointer
                      ${selectedGameDay?.id === gd.id ? 'bg-red/10 border border-red/30' : 'hover:bg-surface border border-transparent'}`}
                  >
                    <div>
                      <p className="text-text-primary text-sm font-medium">
                        {formatDate(gd.date)} {gd.time ? `- ${gd.time.slice(0, 5)}` : ''}
                      </p>
                      {gd.location && <p className="text-text-muted text-xs">{gd.location}</p>}
                      <div className="flex items-center gap-1 mt-1">
                        <Users size={11} className="text-text-muted" />
                        <span className={`text-xs ${gd.max_players && gd.total_present >= gd.max_players ? 'text-red font-bold' : 'text-text-muted'}`}>
                          {gd.total_present}/{gd.max_players ? gd.max_players : gd.total_players}
                          {gd.max_players && gd.total_present >= gd.max_players ? ' (LOTADO)' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Tem certeza que deseja excluir esta pelada? Todos os dados de presença serão perdidos.')) {
                              deleteGameDayMutation.mutate(gd.id);
                            }
                          }}
                          disabled={deleteGameDayMutation.isPending}
                          className="p-1.5 text-text-muted hover:text-red hover:bg-red/10 rounded-md transition-colors"
                          title="Excluir Dia de Jogo"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <ChevronRight size={16} className={selectedGameDay?.id === gd.id ? 'text-red' : 'text-border'} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attendance detail */}
        <div className={`lg:col-span-2 ${!selectedGameDay ? 'hidden lg:block' : 'block'}`}>
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
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setSelectedGameDay(null)}
                    className="lg:hidden mt-1 p-2 -ml-2 rounded-lg text-text-muted hover:bg-surface hover:text-text-primary transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <div>
                    <h2 className="font-display text-xl tracking-wider text-text-primary flex items-center gap-2">
                      {formatDate(gameDayDetail.date)}
                    </h2>
                    {gameDayDetail.location && (
                      <p className="text-text-muted text-sm">{gameDayDetail.location}</p>
                    )}
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/checkin/${gameDayDetail.id}`;
                        navigator.clipboard.writeText(url);
                        toast.success('Link de check-in copiado!');
                      }}
                      className="mt-2 text-xs text-red flex items-center gap-1 hover:underline font-medium"
                    >
                      <Share2 size={12} />
                      Copiar link público de check-in
                    </button>
                  </div>
                </div>
                <div className="text-center self-center sm:self-start">
                  <p className="font-display text-3xl text-red">{gameDayDetail.total_present}</p>
                  <p className="text-text-muted text-xs">de {gameDayDetail.total_players} presentes</p>
                </div>
              </div>

              <div className="divider" />

              <div className="flex items-center justify-between border-b border-border mb-4">
                <div className="flex gap-4">
                  <span className="pb-2 text-sm font-medium border-b-2 border-red text-red">
                    Lista de Presença
                  </span>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowGuestModal(true)}
                      className="pb-2 text-xs text-text-muted hover:text-red flex items-center gap-1 transition-colors"
                      title="Adicionar um convidado para jogar hoje"
                    >
                      <Plus size={12} />
                      <span className="hidden sm:inline">Convidado</span>
                    </button>
                    <button
                      onClick={() => refreshMutation.mutate()}
                      disabled={refreshMutation.isPending}
                      className="pb-2 text-xs text-text-muted hover:text-red flex items-center gap-1 transition-colors"
                      title="Puxar novos jogadores ativos para esta lista"
                    >
                      <RefreshCw size={12} className={refreshMutation.isPending ? "animate-spin" : ""} />
                      <span className="hidden sm:inline">Atualizar Lista</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {gameDayDetail.attendances.map((att) => (
                    <div
                      key={att.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                        ${att.player_status !== 'active'
                          ? 'bg-surface/50 border-border/30 opacity-70'
                          : att.present
                            ? 'bg-green-950/30 border-green-800/50'
                            : 'bg-surface border-border hover:border-border-subtle'
                        }`}
                    >
                      <Avatar name={att.player_name} src={att.player_avatar} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-text-primary text-sm font-medium truncate flex items-center gap-2">
                            {att.player_name}
                            {att.player_status !== 'active' && (
                              <span className="text-[10px] bg-red/10 text-red px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                                Inativo
                              </span>
                            )}
                          </p>
                          <PositionBadge position={att.player_position} />
                        </div>
                      
                      {canEdit ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => togglePaymentMutation.mutate({ gamedayId: gameDayDetail.id, playerId: att.player })}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                              att.has_paid 
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' 
                                : 'bg-surface border-2 border-border-subtle text-text-muted hover:border-green-500 hover:text-green-500'
                            }`}
                            title="Alternar Pagamento"
                          >
                            <DollarSign size={20} />
                          </button>
                          <button
                            onClick={() => {
                              if (!att.present && gameDayDetail.max_players && gameDayDetail.total_present >= gameDayDetail.max_players) {
                                toast.error(`Limite de ${gameDayDetail.max_players} jogadores já atingido!`);
                                return;
                              }
                              toggleMutation.mutate({ gamedayId: gameDayDetail.id, playerId: att.player });
                            }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                              att.present 
                                ? 'bg-red text-white shadow-lg shadow-red/20 scale-110' 
                                : 'bg-surface border-2 border-border-subtle text-text-muted hover:border-red hover:text-red'
                            }`}
                            title="Alternar Presença"
                          >
                            {att.present && <Check size={20} />}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                            ${att.has_paid ? 'bg-green-500' : 'bg-border'}`}>
                            {att.has_paid && <DollarSign size={12} className="text-white" />}
                          </div>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                            ${att.present ? 'bg-red' : 'bg-border'}`}>
                            {att.present && <Check size={12} className="text-white" />}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {canEdit && (
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => {
                        toast.success('Lista de presença salva com sucesso!');
                        navigate('/teams');
                      }}
                      className="btn-primary flex items-center gap-2 px-6 py-2.5"
                    >
                      <Check size={18} />
                      Salvar e Ir para Sorteio
                    </button>
                  </div>
                )}
              </div>
          ) : null}
        </div>
      </div>

      {showGuestModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card max-w-md w-full p-6 shadow-xl"
          >
            <h2 className="text-xl font-display text-text-primary mb-4 flex items-center gap-2">
              <Plus className="text-red" />
              Adicionar Convidado
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">Nome do Convidado *</label>
                <input 
                  type="text" 
                  value={guestName} 
                  onChange={e => setGuestName(e.target.value)} 
                  className="input w-full"
                  placeholder="Ex: João Silva"
                />
              </div>

              <div>
                <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">Posição Principal *</label>
                <select 
                  value={guestPosition} 
                  onChange={e => setGuestPosition(e.target.value as Position)} 
                  className="input w-full"
                >
                  <option value="outside">Ponteiro</option>
                  <option value="setter">Levantador</option>
                  <option value="middle">Central</option>
                  <option value="opposite">Oposto</option>
                  <option value="libero">Líbero</option>
                  <option value="universal">Universal</option>
                </select>
              </div>

              <div>
                <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">Convidado por</label>
                <input 
                  type="text" 
                  value={guestInvitedBy} 
                  onChange={e => setGuestInvitedBy(e.target.value)} 
                  className="input w-full"
                  placeholder="Seu nome"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowGuestModal(false)} className="btn-secondary">
                Cancelar
              </button>
              <button 
                onClick={() => addGuestMutation.mutate({ name: guestName, main_position: guestPosition, invited_by: guestInvitedBy })}
                disabled={!guestName || addGuestMutation.isPending}
                className="btn-primary"
              >
                {addGuestMutation.isPending ? 'Adicionando...' : 'Adicionar e Marcar Presença'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
