import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, ChevronRight, ChevronLeft, Plus, DollarSign, Share2, Trash2, Edit2, Lock, Swords, RefreshCw } from 'lucide-react';

import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { GameDayForm } from '@/components/attendance/GameDayForm';
import { GuestModal } from '@/components/attendance/GuestModal';
import { AttendanceList } from '@/components/attendance/AttendanceList';

import { attendanceService } from '@/services';
import { formatDate } from '@/lib/utils';
import type { GameDay } from '@/types';
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
  const [showEditForm, setShowEditForm] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', desc: '', onConfirm: () => {} });
  const [searchTerm, setSearchTerm] = useState('');
  const [circuitTab, setCircuitTab] = useState<'active' | 'history'>('active');

  const { data: gameDaysData, isLoading } = useQuery({
    queryKey: ['gamedays'],
    queryFn: () => attendanceService.listGameDays({ page_size: 50 }),
  });
  const gameDays = gameDaysData?.results || [];

  const { data: gameDayDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['gameday', selectedGameDay?.id],
    queryFn: () => attendanceService.getGameDay(selectedGameDay!.id),
    enabled: !!selectedGameDay,
  });

  // A auto-seleção foi removida para garantir que no mobile o usuário veja a lista de circuitos primeiro.

  const { activeGameDays, historyGameDays } = useMemo(() => {
    const active = gameDays.filter(gd => !gd.is_closed && gd.date >= todayStr);
    const history = gameDays.filter(gd => gd.is_closed || gd.date < todayStr);
    return { activeGameDays: active, historyGameDays: history };
  }, [gameDays, todayStr]);

  const { presentAttendances, absentAttendances, waitlistAttendances, totalPaid } = useMemo(() => {
    if (!gameDayDetail) return { presentAttendances: [], absentAttendances: [], waitlistAttendances: [], totalPaid: 0 };
    
    let filtered = gameDayDetail.attendances;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.player_name.toLowerCase().includes(lower) || 
        (a.player_invited_by && a.player_invited_by.toLowerCase().includes(lower))
      );
    }
    
    // Sort present by name, absent by name
    filtered.sort((a, b) => a.player_name.localeCompare(b.player_name));
    
    const present = filtered.filter(a => a.present);
    const absent = filtered.filter(a => !a.present && !a.is_waitlist);
    
    // Fila de espera: ordenar por membro primeiro, depois por ordem de chegada
    const waitlist = filtered.filter(a => !a.present && a.is_waitlist).sort((a: any, b: any) => {
      if (a.player_is_guest !== b.player_is_guest) return a.player_is_guest ? 1 : -1;
      if (a.waitlist_joined_at && b.waitlist_joined_at) {
        return new Date(a.waitlist_joined_at).getTime() - new Date(b.waitlist_joined_at).getTime();
      }
      return 0;
    });

    const totalPaid = gameDayDetail.attendances.filter(a => a.has_paid).length;
    
    return { presentAttendances: present, absentAttendances: absent, waitlistAttendances: waitlist, totalPaid };
  }, [gameDayDetail, searchTerm]);

  const { courtPrice, rateio, totalCollected, remaining } = useMemo(() => {
    if (!gameDayDetail || !gameDayDetail.court_price) return { courtPrice: 0, rateio: 0, totalCollected: 0, remaining: 0 };
    const cp = Number(gameDayDetail.court_price);
    const rat = gameDayDetail.total_present > 0 ? cp / gameDayDetail.total_present : 0;
    const coll = totalPaid * rat;
    const rem = Math.max(0, cp - coll);
    return { courtPrice: cp, rateio: rat, totalCollected: coll, remaining: rem };
  }, [gameDayDetail, totalPaid]);

  const isClosedGameday = !!gameDayDetail?.is_closed || (!!gameDayDetail?.date && gameDayDetail.date < todayStr);
  const showEditControls = canEdit && !isClosedGameday;

  // Mutations
  const toggleMutation = useMutation({
    mutationFn: ({ gamedayId, playerId }: { gamedayId: number; playerId: number }) =>
      attendanceService.toggleAttendance(gamedayId, playerId),
    onMutate: async ({ gamedayId, playerId }) => {
      await qc.cancelQueries({ queryKey: ['gameday', gamedayId] });
      const previousGameday = qc.getQueryData(['gameday', gamedayId]);
      
      qc.setQueryData(['gameday', gamedayId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          attendances: old.attendances.map((att: any) => 
            att.player === playerId ? { ...att, present: !att.present } : att
          )
        };
      });
      return { previousGameday };
    },
    onError: (err, newTodo, context) => {
      qc.setQueryData(['gameday', selectedGameDay?.id], context?.previousGameday);
      toast.error('Erro ao marcar presença.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['gameday', selectedGameDay?.id] }),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ gamedayId, presentPlayerIds }: { gamedayId: number, presentPlayerIds: number[] }) =>
      attendanceService.bulkAttendance(gamedayId, presentPlayerIds),
    onSuccess: (_, { gamedayId }) => {
      qc.invalidateQueries({ queryKey: ['gameday', gamedayId] });
      toast.success('Lista atualizada com sucesso!');
    },
    onError: () => toast.error('Erro ao processar atualização em lote.')
  });

  const togglePaymentMutation = useMutation({
    mutationFn: ({ gamedayId, playerId }: { gamedayId: number; playerId: number }) =>
      attendanceService.togglePayment(gamedayId, playerId),
    onMutate: async ({ gamedayId, playerId }) => {
      await qc.cancelQueries({ queryKey: ['gameday', gamedayId] });
      const previousGameday = qc.getQueryData(['gameday', gamedayId]);
      
      qc.setQueryData(['gameday', gamedayId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          attendances: old.attendances.map((att: any) => 
            att.player === playerId ? { ...att, paid: !att.paid } : att
          )
        };
      });
      return { previousGameday };
    },
    onError: (err, variables, context) => {
      qc.setQueryData(['gameday', selectedGameDay?.id], context?.previousGameday);
      toast.error('Erro ao registrar pagamento.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['gameday', selectedGameDay?.id] }),
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

  const promoteWaitlistMutation = useMutation({
    mutationFn: () => attendanceService.promoteWaitlist(selectedGameDay!.id),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['gameday', selectedGameDay?.id] });
      toast.success(data.detail || 'Jogador promovido!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Erro ao promover jogador da fila.');
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
          <h1 className="page-title">Circuito Hellcife</h1>
          <p className="page-subtitle">Registro de presença por dia de circuito.</p>
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-col sm:flex-row">
            <button
              onClick={() => {
                setConfirmDialog({
                  isOpen: true,
                  title: 'Recalcular Faltas',
                  desc: 'Isso vai analisar todos os circuitos antigos encerrados e recalcular as faltas (no-shows) de todo mundo na base de dados. Tem certeza?',
                  onConfirm: () => {
                    const promise = attendanceService.processPastAbsences().then(() => qc.invalidateQueries({ queryKey: ['gamedays'] }));
                    toast.promise(promise, {
                      loading: 'Processando...',
                      success: (data: any) => data.detail || 'Faltas recalculadas!',
                      error: 'Erro ao processar faltas.',
                    });
                  }
                });
              }}
              className="btn-secondary flex items-center justify-center gap-2"
              title="Sincronizar faltas retroativas"
            >
              <RefreshCw size={16} />
              Sincronizar Faltas
            </button>
            <button onClick={() => setShowNewForm(!showNewForm)} className="btn-primary flex items-center justify-center gap-2">
              <Plus size={16} />
              Novo Circuito
            </button>
          </div>
        )}
      </div>

      {showNewForm && <GameDayForm onClose={() => setShowNewForm(false)} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Game days list */}
        <div className={`card p-4 ${selectedGameDay ? 'hidden lg:block' : 'block'}`}>
          <div className="flex items-center gap-4 mb-4 border-b border-border">
            <button
              onClick={() => setCircuitTab('active')}
              className={`pb-2 px-1 text-sm font-bold border-b-2 transition-colors ${circuitTab === 'active' ? 'border-red text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
            >
              Abertos ({activeGameDays.length})
            </button>
            <button
              onClick={() => setCircuitTab('history')}
              className={`pb-2 px-1 text-sm font-bold border-b-2 transition-colors ${circuitTab === 'history' ? 'border-red text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
            >
              Histórico ({historyGameDays.length})
            </button>
          </div>
          {isLoading ? (
            <PageLoading />
          ) : gameDays.length === 0 ? (
            <EmptyState message="Nenhum dia de jogo cadastrado." icon="📅" />
          ) : (circuitTab === 'active' ? activeGameDays : historyGameDays).length === 0 ? (
            <EmptyState message={`Nenhum circuito ${circuitTab === 'active' ? 'aberto' : 'no histórico'}.`} icon="📅" />
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {(circuitTab === 'active' ? activeGameDays : historyGameDays).map((gd) => (
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
                        <div className="flex items-center gap-1 bg-surface-hover px-1.5 py-0.5 rounded border border-border">
                          <span className={`w-1.5 h-1.5 rounded-full ${gd.max_players && gd.total_present >= gd.max_players ? 'bg-red' : 'bg-green-500'}`} />
                          <span className="text-[10px] text-text-muted font-medium">
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
              {isClosedGameday && (
                <div className="bg-red/10 border border-red/20 text-red text-center py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                  <Lock size={14} />
                  Circuito encerrado — Exibindo histórico
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setSelectedGameDay(null)}
                    className="lg:hidden mt-1 px-3 py-1.5 -ml-2 rounded-lg text-text-muted hover:bg-surface hover:text-text-primary transition-colors flex items-center gap-1 font-medium text-sm"
                  >
                    <ChevronLeft size={20} />
                    Voltar aos Circuitos
                  </button>
                  <div>
                    <div className="flex items-center gap-4">
                      <h2 className="font-display text-xl tracking-wider text-text-primary flex items-center gap-2">
                        {formatDate(gameDayDetail.date)} {gameDayDetail.time ? `- ${gameDayDetail.time.slice(0, 5)}` : ''} {gameDayDetail.time_end ? `às ${gameDayDetail.time_end.slice(0, 5)}` : ''}
                      </h2>
                      {showEditControls && (
                        <button
                          onClick={() => setShowEditForm(!showEditForm)}
                          className="btn-ghost p-1 text-text-muted hover:text-red transition-colors"
                          title="Editar Circuito"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </div>
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
              
              {gameDayDetail.court_price && (
                <div className="p-3 bg-surface-hover rounded-xl border border-border flex items-center justify-between text-sm flex-wrap gap-4">
                  <div className="flex-1 min-w-[100px]">
                    <p className="text-text-muted text-[10px] uppercase tracking-wider">Valor da Quadra</p>
                    <p className="font-bold text-text-primary">R$ {courtPrice.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <p className="text-text-muted text-[10px] uppercase tracking-wider">Rateio (Por Atleta)</p>
                    <p className="font-bold text-text-primary">R$ {rateio.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <p className="text-text-muted text-[10px] uppercase tracking-wider">Arrecadado</p>
                    <p className="font-bold text-green-500">R$ {totalCollected.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <p className="text-text-muted text-[10px] uppercase tracking-wider">Falta Arrecadar</p>
                    <p className="font-bold text-red">R$ {remaining.toFixed(2).replace('.', ',')}</p>
                  </div>
                </div>
              )}

              {showEditForm && canEdit && (
                <div className="mt-4 border-t border-border pt-4">
                  <GameDayForm initialData={gameDayDetail} onClose={() => setShowEditForm(false)} />
                </div>
              )}

              <div className="divider" />

              <AttendanceList
                presentAttendances={presentAttendances}
                absentAttendances={absentAttendances}
                waitlistAttendances={waitlistAttendances}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                showEditControls={showEditControls}
                onAddGuestClick={() => setShowGuestModal(true)}
                onRefreshClick={() => refreshMutation.mutate()}
                isRefreshing={refreshMutation.isPending}
                onPromoteWaitlist={() => promoteWaitlistMutation.mutate()}
                isPromoting={promoteWaitlistMutation.isPending}
                onSaveClick={() => {
                  toast.success('Lista de presença salva com sucesso!');
                  navigate('/teams');
                }}
                onTogglePresence={(playerId) => toggleMutation.mutate({ gamedayId: gameDayDetail.id, playerId })}
                onTogglePayment={(playerId) => togglePaymentMutation.mutate({ gamedayId: gameDayDetail.id, playerId })}
                isTogglingPresence={(playerId) => toggleMutation.isPending && toggleMutation.variables?.playerId === playerId}
                isTogglingPayment={(playerId) => togglePaymentMutation.isPending && togglePaymentMutation.variables?.playerId === playerId}
                onCheckAll={() => {
                  if (gameDayDetail) {
                    const allIds = gameDayDetail.attendances.map((a: any) => a.player);
                    bulkMutation.mutate({ gamedayId: gameDayDetail.id, presentPlayerIds: allIds });
                  }
                }}
                onUncheckAll={() => {
                  if (gameDayDetail) {
                    bulkMutation.mutate({ gamedayId: gameDayDetail.id, presentPlayerIds: [] });
                  }
                }}
                isBulkLoading={bulkMutation.isPending}
              />
            </div>
          ) : null}
        </div>
      </div>

      <GuestModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        gameDayId={selectedGameDay?.id || 0}
        presentAttendances={presentAttendances}
        absentAttendances={absentAttendances}
        setConfirmDialog={setConfirmDialog}
      />
    </div>
  );
}
