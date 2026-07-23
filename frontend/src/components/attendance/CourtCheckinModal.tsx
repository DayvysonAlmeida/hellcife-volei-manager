import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Search, UserCheck } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { attendanceService } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { LoadingSpinner } from '@/components/ui/Loading';
import toast from 'react-hot-toast';

interface CourtCheckinModalProps {
  gamedayId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function CourtCheckinModal({ gamedayId, isOpen, onClose }: CourtCheckinModalProps) {
  const { user } = useAuth();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: gameDay, isLoading } = useQuery({
    queryKey: ['gameday', gamedayId],
    queryFn: () => attendanceService.getGameDay(gamedayId),
    enabled: isOpen && !!gamedayId,
  });

  const toggleMutation = useMutation({
    mutationFn: (playerId: number) =>
      attendanceService.toggleCourtCheckin(gamedayId, playerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gameday', gamedayId] }),
    onError: () => toast.error('Erro ao marcar presença na quadra.'),
  });

  const { playersList, arrivedCount } = useMemo(() => {
    if (!gameDay) return { playersList: [], arrivedCount: 0 };
    
    // Pegamos APENAS os jogadores que confirmaram no circuito (present=true)
    let filtered = gameDay.attendances.filter(a => a.present);
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(a => a.player_name.toLowerCase().includes(lower));
    }
    
    // Set de IDs que já chegaram
    const arrivedIds = new Set(gameDay.court_checkins.map(c => c.player));
    
    const list = filtered.map(att => ({
      ...att,
      arrived: arrivedIds.has(att.player)
    }));

    // Primeiro os que NÃO chegaram, depois os que chegaram
    list.sort((a, b) => {
      if (a.arrived === b.arrived) return a.player_name.localeCompare(b.player_name);
      return a.arrived ? 1 : -1;
    });

    return { playersList: list, arrivedCount: arrivedIds.size };
  }, [gameDay, searchTerm]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-card w-full max-w-xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-border bg-surface/50">
            <div>
              <h2 className="font-display text-xl md:text-2xl text-text-primary flex items-center gap-2">
                <UserCheck className="text-red" />
                Tiragem de Falta (Quadra)
              </h2>
              {gameDay && (
                <p className="text-sm text-text-muted mt-1">
                  Quem já chegou na quadra para a pelada.
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-border bg-surface">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Buscar jogador..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="input w-full pl-10 bg-background"
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1">
            {isLoading || !gameDay ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-50">
                <LoadingSpinner />
                <p className="mt-4 text-sm font-medium uppercase tracking-wider">Carregando lista...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4 bg-surface p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <UserCheck size={16} className="text-red" />
                    <span className="font-bold text-sm tracking-widest uppercase">
                      Chegaram: {arrivedCount}/{gameDay.attendances.filter(a => a.present).length}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {playersList.map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer
                        ${player.arrived
                            ? 'bg-green-950/20 border-green-800/30'
                            : 'bg-surface border-border hover:border-border-subtle'
                        }`}
                      onClick={() => {
                        if (canEdit && !toggleMutation.isPending) {
                           toggleMutation.mutate(player.player);
                        }
                      }}
                    >
                      <Avatar name={player.player_name} src={player.player_avatar} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary text-sm font-medium truncate">
                          {player.player_name}
                        </p>
                        <PositionBadge position={player.player_position} />
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-2">
                          <button
                            className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                              player.arrived 
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' 
                                : 'bg-surface-hover text-text-muted hover:bg-green-500/20 hover:text-green-500'
                            }`}
                            title={player.arrived ? "Chegou" : "Marcar Chegada"}
                          >
                            <Check size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
