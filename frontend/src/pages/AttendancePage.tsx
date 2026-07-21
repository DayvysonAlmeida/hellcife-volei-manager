import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarCheck, Search, Users, ChevronRight, ChevronLeft, Plus, DollarSign, Check, X, RefreshCw, AlertCircle, Share2, Trash2, Edit2, Lock, Swords, Star } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { OverallBadge } from '@/components/ui/OverallBadge';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { attendanceService, teamsService } from '@/services';
import { playersService } from '@/services/players';
import { formatDate } from '@/lib/utils';
import type { GameDay, Position } from '@/types';
import { useAuth } from '@/store/AuthContext';
import toast from 'react-hot-toast';

export function AttendancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';
  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedGameDay, setSelectedGameDay] = useState<GameDay | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('19:30');
  const [newLocation, setNewLocation] = useState('');
  const [newMaxPlayers, setNewMaxPlayers] = useState<number | ''>('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', desc: '', onConfirm: () => {} });


  // Guest modal state
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestTab, setGuestTab] = useState<'list' | 'new'>('list');
  const [guestName, setGuestName] = useState('');
  const [guestPosition, setGuestPosition] = useState<Position>('outside');
  const [guestInvitedBy, setGuestInvitedBy] = useState(user?.name || '');

  const { data: guestsData, isLoading: loadingGuests } = useQuery({
    queryKey: ['guests'],
    queryFn: () => playersService.list({ is_guest: 'true', page_size: 100 }),
    enabled: showGuestModal,
  });
  const existingGuests = guestsData?.results || [];

  const { data: gameDaysData, isLoading } = useQuery({
    queryKey: ['gamedays'],
    queryFn: () => attendanceService.listGameDays({ page_size: 50 }),
  });

  const { data: gameDayDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['gameday', selectedGameDay?.id],
    queryFn: () => attendanceService.getGameDay(selectedGameDay!.id),
    enabled: !!selectedGameDay,
  });

  const [searchTerm, setSearchTerm] = useState('');
  
  const { presentAttendances, absentAttendances, totalPaid } = useMemo(() => {
    if (!gameDayDetail) return { presentAttendances: [], absentAttendances: [], totalPaid: 0 };
    
    let filtered = gameDayDetail.attendances;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(a => a.player_name.toLowerCase().includes(lower));
    }
    
    // Sort present by name, absent by name
    filtered.sort((a, b) => a.player_name.localeCompare(b.player_name));
    
    const present = filtered.filter(a => a.present);
    const absent = filtered.filter(a => !a.present);
    const totalPaid = gameDayDetail.attendances.filter(a => a.has_paid).length;
    
    return { presentAttendances: present, absentAttendances: absent, totalPaid };
  }, [gameDayDetail, searchTerm]);

  const isToday = (dateStr: string) => {
    return new Date().toISOString().split('T')[0] === dateStr;
  };



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

  const deletePlayerMutation = useMutation({
    mutationFn: (id: number) => playersService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['gameday', selectedGameDay?.id] });
      toast.success('Convidado excluído com sucesso!');
    }
  });

  const promotePlayerMutation = useMutation({
    mutationFn: (id: number) => playersService.update(id, { is_guest: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['players'] });
      toast.success('Convidado promovido a atleta oficial!');
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

  const updateLimitMutation = useMutation({
    mutationFn: (limit: number) => attendanceService.updateGameDay(selectedGameDay!.id, { max_players: limit }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gameday', selectedGameDay?.id] });
      qc.invalidateQueries({ queryKey: ['gamedays'] });
      toast.success('Limite de jogadores atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar limite.');
    }
  });

  const handleEditLimit = () => {
    if (!gameDayDetail) return;
    const currentLimit = gameDayDetail.max_players || 0;
    const response = window.prompt('Qual o novo limite de jogadores? (Digite 0 para ilimitado)', String(currentLimit));
    
    if (response !== null) {
      const newLimit = parseInt(response.trim(), 10);
      if (!isNaN(newLimit) && newLimit >= 0) {
        updateLimitMutation.mutate(newLimit);
      } else {
        toast.error('Valor inválido para o limite.');
      }
    }
  };


  const gameDays = gameDaysData?.results || [];
  const isPastGameday = !!gameDayDetail?.date && gameDayDetail.date < todayStr;
  const showEditControls = canEdit && !isPastGameday;

  const renderAttendanceCard = (att: any) => {
    const isTogglingPresence = toggleMutation.isPending && toggleMutation.variables?.playerId === att.player;
    const isTogglingPayment = togglePaymentMutation.isPending && togglePaymentMutation.variables?.playerId === att.player;

    return (
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
              {att.player_is_guest && (
                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                  Convidado
                </span>
              )}
              {att.player_status !== 'active' && (
                <span className="text-[10px] bg-red/10 text-red px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                  Inativo
                </span>
              )}
            </p>
            <PositionBadge position={att.player_position} />
          </div>
        
        {showEditControls ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => togglePaymentMutation.mutate({ gamedayId: gameDayDetail!.id, playerId: att.player })}
              disabled={isTogglingPayment}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                att.has_paid 
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' 
                  : 'bg-surface border-2 border-border-subtle text-text-muted hover:border-green-500 hover:text-green-500'
              }`}
              title="Alternar Pagamento"
            >
              {isTogglingPayment ? <RefreshCw size={16} className="animate-spin text-text-muted" /> : <DollarSign size={20} />}
            </button>
            <button
              onClick={() => {
                if (!att.present && gameDayDetail!.max_players && gameDayDetail!.total_present >= gameDayDetail!.max_players) {
                  toast.error(`Limite de ${gameDayDetail!.max_players} jogadores já atingido!`);
                  return;
                }
                toggleMutation.mutate({ gamedayId: gameDayDetail!.id, playerId: att.player });
              }}
              disabled={isTogglingPresence}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                att.present 
                  ? 'bg-red text-white shadow-lg shadow-red/20 scale-110' 
                  : 'bg-surface border-2 border-border-subtle text-text-muted hover:border-red hover:text-red'
              }`}
              title="Alternar Presença"
            >
              {isTogglingPresence ? <RefreshCw size={16} className="animate-spin text-text-muted" /> : (att.present && <Check size={20} />)}
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
    );
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        onOpenChange={(isOpen) => setConfirmDialog(s => ({ ...s, isOpen }))}
        title={confirmDialog.title}
        description={confirmDialog.desc}
        onConfirm={confirmDialog.onConfirm}
      />

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
              <label className="text-text-muted text-xs uppercase tracking-wider">Local *</label>
              <input placeholder="Ex: Quadra HellCife" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} className="input w-full mt-1" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNewForm(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={() => createMutation.mutate()} disabled={!newDate || !newLocation || createMutation.isPending} className="btn-primary text-sm">
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
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {isToday(gd.date) && (
                          <span className="bg-red/20 text-red text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">Hoje</span>
                        )}
                        <div className="flex items-center gap-1 bg-surface-hover px-1.5 py-0.5 rounded">
                          <Users size={10} className="text-text-muted" />
                          <span className={`text-[10px] ${gd.max_players && gd.total_present >= gd.max_players ? 'text-red font-bold' : 'text-text-muted'}`}>
                            {gd.total_present}/{gd.max_players ? gd.max_players : gd.total_players}
                            {gd.max_players && gd.total_present >= gd.max_players ? ' (LOTADO)' : ''}
                          </span>
                        </div>
                        {gd.total_paid !== undefined && (
                          <div className="flex items-center gap-1 bg-green-500/10 px-1.5 py-0.5 rounded">
                            <DollarSign size={10} className="text-green-500" />
                            <span className="text-[10px] text-green-500 font-medium">
                              {gd.total_paid}/{gd.total_present}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDialog({
                              isOpen: true,
                              title: 'Excluir Pelada',
                              desc: 'Tem certeza que deseja excluir esta pelada? Todos os dados de presença serão perdidos.',
                              onConfirm: () => deleteGameDayMutation.mutate(gd.id)
                            });
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
              {isPastGameday && (
                <div className="bg-red/10 border border-red/20 text-red text-center py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                  <Lock size={14} />
                  Pelada encerrada — Exibindo histórico
                </div>
              )}
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
                <div className="flex items-center gap-6 self-center sm:self-start">
                  <div className="text-center flex flex-col items-center">
                    <p className="font-display text-3xl text-green-500">{totalPaid}</p>
                    <p className="text-text-muted text-[10px] uppercase tracking-wider mb-3">Pagaram</p>
                  </div>
                  <div className="text-center flex flex-col items-center group relative">
                    <p className="font-display text-3xl text-red">{gameDayDetail.total_present}</p>
                    <p className="text-text-muted text-[10px] uppercase tracking-wider mb-3 flex items-center justify-center gap-1">
                      de {gameDayDetail.max_players ? gameDayDetail.max_players : 'ILIMITADO'} presentes
                      {showEditControls && (
                        <button
                          onClick={handleEditLimit}
                          className="text-text-muted hover:text-red transition-colors ml-1"
                          title="Editar limite de jogadores"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                    </p>
                  </div>
                  {showEditControls && (
                    <Link
                      to="/teams"
                      className="btn-primary py-1.5 px-4 text-xs flex items-center gap-2 rounded-lg h-10 ml-2"
                    >
                      <Swords size={14} />
                      <span className="hidden sm:inline">Times</span>
                    </Link>
                  )}
                </div>
              </div>

              <div className="divider" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border mb-4 pb-3 sm:pb-0">
                <div className="flex items-center gap-4">
                  <span className="sm:pb-2 text-sm font-medium border-b-2 border-transparent sm:border-red text-red">
                    Lista de Presença
                  </span>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto sm:pb-2">
                  <div className="relative flex-1 sm:w-48">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input 
                      type="text" 
                      placeholder="Buscar jogador..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input w-full pl-8 py-1.5 text-xs bg-surface"
                    />
                  </div>
                  {showEditControls && (
                    <>
                      <button
                        onClick={() => setShowGuestModal(true)}
                        className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1"
                        title="Adicionar um convidado para jogar hoje"
                      >
                        <Plus size={12} />
                        <span className="hidden sm:inline">Convidado</span>
                      </button>
                      <button
                        onClick={() => refreshMutation.mutate()}
                        disabled={refreshMutation.isPending}
                        className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1"
                        title="Puxar novos jogadores ativos para esta lista"
                      >
                        <RefreshCw size={12} className={refreshMutation.isPending ? "animate-spin" : ""} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Seção Confirmados */}
              {presentAttendances.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Check size={14} className="text-green-500" /> Confirmados ({presentAttendances.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {presentAttendances.map(att => renderAttendanceCard(att))}
                  </div>
                </div>
              )}

              {/* Seção Pendentes / Ausentes */}
              {absentAttendances.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Users size={14} /> Aguardando / Ausentes ({absentAttendances.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {absentAttendances.map(att => renderAttendanceCard(att))}
                  </div>
                </div>
              )}

              {presentAttendances.length === 0 && absentAttendances.length === 0 && (
                 <p className="text-text-muted text-center py-8">
                   {searchTerm ? `Nenhum jogador encontrado com "${searchTerm}".` : "Nenhum jogador na lista."}
                 </p>
              )}
                
              {showEditControls && (
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
            className="card max-w-md w-full p-6 shadow-xl flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-display text-text-primary flex items-center gap-2">
                <Users className="text-red" />
                Gerenciar Convidados
              </h2>
              <button onClick={() => setShowGuestModal(false)} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border mb-4">
              <button
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${guestTab === 'list' ? 'border-red text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                onClick={() => setGuestTab('list')}
              >
                Selecionar Existente
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${guestTab === 'new' ? 'border-red text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                onClick={() => setGuestTab('new')}
              >
                Novo Convidado
              </button>
            </div>
            
            {guestTab === 'new' && (
              <div className="space-y-4 overflow-y-auto pr-2">
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

                <div className="flex justify-end pt-4 mt-2 border-t border-border">
                  <button 
                    onClick={() => addGuestMutation.mutate({ name: guestName, main_position: guestPosition, invited_by: guestInvitedBy })}
                    disabled={!guestName || addGuestMutation.isPending}
                    className="btn-primary"
                  >
                    {addGuestMutation.isPending ? 'Adicionando...' : 'Adicionar à Pelada'}
                  </button>
                </div>
              </div>
            )}

            {guestTab === 'list' && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {loadingGuests ? (
                  <div className="py-8 text-center text-text-muted animate-pulse">Carregando convidados...</div>
                ) : existingGuests.length === 0 ? (
                  <div className="py-12 text-center text-text-muted">
                    <p>Nenhum convidado salvo no histórico.</p>
                    <button onClick={() => setGuestTab('new')} className="mt-4 text-red hover:underline text-sm font-bold">
                      Cadastrar o primeiro convidado
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 overflow-y-auto pr-2 pb-2">
                    {existingGuests.map(guest => {
                      const alreadyInGame = presentAttendances.some(a => a.player === guest.id) || absentAttendances.some(a => a.player === guest.id);
                      
                      return (
                        <div key={guest.id} className="flex items-center justify-between bg-surface/50 p-3 rounded-xl border border-border">
                          <div className="flex items-center gap-3">
                            <Avatar name={guest.name} src={guest.avatar_url} size="sm" />
                            <div>
                              <p className="text-sm font-bold text-text-primary">{guest.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <PositionBadge position={guest.main_position} />
                                {guest.invited_by && (
                                  <span className="text-[9px] text-text-muted uppercase truncate max-w-[80px]">
                                    Por: {guest.invited_by}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setConfirmDialog({
                                  isOpen: true,
                                  title: 'Promover a Oficial',
                                  desc: `Deseja transformar ${guest.name} em um Atleta Oficial? Ele passará a aparecer nas estatísticas principais e ranking do Dashboard.`,
                                  onConfirm: () => promotePlayerMutation.mutate(guest.id)
                                });
                              }}
                              disabled={promotePlayerMutation.isPending}
                              className="p-1.5 text-yellow-500 hover:bg-yellow-500/10 rounded-md transition-colors"
                              title="Promover a Oficial"
                            >
                              <Star size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setConfirmDialog({
                                  isOpen: true,
                                  title: 'Excluir Convidado',
                                  desc: `Tem certeza que deseja apagar o convidado ${guest.name} do sistema? (Isso removerá ele do histórico de jogos)`,
                                  onConfirm: () => deletePlayerMutation.mutate(guest.id)
                                });
                              }}
                              disabled={deletePlayerMutation.isPending}
                              className="p-1.5 text-text-muted hover:text-red hover:bg-red/10 rounded-md transition-colors"
                              title="Excluir Convidado"
                            >
                              <Trash2 size={16} />
                            </button>
                            
                            <button
                              onClick={() => {
                                toggleMutation.mutate({ gamedayId: gameDayDetail!.id, playerId: guest.id });
                                toast.success(`${guest.name} jogado na pelada!`);
                              }}
                              disabled={alreadyInGame || toggleMutation.isPending}
                              className={`p-1.5 rounded-md transition-colors flex items-center gap-1 px-2 text-xs font-bold ${
                                alreadyInGame 
                                  ? 'bg-surface border border-border text-text-muted cursor-not-allowed' 
                                  : 'bg-red text-white hover:bg-red-500 shadow-md shadow-red/20'
                              }`}
                              title={alreadyInGame ? "Já está na pelada" : "Adicionar à pelada atual"}
                            >
                              {alreadyInGame ? <Check size={14} /> : <Plus size={14} />}
                              <span className="hidden sm:inline">{alreadyInGame ? 'Add' : 'Add'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
