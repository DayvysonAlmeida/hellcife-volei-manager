import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Check, Loader2, CalendarCheck, Search, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';

import { attendanceService } from '@/services';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { GameDayListSidebar } from '@/components/attendance/GameDayListSidebar';

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
  const gameDays = gameDaysData?.results || [];

  const { openGameDays, closedGameDays } = useMemo(() => {
    return { 
      openGameDays: gameDays.filter((gd: any) => !gd.is_closed),
      closedGameDays: gameDays.filter((gd: any) => gd.is_closed)
    };
  }, [gameDays]);

  // Auto-selecionar ao carregar ou trocar de aba
  useEffect(() => {
    if (activeTab === 'ativo') {
      if (openGameDays.length > 0 && (!selectedGameDayId || closedGameDays.some((gd: any) => gd.id === selectedGameDayId))) {
        setSelectedGameDayId(openGameDays[0].id);
      } else if (openGameDays.length === 0) {
        setSelectedGameDayId(null);
      }
    } else {
      if (closedGameDays.length > 0 && (!selectedGameDayId || openGameDays.some((gd: any) => gd.id === selectedGameDayId))) {
        setSelectedGameDayId(closedGameDays[0].id);
      } else if (closedGameDays.length === 0) {
        setSelectedGameDayId(null);
      }
    }
  }, [activeTab, openGameDays, closedGameDays, selectedGameDayId]);

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
    let filtered = gameDayDetail.attendances.filter(a => a.present);
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(a => a.player_name.toLowerCase().includes(lower));
    }
    
    // Ordena alfabeticamente
    filtered.sort((a, b) => a.player_name.localeCompare(b.player_name));
    
    // Set de IDs que já chegaram
    const arrivedIds = new Set(gameDayDetail.court_checkins.map(c => c.player));
    
    const list = filtered.map(att => ({
      ...att,
      arrived: arrivedIds.has(att.player)
    }));

    // Se quisermos ordenar: primeiro os que NÃO chegaram, depois os que chegaram
    list.sort((a, b) => {
      if (a.arrived === b.arrived) return a.player_name.localeCompare(b.player_name);
      return a.arrived ? 1 : -1;
    });

    return { playersList: list, arrivedCount: arrivedIds.size };
  }, [gameDayDetail, searchTerm]);

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
        <div className="lg:col-span-1 space-y-4">
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

          {gameDayDetail && (
            <div className="card p-6 text-center shadow-lg border-red/10 bg-gradient-to-br from-surface to-red/5">
              <ClipboardList size={32} className="text-red mx-auto mb-3 opacity-80" />
              <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-3">Status da Quadra</p>
              <div className="flex justify-center items-center gap-6">
                <div className="text-center group">
                  <p className="text-4xl font-display text-text-primary group-hover:scale-110 transition-transform">{gameDayDetail.total_present}</p>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-1">No Circuito</p>
                </div>
                <div className="h-10 w-px bg-border/80"></div>
                <div className="text-center group">
                  <p className="text-4xl font-display text-green-500 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]">{arrivedCount}</p>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-1">Chegaram</p>
                </div>
              </div>
              {gameDayDetail.total_present > 0 && arrivedCount === gameDayDetail.total_present && (
                <div className="mt-4 pt-3 border-t border-border/50 animate-in fade-in zoom-in duration-300">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/20 text-green-500 text-xs font-black uppercase tracking-widest shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                    <Check size={14} /> QUADRA COMPLETA
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lado Direito: Lista de Jogadores Confirmados */}
        <div className="lg:col-span-3">
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
                        <div className="mt-1">
                          <PositionBadge position={att.player_position} />
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
          </div>
        </div>
      </div>
    </div>
  );
}
