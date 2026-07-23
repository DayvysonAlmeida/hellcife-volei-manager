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

export function CourtCheckinPage() {
  const { user } = useAuth();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';
  const qc = useQueryClient();

  const [selectedGameDayId, setSelectedGameDayId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: gameDaysData, isLoading: loadingGameDays } = useQuery({
    queryKey: ['gamedays'],
    queryFn: () => attendanceService.listGameDays({ page_size: 50 }),
  });
  const gameDays = gameDaysData?.results || [];

  const { openGameDays } = useMemo(() => {
    return { openGameDays: gameDays.filter(gd => !gd.is_closed) };
  }, [gameDays]);

  // Auto-selecionar a última (mais recente) pelada aberta por padrão
  useEffect(() => {
    if (gameDays.length > 0 && selectedGameDayId === null) {
      if (openGameDays.length > 0) {
        // O array já vem ordenado do mais recente pro mais antigo pelo backend (-date)
        // Então openGameDays[0] é a "última criada/mais recente" que está aberta.
        setSelectedGameDayId(openGameDays[0].id);
      } else {
        setSelectedGameDayId(gameDays[0].id);
      }
    }
  }, [gameDays, selectedGameDayId, openGameDays]);

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gameday', selectedGameDayId] }),
    onError: () => toast.error('Erro ao marcar presença na quadra.'),
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
      <div>
        <h1 className="page-title">Tiragem de Falta (Quadra)</h1>
        <p className="page-subtitle">Faça o check-in presencial de quem chegou para liberar a geração de times.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lado Esquerdo: Seleção do Gameday e Status */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-4">
            <h2 className="font-display text-sm text-text-primary mb-3">SELECIONE O CIRCUITO</h2>
            {loadingGameDays ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin text-red" /></div>
            ) : (
              <select
                className="input w-full"
                value={selectedGameDayId || ''}
                onChange={(e) => handleSelectGameDay(Number(e.target.value) || null)}
              >
                <option value="">Selecione o circuito...</option>
                {gameDays.map(gd => (
                  <option key={gd.id} value={gd.id}>
                    {formatDate(gd.date)} {gd.location ? `- ${gd.location}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {gameDayDetail && (
            <div className="card p-4 text-center">
              <ClipboardList size={32} className="text-red mx-auto mb-2 opacity-80" />
              <p className="text-text-muted text-xs uppercase tracking-wider mb-2">Status da Quadra</p>
              <div className="flex justify-center items-center gap-4">
                <div className="text-center">
                  <p className="text-3xl font-display text-text-primary">{gameDayDetail.total_present}</p>
                  <p className="text-[10px] text-text-muted uppercase">No Circuito</p>
                </div>
                <div className="h-8 w-px bg-border"></div>
                <div className="text-center">
                  <p className="text-3xl font-display text-green-500">{arrivedCount}</p>
                  <p className="text-[10px] text-text-muted uppercase">Chegaram</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lado Direito: Lista de Jogadores Confirmados */}
        <div className="lg:col-span-3">
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-border bg-surface-hover flex flex-col sm:flex-row gap-4 justify-between items-center">
              <h2 className="font-display text-base tracking-wider text-text-primary flex items-center gap-2">
                <CalendarCheck size={16} className="text-red" />
                LISTA DE CHAMADA
              </h2>
              <div className="relative w-full sm:w-64">
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
              <div className="divide-y divide-border">
                {playersList.map((att) => (
                  <div key={att.player} className={`flex items-center justify-between p-4 transition-colors ${att.arrived ? 'bg-green-500/5' : 'hover:bg-surface-hover'}`}>
                    <div className="flex items-center gap-3">
                      <Avatar src={att.player_avatar} name={att.player_name} size="md" />
                      <div>
                        <p className="font-medium text-text-primary leading-tight flex items-center gap-2">
                          {att.player_name}
                          {att.player_is_guest && (
                            <span className="text-[10px] bg-blue/10 text-blue px-1.5 py-0.5 rounded font-bold uppercase">
                              Convidado
                            </span>
                          )}
                        </p>
                        <PositionBadge position={att.player_position} />
                      </div>
                    </div>
                    
                    <button
                      onClick={() => toggleMutation.mutate(att.player)}
                      disabled={toggleMutation.isPending || gameDayDetail.is_closed}
                      className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all shadow-sm ${
                        att.arrived
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'bg-background border-border-subtle hover:border-red hover:text-red text-text-muted'
                      } ${gameDayDetail.is_closed ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                      title={gameDayDetail.is_closed ? 'Circuito encerrado' : (att.arrived ? 'Desmarcar presença' : 'Marcar presença na quadra')}
                    >
                      {toggleMutation.isPending && toggleMutation.variables === att.player ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <Check size={24} className={att.arrived ? 'text-white' : 'opacity-50'} />
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
