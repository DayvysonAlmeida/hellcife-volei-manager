import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Check, Loader2, CalendarCheck, Search, Lock, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';

import { attendanceService } from '@/services';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { GameDayListSidebar } from '@/components/attendance/GameDayListSidebar';
import { ChevronLeft } from 'lucide-react';

export function CourtCheckinPage() {
  const { user } = useAuth();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';
  const qc = useQueryClient();

  const [selectedGameDayId, setSelectedGameDayId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'ativo' | 'historico'>('ativo');

  const { data: gameDaysData, isLoading: loadingGameDays } = useQuery({
    queryKey: ['gamedays'],
    queryFn: () => attendanceService.listGameDays({ page_size: 50 }),
  });
  const gameDays = useMemo(() => gameDaysData?.results || [], [gameDaysData]);

  const { openGameDays, closedGameDays } = useMemo(() => {
    const open = gameDays.filter((gd: any) => !gd.is_closed).sort((a: any, b: any) => a.date.localeCompare(b.date));
    const closed = gameDays.filter((gd: any) => gd.is_closed);
    
    // Circuitos abertos: data mais próxima primeiro (ascendente)
    open.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Histórico: mais recentes primeiro (descendente)
    closed.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { openGameDays: open, closedGameDays: closed };
  }, [gameDays]);

  // Auto-seleção removida para respeitar o padrão Master-Detail no mobile.

  const handleSelectGameDay = (id: number | null) => {
    setSelectedGameDayId(id);
  };

  const { data: gameDayDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['gameday', selectedGameDayId],
    queryFn: () => attendanceService.getGameDay(selectedGameDayId!),
    enabled: !!selectedGameDayId,
  });

  const toggleMutation = useMutation({
    mutationFn: (playerId: number) =>
      attendanceService.toggleCourtCheckin(selectedGameDayId!, playerId),
    onMutate: async (playerId) => {
      await qc.cancelQueries({ queryKey: ['gameday', selectedGameDayId] });
      const previousGameday = qc.getQueryData(['gameday', selectedGameDayId]);
      
      qc.setQueryData(['gameday', selectedGameDayId], (old: any) => {
        if (!old) return old;
        
        const isCheckedIn = old.court_checkins.some((c: any) => c.player === playerId);
        let newCheckins;
        if (isCheckedIn) {
          newCheckins = old.court_checkins.filter((c: any) => c.player !== playerId);
        } else {
          newCheckins = [...old.court_checkins, { player: playerId }];
        }
        
        return {
          ...old,
          court_checkins: newCheckins
        };
      });
      return { previousGameday };
    },
    onError: (err, playerId, context) => {
      qc.setQueryData(['gameday', selectedGameDayId], context?.previousGameday);
      toast.error('Erro ao marcar presença na quadra.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['gameday', selectedGameDayId] });
      qc.invalidateQueries({ queryKey: ['gamedays'] });
    },
  });

  // Falta justificada não soma nem zera a sequência; vale também depois de encerrar o circuito
  const justifyMutation = useMutation({
    mutationFn: ({ attendanceId, justified }: { attendanceId: number; justified: boolean; name: string }) =>
      attendanceService.justifyAbsence(attendanceId, justified),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ['gameday', selectedGameDayId] });
      toast.success(`${vars.name}: ${vars.justified ? 'falta justificada' : 'justificativa removida'} (${res.consecutive_absences} faltas seguidas)`);
    },
    onError: () => toast.error('Não foi possível salvar a justificativa. Tente de novo.'),
  });

  const justifyButton = (att: { id: number; player_name: string; is_justified?: boolean }) => {
    const busy = justifyMutation.isPending && justifyMutation.variables?.attendanceId === att.id;
    return (
      <button
        type="button"
        onClick={() => justifyMutation.mutate({ attendanceId: att.id, justified: !att.is_justified, name: att.player_name })}
        disabled={busy}
        title={att.is_justified ? 'Tocar para desfazer a justificativa' : 'A falta não vai contar na sequência de faltas'}
        className={cn(
          'inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60',
          att.is_justified
            ? 'border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : 'border-border text-text-muted hover:text-text-primary hover:border-amber-500/50'
        )}
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : att.is_justified ? <ShieldCheck size={11} /> : null}
        {att.is_justified ? 'Justificada' : 'Justificar'}
      </button>
    );
  };

  const bulkMutation = useMutation({
    mutationFn: (actionType: 'check_all' | 'uncheck_all') => {
      // Pega todos os IDs da lista atual (respeita a busca, ou pega todos se não tiver busca)
      const allIds = playersList.map(p => p.player);
      return attendanceService.bulkCourtCheckin(selectedGameDayId!, allIds, actionType);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gameday', selectedGameDayId] });
      qc.invalidateQueries({ queryKey: ['gamedays'] });
      toast.success('Ação em lote aplicada com sucesso!');
    },
    onError: () => toast.error('Erro ao executar ação em lote.')
  });

  const { playersList, arrivedCount } = useMemo(() => {
    if (!gameDayDetail) return { playersList: [], arrivedCount: 0 };
    
    // Pegamos APENAS os jogadores que confirmaram no circuito (present=true)
    const confirmedPlayers = gameDayDetail.attendances.filter((a: any) => a.present);
    const confirmedPlayerIds = new Set(confirmedPlayers.map((a: any) => a.player));
    
    // Set de IDs que já chegaram E ainda estão confirmados no circuito
    const arrivedIds = new Set(
      gameDayDetail.court_checkins
        .map((c: any) => c.player)
        .filter((id: number) => confirmedPlayerIds.has(id))
    );
    
    let filtered = confirmedPlayers;
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter((a: any) => a.player_name.toLowerCase().includes(lower));
    }
    
    // Ordena alfabeticamente
    filtered.sort((a: any, b: any) => a.player_name.localeCompare(b.player_name));
    
    const list = filtered.map((att: any) => ({
      ...att,
      arrived: arrivedIds.has(att.player)
    }));

    // Se quisermos ordenar: primeiro os que NÃO chegaram, depois os que chegaram
    list.sort((a: any, b: any) => {
      if (a.arrived === b.arrived) return a.player_name.localeCompare(b.player_name);
      return a.arrived ? 1 : -1;
    });

    return { playersList: list, arrivedCount: arrivedIds.size };
  }, [gameDayDetail, searchTerm]);

  // Quem não se inscreveu também acumula falta: o admin pode justificar quem avisou que não ia
  const [searchNotEnrolled, setSearchNotEnrolled] = useState('');
  const notEnrolled = useMemo(() => {
    if (!gameDayDetail) return [];
    const term = searchNotEnrolled.trim().toLowerCase();
    return gameDayDetail.attendances
      .filter((a: any) => !a.present && !a.player_is_guest && (!term || a.player_name.toLowerCase().includes(term)))
      .sort((a: any, b: any) => Number(b.is_justified) - Number(a.is_justified) || a.player_name.localeCompare(b.player_name));
  }, [gameDayDetail, searchNotEnrolled]);

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">Tiragem de Falta</h1>
        <div className="card p-8 text-center">
          <ClipboardList size={48} className="text-red mx-auto mb-4 opacity-50" />
          <p className="text-text-muted">Apenas administradores podem fazer a tiragem de falta.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Tiragem de Falta (Quadra)</h1>
          <p className="page-subtitle">Faça o check-in presencial de quem chegou para liberar a geração de times.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lado Esquerdo: Seleção do Gameday e Status */}
        <div className={cn("lg:col-span-1 space-y-4", selectedGameDayId ? "hidden lg:block" : "block")}>
          <GameDayListSidebar
            isLoading={loadingGameDays}
            gameDays={gameDays}
            activeGameDays={openGameDays}
            historyGameDays={closedGameDays}
            selectedGameDayId={selectedGameDayId}
            onSelectGameDay={(gd) => handleSelectGameDay(gd.id)}
            circuitTab={activeTab === 'ativo' ? 'active' : 'history'}
            setCircuitTab={(tab) => setActiveTab(tab === 'active' ? 'ativo' : 'historico')}
            canEdit={false}
            fullText="COMPLETO"
            countType="court"
          />
        </div>

        {/* Lado Direito: Lista de Jogadores Confirmados */}
        <div className={cn("lg:col-span-3", !selectedGameDayId ? "hidden lg:block" : "block")}>
          {!selectedGameDayId ? (
            <div className="card flex flex-col items-center justify-center py-24 text-center h-full min-h-[400px]">
              <CalendarCheck size={48} className="text-red mx-auto mb-4 opacity-30" />
              <p className="text-text-muted font-medium mt-4">Selecione um circuito na lista para iniciar a tiragem de faltas.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => handleSelectGameDay(null)}
                className="lg:hidden w-fit p-2 -ml-2 rounded-xl text-text-muted hover:bg-white/5 hover:text-white transition-colors flex items-center gap-1 font-black uppercase tracking-widest text-[10px]"
              >
                <ChevronLeft size={16} />
                Voltar aos circuitos
              </button>

              {gameDayDetail && (
                <div className="card p-4 sm:p-6 shadow-sm border-red/10 bg-gradient-to-r from-surface to-red/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="w-12 h-12 rounded-full bg-red/10 flex items-center justify-center text-red flex-shrink-0">
                      <ClipboardList size={24} />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-text-primary font-display text-lg sm:text-xl uppercase tracking-widest truncate">{gameDayDetail.location || 'PELADA'}</p>
                      <p className="text-text-muted text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-1.5 mt-1">
                        <CalendarCheck size={12} className="text-red flex-shrink-0" />
                        {(() => {
                          const dateObj = new Date(`${gameDayDetail.date}T12:00:00`);
                          const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
                          const dayNum = dateObj.toLocaleDateString('pt-BR', { day: '2-digit' });
                          const month = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                          return `${dayName}., ${dayNum} ${month}`;
                        })()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center gap-6 w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t border-white/5 sm:border-none">
                    <div className="text-center group">
                      <p className="text-3xl font-display text-text-primary group-hover:scale-110 transition-transform">{gameDayDetail.total_present}</p>
                      <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-1">No Circuito</p>
                    </div>
                    <div className="h-8 w-px bg-border/80"></div>
                    <div className="text-center group relative">
                      <p className="text-3xl font-display text-green-500 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]">{arrivedCount}</p>
                      <p className="text-[9px] font-black text-green-500/80 uppercase tracking-widest mt-1">Chegaram</p>
                      {gameDayDetail.total_present > 0 && arrivedCount === gameDayDetail.total_present && (
                        <div className="absolute -top-1 -right-4 animate-bounce">
                          <span className="flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 items-center justify-center text-white"><Check size={8}/></span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-border bg-surface-hover flex flex-col lg:flex-row gap-4 justify-between items-center">
              <h2 className="font-display text-base tracking-wider text-text-primary flex items-center gap-2">
                <CalendarCheck size={16} className="text-red" />
                LISTA DE CHAMADA
              </h2>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                {gameDayDetail && !gameDayDetail.is_closed && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => bulkMutation.mutate('check_all')}
                      disabled={bulkMutation.isPending || playersList.length === 0}
                      className="btn-secondary w-full sm:w-auto text-xs px-3 py-1.5 h-auto border-green-500/30 text-green-500 hover:bg-green-500/10 hover:border-green-500 whitespace-nowrap"
                    >
                      Marcar Todos
                    </button>
                    <button 
                      onClick={() => bulkMutation.mutate('uncheck_all')}
                      disabled={bulkMutation.isPending || playersList.length === 0}
                      className="btn-secondary w-full sm:w-auto text-xs px-3 py-1.5 h-auto border-red/30 text-red hover:bg-red/10 hover:border-red whitespace-nowrap"
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                )}
                
                <div className="relative w-full sm:w-64 flex-shrink-0">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Buscar atleta..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input w-full pl-9 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>

            {gameDayDetail?.is_closed && (
              <div className="mx-4 mt-4 bg-red/10 border border-red/20 text-red text-center py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                <Lock size={14} />
                Circuito Encerrado (Apenas Leitura)
              </div>
            )}

            {loadingDetail ? (
              <PageLoading />
            ) : !gameDayDetail ? (
              <EmptyState message="Nenhum circuito selecionado." icon="🎯" />
            ) : playersList.length === 0 ? (
              <EmptyState message="Nenhum atleta confirmou presença no circuito ainda." icon="🤷" />
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {playersList.map((att) => (
                  <div key={att.player} className={`flex items-center justify-between p-4 rounded-xl border shadow-sm transition-all duration-300 group ${att.arrived ? 'bg-green-500/10 border-green-500/40 hover:bg-green-500/20' : 'bg-surface hover:bg-surface-hover border-border'}`}>
                    <div className="flex items-center gap-3">
                      <Avatar src={att.player_avatar} name={att.player_name} size="md" className={`ring-2 transition-all ${att.arrived ? 'ring-green-500/50' : 'ring-transparent'}`} />
                      <div>
                        <p className={`font-bold text-base leading-tight flex items-center gap-2 transition-colors ${att.arrived ? 'text-green-500' : 'text-text-primary'}`}>
                          {att.player_name}
                          {att.player_is_guest && (
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                              Convidado {att.player_invited_by ? `por: ${att.player_invited_by}` : ''}
                            </span>
                          )}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <PositionBadge position={att.player_position} />
                          {canEdit && !att.arrived && justifyButton(att)}
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => toggleMutation.mutate(att.player)}
                      disabled={toggleMutation.isPending || gameDayDetail.is_closed}
                      className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all shadow-sm flex-shrink-0 ${
                        att.arrived
                          ? 'bg-green-500 border-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:scale-105'
                          : 'bg-surface border-border-subtle hover:border-red hover:text-red text-text-muted hover:scale-105'
                      } ${gameDayDetail.is_closed ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                      title={gameDayDetail.is_closed ? 'Circuito encerrado' : (att.arrived ? 'Desmarcar presença' : 'Marcar presença na quadra')}
                    >
                      {toggleMutation.isPending && toggleMutation.variables === att.player ? (
                        <Loader2 size={22} className="animate-spin" />
                      ) : (
                        <Check size={24} className={att.arrived ? 'text-white' : 'opacity-50 group-hover:opacity-100'} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {gameDayDetail && (notEnrolled.length > 0 || searchNotEnrolled) && (
              <details className="mx-4 mb-4 rounded-xl border border-border/50 bg-surface/60">
                <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold text-text-primary">
                  Justificar falta de quem não se inscreveu
                </summary>
                <div className="px-4 pb-4 flex flex-col gap-3">
                  <p className="text-xs text-text-muted">
                    A falta conta para todo atleta ativo, mesmo sem inscrição. Justifique aqui quem avisou que não ia: a falta justificada não soma na sequência.
                  </p>
                  <div className="relative max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      id="busca-nao-inscritos"
                      type="text"
                      placeholder="Buscar atleta..."
                      value={searchNotEnrolled}
                      onChange={(e) => setSearchNotEnrolled(e.target.value)}
                      className="input w-full pl-8 py-1.5 text-sm"
                    />
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                    {notEnrolled.map((att: any) => (
                      <li key={att.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2">
                        <span className="flex items-center gap-2 min-w-0">
                          <Avatar src={att.player_avatar} name={att.player_name} size="sm" />
                          <span className="truncate text-sm font-medium text-text-primary">{att.player_name}</span>
                        </span>
                        {justifyButton(att)}
                      </li>
                    ))}
                    {notEnrolled.length === 0 && <li className="text-xs text-text-muted">Nenhum atleta encontrado.</li>}
                  </ul>
                </div>
              </details>
            )}
          </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
