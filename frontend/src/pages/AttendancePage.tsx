import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, ChevronLeft, Share2, Edit2, Lock, RefreshCw, Eye, EyeOff, Clock, Users, DollarSign, X, ClipboardCheck } from 'lucide-react';

import { PageLoading } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { GameDayForm } from '@/components/attendance/GameDayForm';
import { GuestModal } from '@/components/attendance/GuestModal';
import { AttendanceList } from '@/components/attendance/AttendanceList';
import { CircuitCard } from '@/components/attendance/CircuitCard';
import { PaymentConfirmModal, type PaymentTarget } from '@/components/attendance/PaymentConfirmModal';
import { invalidatePaymentQueries } from '@/lib/paymentQueries';

import { attendanceService } from '@/services';
import { cn, formatBRL } from '@/lib/utils';
import type { GameDay } from '@/types';
import { useAuth } from '@/store/AuthContext';
import toast from 'react-hot-toast';

export function AttendancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';
  const todayStr = new Date().toLocaleDateString('en-CA');

  const [selectedGameDay, setSelectedGameDay] = useState<GameDay | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', desc: '', onConfirm: () => {} });
  const [searchTerm, setSearchTerm] = useState('');
  const [circuitTab, setCircuitTab] = useState<'active' | 'history'>('active');
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);

  const { data: gameDaysData } = useQuery({
    queryKey: ['gamedays'],
    queryFn: () => attendanceService.listGameDays({ page_size: 50 }),
  });
  const gameDays = useMemo(() => gameDaysData?.results || [], [gameDaysData]);

  const { data: gameDayDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['gameday', selectedGameDay?.id],
    queryFn: () => attendanceService.getGameDay(selectedGameDay!.id),
    enabled: !!selectedGameDay,
  });

  const { data: finance } = useQuery({
    queryKey: ['gameday-finance', selectedGameDay?.id],
    queryFn: () => attendanceService.getFinance(selectedGameDay!.id),
    enabled: !!selectedGameDay && canEdit,
  });

  // A auto-seleção foi removida para garantir que no mobile o usuário veja a lista de circuitos primeiro.

  const { activeGameDays, historyGameDays } = useMemo(() => {
    const active = gameDays.filter(gd => !gd.is_closed);
    const history = gameDays.filter(gd => gd.is_closed);
    
    active.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return { activeGameDays: active, historyGameDays: history };
  }, [gameDays]);

  const { presentAttendances, reservedAttendances, absentAttendances, waitlistAttendances, totalPaid, totalCreditsUsed } = useMemo(() => {
    if (!gameDayDetail) return { presentAttendances: [], reservedAttendances: [], absentAttendances: [], waitlistAttendances: [], totalPaid: 0, totalCreditUsers: 0, totalCreditsUsed: 0 };
    
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
    const reserved = filtered.filter(a => a.is_reserved);
    const absent = filtered.filter(a => !a.present && !a.is_waitlist && !a.is_reserved);
    
    // Fila de espera: ordenar por membro primeiro, depois por ordem de chegada
    const waitlist = filtered.filter(a => !a.present && a.is_waitlist).sort((a: any, b: any) => {
      if (a.player_is_guest !== b.player_is_guest) return a.player_is_guest ? 1 : -1;
      if (a.waitlist_joined_at && b.waitlist_joined_at) {
        return new Date(a.waitlist_joined_at).getTime() - new Date(b.waitlist_joined_at).getTime();
      }
      return 0;
    });

    const totalPaid = gameDayDetail.attendances.filter(a => a.has_paid).length;
    const totalCreditUsers = gameDayDetail.attendances.filter(a => a.used_credit).length;
    const totalCreditsUsed = gameDayDetail.attendances.reduce((sum, a) => sum + (Number(a.credits_used) || (a.used_credit ? 1 : 0)), 0);
    
    return { presentAttendances: present, reservedAttendances: reserved, absentAttendances: absent, waitlistAttendances: waitlist, totalPaid, totalCreditUsers, totalCreditsUsed };
  }, [gameDayDetail, searchTerm]);

  const collected = Number(finance?.collected ?? 0);
  const courtCost = Number(finance?.court_cost ?? 0);
  // Meta da barra: custo da quadra; sem custo, o total previsto
  const goal = courtCost > 0 ? courtCost : Number(finance?.expected ?? 0);
  const goalPct = goal > 0 ? Math.min(100, Math.round((collected / goal) * 100)) : 0;
  const balance = Number(finance?.balance ?? 0);

  const isClosedGameday = !!gameDayDetail?.is_closed;
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
            att.player !== playerId ? att
              : att.is_reserved ? { ...att, is_reserved: false }
              : { ...att, present: !att.present }
          )
        };
      });
      return { previousGameday };
    },
    onError: (err, newTodo, context) => {
      qc.setQueryData(['gameday', selectedGameDay?.id], context?.previousGameday);
      toast.error('Erro ao marcar presença.');
    },
    onSettled: (_data, _err, { gamedayId }) => invalidatePaymentQueries(qc, gamedayId),
  });

  const bulkPaymentMutation = useMutation({
    mutationFn: ({ gamedayId, actionType }: { gamedayId: number, actionType: 'check_all' | 'uncheck_all' }) =>
      attendanceService.bulkPayment(gamedayId, actionType),
    onSuccess: (_, { gamedayId }) => {
      invalidatePaymentQueries(qc, gamedayId);
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
            att.player === playerId ? { ...att, has_paid: !att.has_paid } : att
          )
        };
      });
      return { previousGameday };
    },
    onError: (err, variables, context) => {
      qc.setQueryData(['gameday', selectedGameDay?.id], context?.previousGameday);
      toast.error('Erro ao registrar pagamento.');
    },
    onSettled: (_data, _err, { gamedayId }) => invalidatePaymentQueries(qc, gamedayId),
  });

  const refreshMutation = useMutation({
    mutationFn: () => attendanceService.refreshList(selectedGameDay!.id),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['gameday', selectedGameDay?.id] });
      qc.invalidateQueries({ queryKey: ['gamedays'] });
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
      qc.invalidateQueries({ queryKey: ['gamedays'] });
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

  const publishMutation = useMutation({
    mutationFn: (is_published: boolean) => attendanceService.updateGameDay(selectedGameDay!.id, { is_published }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['gameday', selectedGameDay?.id] });
      qc.invalidateQueries({ queryKey: ['gamedays'] });
      toast.success(data.is_published ? 'Circuito publicado! Agora os atletas podem vê-lo.' : 'Circuito ocultado. Apenas admins podem vê-lo.');
    },
    onError: () => {
      toast.error('Erro ao alterar visibilidade.');
    }
  });

  const toggleCloseMutation = useMutation({
    mutationFn: (is_closed: boolean) => attendanceService.updateGameDay(selectedGameDay!.id, { is_closed }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['gameday', selectedGameDay?.id] });
      qc.invalidateQueries({ queryKey: ['gamedays'] });
      if (data.is_closed) {
        toast.success('Circuito encerrado! Inscrições finalizadas e presenças consolidadas.');
      } else {
        toast.success('Circuito reaberto com sucesso!');
      }
    },
    onError: () => {
      toast.error('Erro ao atualizar status de encerramento.');
    }
  });

  const _handleEditLimit = () => {
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

      {!selectedGameDay && (
        <div className="flex flex-col mb-6 relative">
          <div className="absolute -top-8 -left-8 w-32 h-32 bg-red/20 blur-[40px] rounded-full pointer-events-none" />
          
          <div className="flex justify-between items-start w-full relative z-10 mb-4">
            <div>
              <div className="flex flex-col items-start mb-2">
                 <span className="text-xl font-black uppercase tracking-tighter text-red drop-shadow-md">HELLCIFE</span>
                 <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-500 -mt-1 drop-shadow-md">VÔLEI</span>
              </div>
              <h1 className="font-display italic text-[48px] sm:text-[56px] text-white uppercase tracking-tight leading-[0.9] drop-shadow-md">
                CRIAÇÃO DE<br /> <span className="text-red">CIRCUITOS</span>
              </h1>
            </div>
            
            {canEdit && (
              <button 
                onClick={() => setShowNewForm(!showNewForm)} 
                className="bg-[#5a0000] hover:bg-red-700 text-white px-4 sm:px-5 py-3 sm:py-4 rounded-[20px] flex items-center justify-center gap-2 font-display uppercase tracking-wider text-sm sm:text-base transition-all border-2 border-red shadow-[0_0_20px_rgba(217,4,41,0.25)] flex-shrink-0 mt-6"
              >
                <span className="text-4xl sm:text-5xl font-light leading-none mb-1">+</span>
                <div className="flex flex-col items-start leading-none text-left">
                  <span>NOVO</span>
                  <span>CIRCUITO</span>
                </div>
              </button>
            )}
          </div>
          
          <p className="text-white/60 text-xs mt-1 font-medium max-w-xl leading-relaxed relative z-10">
            Aqui é onde criamos o circuito e lançamos quem vai participar de acordo com a quantidade de vagas. As pessoas confirmam presença no link público e os administradores gerenciam a lista (incluindo convidados e pagamentos).
          </p>
        </div>
      )}

      {showNewForm && !selectedGameDay && <GameDayForm onClose={() => setShowNewForm(false)} />}

      {!selectedGameDay ? (
        <div className="space-y-6 relative z-10">
          {/* Tabs */}
          <div className="flex w-full rounded-2xl bg-black border border-[#222] p-1 h-[52px]">
            <button
              onClick={() => setCircuitTab('active')}
              className={`flex-1 flex items-center justify-center rounded-xl font-black uppercase tracking-widest text-xs transition-all ${
                circuitTab === 'active' 
                  ? 'bg-[#2a0000] text-white border border-red/50 shadow-lg' 
                  : 'text-white/40 hover:text-white'
              }`}
            >
              ABERTOS ({activeGameDays.length})
            </button>
            <button
              onClick={() => setCircuitTab('history')}
              className={`flex-1 flex items-center justify-center rounded-xl font-black uppercase tracking-widest text-xs transition-all ${
                circuitTab === 'history' 
                  ? 'bg-[#2a0000] text-white border border-red/50 shadow-lg' 
                  : 'text-white/40 hover:text-white'
              }`}
            >
              HISTÓRICO ({historyGameDays.length})
            </button>
          </div>

          {/* List */}
          <div className="grid grid-cols-1 gap-4 pb-12">
            {(circuitTab === 'active' ? activeGameDays : historyGameDays).map(gd => {
              const isPastDate = gd.date < todayStr;
              const badge = gd.is_closed ? (
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-red/20 text-red border border-red/30 font-bold">
                  ENCERRADO
                </span>
              ) : isPastDate ? (
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold flex items-center gap-1">
                  <Clock size={8} /> EM ANDAMENTO
                </span>
              ) : null;
              return <CircuitCard key={gd.id} gameDay={gd} onClick={() => setSelectedGameDay(gd)} badge={badge} />;
            })}
            {(circuitTab === 'active' ? activeGameDays : historyGameDays).length === 0 && (
              <div className="text-center py-12 text-text-muted bg-surface/30 rounded-2xl border border-border/50">
                Nenhum circuito encontrado nesta categoria.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full">
          {loadingDetail ? (
            <PageLoading />
          ) : gameDayDetail ? (
            <div className="sm:card sm:p-5 flex flex-col gap-4">
              {isClosedGameday ? (
                <div className="bg-red/10 border border-red/20 text-red text-center py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                  <Lock size={14} /> Circuito encerrado — Presenças e faltas consolidadas
                </div>
              ) : gameDayDetail.date < todayStr ? (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-center py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                  <Clock size={14} /> Circuito em andamento — O horário previsto passou, mas a lista permanece aberta para edições e conferência de pagamentos.
                </div>
              ) : null}
              {/* Novo Header Layout */}
              <div className="flex flex-col gap-6">
                
                {/* Botão de Voltar e Cabeçalho Principal */}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col gap-4 flex-1">
                    <button
                      onClick={() => setSelectedGameDay(null)}
                      className="flex items-center text-text-muted hover:text-white transition-colors w-fit gap-1 text-[10px] sm:text-xs font-bold uppercase tracking-widest bg-surface/50 hover:bg-surface px-2 py-1 rounded-lg border border-border"
                    >
                      <ChevronLeft size={16} /> Voltar
                    </button>

                    <h2 className="font-display text-4xl sm:text-5xl uppercase tracking-tighter text-white leading-[0.9] drop-shadow-md">
                      {gameDayDetail.location || 'ARENA BELO GOL'}
                    </h2>
                    
                    <div className="flex flex-col gap-1.5 text-text-muted font-medium text-xs">
                      <div className="flex items-center gap-2">
                        <CalendarCheck size={14} className="text-white/40" />
                        <span className="uppercase tracking-widest font-black text-white/80">
                          {(() => {
                            const dateObj = new Date(`${gameDayDetail.date}T12:00:00`);
                            const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').substring(0,3);
                            const dayNum = dateObj.toLocaleDateString('pt-BR', { day: '2-digit' });
                            const month = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').substring(0,3);
                            const year = dateObj.toLocaleDateString('pt-BR', { year: 'numeric' });
                            return `${dayName} • ${dayNum} ${month} ${year}`;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-white/40" />
                        <span className="uppercase tracking-widest font-black text-white/80">
                          {gameDayDetail.time ? gameDayDetail.time.slice(0, 5) : '00:00'} às {gameDayDetail.time_end ? gameDayDetail.time_end.slice(0, 5) : '23:59'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Imagem no canto superior direito */}
                  <div className="relative w-28 h-20 sm:w-48 sm:h-32 rounded-2xl overflow-hidden border border-[#2a2a2a] shadow-lg flex-shrink-0 mt-4 sm:mt-0">
                     <div 
                        className="absolute inset-0 bg-cover bg-center mix-blend-screen opacity-80"
                        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?q=80&w=600&auto=format&fit=crop")' }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                      
                      {/* Botões de Ação sobre a imagem (Editar, etc) */}
                      {showEditControls && (
                        <div className="absolute top-2 right-2 flex flex-col gap-1.5">
                          <button
                            onClick={() => setShowEditForm(!showEditForm)}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-black transition-colors shadow-lg"
                            title="Editar Circuito"
                          >
                            <Edit2 size={12} />
                          </button>
                          
                          {canEdit && (
                            <button
                              onClick={() => {
                                setConfirmDialog({
                                  isOpen: true,
                                  title: 'Excluir Circuito',
                                  desc: 'Tem certeza que deseja excluir este circuito? Todos os dados de presença serão perdidos.',
                                  onConfirm: () => deleteGameDayMutation.mutate(gameDayDetail.id)
                                });
                              }}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 backdrop-blur-md border border-red/30 flex items-center justify-center text-red hover:bg-red hover:text-white transition-colors shadow-lg"
                              title="Excluir"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      )}
                  </div>
                </div>

                {/* BOTOES DE AÇÃO COMPLEMENTARES */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#222]">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/checkin/${gameDayDetail.id}`;
                      navigator.clipboard.writeText(url);
                      toast.success('Link de check-in copiado!');
                    }}
                    className="text-[10px] bg-red/10 hover:bg-red/20 hover:shadow-[0_0_15px_rgba(217,4,41,0.2)] text-red border border-red/20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-black uppercase tracking-widest"
                  >
                    <Share2 size={12} strokeWidth={3} />
                    Link Inscrição
                  </button>
                  
                  {showEditControls && (
                    <>
                      <button
                        onClick={() => publishMutation.mutate(!gameDayDetail.is_published)}
                        disabled={publishMutation.isPending}
                        className={cn(
                          "text-[10px] flex items-center gap-1.5 font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all border",
                          gameDayDetail.is_published 
                            ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20 hover:shadow-[0_0_15px_rgba(34,197,94,0.2)]" 
                            : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                        )}
                      >
                        {gameDayDetail.is_published ? <Eye size={12} strokeWidth={3} /> : <EyeOff size={12} strokeWidth={3} />}
                        {gameDayDetail.is_published ? 'Publicado' : 'Oculto'}
                      </button>
                      
                      <Link
                        to="/teams"
                        className="text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-black uppercase tracking-widest"
                      >
                        <ClipboardCheck size={12} strokeWidth={3} />
                        Tirar Faltas
                      </Link>
                    </>
                  )}

                  {canEdit && (
                    <button
                      onClick={() => {
                        if (!gameDayDetail.is_closed) {
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Encerrar Circuito',
                            desc: 'Tem certeza que deseja encerrar este circuito? As inscrições serão finalizadas e as presenças/faltas serão consolidadas.',
                            onConfirm: () => toggleCloseMutation.mutate(true)
                          });
                        } else {
                          toggleCloseMutation.mutate(false);
                        }
                      }}
                      disabled={toggleCloseMutation.isPending}
                      className={cn(
                        "text-[10px] flex items-center gap-1.5 font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all border",
                        gameDayDetail.is_closed
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                          : "bg-red/10 text-red border-red/30 hover:bg-red/20 hover:shadow-[0_0_15px_rgba(217,4,41,0.2)]"
                      )}
                    >
                      {gameDayDetail.is_closed ? <RefreshCw size={12} strokeWidth={3} /> : <Lock size={12} strokeWidth={3} />}
                      {gameDayDetail.is_closed ? 'Reabrir Circuito' : 'Encerrar Circuito'}
                    </button>
                  )}
                </div>

                {/* CARDS DE ESTATÍSTICAS (Baseado no Print) */}
                <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-2">
                  {/* Card 1: Presentes */}
                  <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-2.5 sm:p-4 flex flex-col justify-between cursor-pointer hover:border-green-500/50 transition-colors group" onClick={_handleEditLimit}>
                    <div>
                      <div className="flex items-baseline gap-0.5">
                        <div className="font-display text-2xl sm:text-4xl text-green-500 leading-none">
                          {gameDayDetail.total_present}
                        </div>
                        {(gameDayDetail.max_players ?? 0) > 0 && (
                          <div className="font-display text-sm sm:text-xl text-white/20 leading-none">
                            /{gameDayDetail.max_players}
                          </div>
                        )}
                      </div>
                      <div className="text-[9px] sm:text-xs font-bold text-white uppercase tracking-widest mt-1">
                        Confirmados
                      </div>
                    </div>
                    <Users size={14} className="text-white/20 mt-2 sm:mt-4 group-hover:text-green-500/40 transition-colors self-end" />
                  </div>

                  {/* Card 2: Créditos Usados / Pagaram */}
                  <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-2.5 sm:p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-baseline gap-0.5">
                        <div className="font-display text-2xl sm:text-4xl text-amber-500 leading-none">
                          {totalCreditsUsed}
                        </div>
                        <div className="font-display text-sm sm:text-xl text-white/20 leading-none">
                          crd.
                        </div>
                      </div>
                      <div className="text-[9px] sm:text-xs font-bold text-white uppercase tracking-widest mt-1">
                        Créditos Usados
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 sm:mt-4 self-end text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white/50">
                      <span className="text-emerald-400">{totalPaid}</span> Pagaram <DollarSign size={10} className="text-emerald-400" />
                    </div>
                  </div>

                  {/* Card 3: Financeiro do circuito (Ocupa linha inteira) */}
                  {finance && (Number(finance.price_per_person) > 0 || courtCost > 0) && (
                    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-3 sm:p-4 flex flex-col gap-3 col-span-2">
                      <div className="flex justify-between items-start w-full gap-3">
                        <div className="flex flex-col">
                          <span className="text-[9px] sm:text-xs font-bold text-white/60 uppercase tracking-widest">Arrecadado</span>
                          <span className="font-bold text-base sm:text-xl text-green-500">{formatBRL(collected)}</span>
                          {goal > 0 && (
                            <span className="text-[8px] sm:text-[9px] text-white/40 uppercase font-black mt-0.5">
                              {courtCost > 0 ? 'Quadra' : 'Previsto'}: {formatBRL(goal)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end text-right">
                          <span className="text-[9px] sm:text-[10px] font-bold text-white/60 uppercase">
                            {formatBRL(finance.price_per_person)} <span className="text-white/40">/ atleta</span>
                          </span>
                          <span className="text-[7px] sm:text-[8px] text-white/40 uppercase font-black">
                            {finance.pricing_type === 'fixed' ? 'Taxa do evento' : 'Rateio'}
                            {finance.requires_prepayment ? ' · pagamento antecipado' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="w-full flex items-center gap-2">
                        <div className="flex-1 h-1.5 sm:h-2 bg-[#222] rounded-full overflow-hidden relative">
                          <div
                            className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-1000 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                            style={{ width: `${goalPct}%` }}
                          />
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-black text-white/60">{goalPct}%</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-white/[0.03] py-1.5">
                          <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-white/40">A receber</p>
                          <p className="text-xs sm:text-sm font-bold text-orange-400">{formatBRL(finance.outstanding)}</p>
                          <p className="text-[8px] text-white/30">{finance.pending} pendente{finance.pending === 1 ? '' : 's'}</p>
                        </div>
                        <div className="rounded-lg bg-white/[0.03] py-1.5">
                          <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-white/40">Avisaram</p>
                          <p className="text-xs sm:text-sm font-bold text-amber-400">{finance.claimed}</p>
                          <p className="text-[8px] text-white/30">para conferir</p>
                        </div>
                        <div className="rounded-lg bg-white/[0.03] py-1.5">
                          <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-white/40">Saldo</p>
                          <p className={cn('text-xs sm:text-sm font-bold', balance >= 0 ? 'text-green-400' : 'text-red')}>{formatBRL(balance)}</p>
                          <p className="text-[8px] text-white/30">arrecadado − quadra</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {showEditForm && canEdit && (
                <div className="mt-4 border-t border-border pt-4">
                  <GameDayForm initialData={gameDayDetail} onClose={() => setShowEditForm(false)} />
                </div>
              )}

              <div className="mt-8 bg-gradient-to-br from-[#0c0c0c] to-[#050505] border-y sm:border sm:border-[#2a2a2a] border-[#222] sm:rounded-3xl p-4 sm:p-6 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.8)] relative overflow-hidden -mx-4 sm:mx-0">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red via-transparent to-transparent opacity-20" />
                <AttendanceList
                  presentAttendances={presentAttendances}
                  reservedAttendances={reservedAttendances}
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
                    navigate('/court-checkin');
                  }}
                  onTogglePresence={(playerId) => toggleMutation.mutate({ gamedayId: gameDayDetail.id, playerId })}
                  onPaymentClick={(att) => {
                    if (att.has_paid) {
                      setConfirmDialog({
                        isOpen: true,
                        title: 'Desfazer pagamento?',
                        desc: `O pagamento de ${att.player_name} será marcado como cancelado no histórico.`,
                        onConfirm: () => togglePaymentMutation.mutate({ gamedayId: gameDayDetail.id, playerId: att.player }),
                      });
                    } else {
                      setPaymentTarget({
                        gamedayId: gameDayDetail.id,
                        playerId: att.player,
                        playerName: att.player_name,
                        amountDue: att.amount_due ?? gameDayDetail.effective_price_per_person,
                        claimed: att.payment_claimed,
                        isReserved: att.is_reserved,
                      });
                    }
                  }}
                  isTogglingPresence={(playerId) => toggleMutation.isPending && toggleMutation.variables?.playerId === playerId}
                  isTogglingPayment={(playerId) => togglePaymentMutation.isPending && togglePaymentMutation.variables?.playerId === playerId}
                  onCheckAll={() => {
                    if (gameDayDetail) {
                      bulkPaymentMutation.mutate({ gamedayId: gameDayDetail.id, actionType: 'check_all' });
                    }
                  }}
                  onUncheckAll={() => {
                    if (gameDayDetail) {
                      bulkPaymentMutation.mutate({ gamedayId: gameDayDetail.id, actionType: 'uncheck_all' });
                    }
                  }}
                  isBulkLoading={bulkPaymentMutation.isPending}
                  showPaymentControls={Number(gameDayDetail.effective_price_per_person) > 0 || Number(gameDayDetail.court_price) > 0}
                  gamedayId={gameDayDetail.id}
                  onReorderWaitlist={(gdId, attIds) => {
                    attendanceService.reorderWaitlist(gdId, attIds).then(() => {
                      toast.success('Fila reordenada!');
                      qc.invalidateQueries({ queryKey: ['gameday-detail'] });
                    }).catch(() => {
                      toast.error('Erro ao reordenar a fila.');
                    });
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}

      <PaymentConfirmModal target={paymentTarget} onClose={() => setPaymentTarget(null)} />

      <GuestModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        gameDayId={selectedGameDay?.id || 0}
        presentAttendances={presentAttendances}
        absentAttendances={absentAttendances}
        waitlistAttendances={waitlistAttendances}
        setConfirmDialog={setConfirmDialog}
      />
    </div>
  );
}
