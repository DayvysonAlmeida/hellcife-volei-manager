import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Plus, Calendar, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { matchesService, attendanceService } from '@/services';
import { formatDate } from '@/lib/utils';
import type { Match } from '@/types';
import { useAuth } from '@/store/AuthContext';
import toast from 'react-hot-toast';
import { MatchCard } from '@/components/matches/MatchCard';
import { LocationMapModal } from '@/components/ui/LocationMapModal';

export function MatchesPage() {
  const { user } = useAuth();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';
  const isAdmin = user?.profile === 'admin';
  const qc = useQueryClient();
  
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', desc: '', onConfirm: () => {} });

  const { data, isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => matchesService.list({ page_size: 100 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => matchesService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Partida excluída com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir a partida.'),
  });

  const { data: gamedaysData, isLoading: loadingGamedays } = useQuery({
    queryKey: ['gamedays'],
    queryFn: () => attendanceService.listGameDays(),
  });
  const gamedays = gamedaysData?.results || [];

  const matches = data?.results || [];

  // Agrupar partidas por circuito (gameday) ou por data (se avulsa)
  const groupedMatches = useMemo(() => {
    const groups = matches.reduce((acc: Record<string, Match[]>, match: Match) => {
      const key = match.gameday ? `gd-${match.gameday}` : `date-${match.date}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(match);
      return acc;
    }, {});

    // Ordenar as partidas de cada grupo da mais recente para a mais antiga (maior ID no topo)
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => b.id - a.id);
    });

    return groups;
  }, [matches]);

  const sortedKeys = useMemo(() => {
    return Object.keys(groupedMatches).sort((a, b) => {
      const matchA = groupedMatches[a][0];
      const matchB = groupedMatches[b][0];
      const dateA = new Date(matchA.created_at || matchA.date).getTime();
      const dateB = new Date(matchB.created_at || matchB.date).getTime();
      return dateB - dateA;
    });
  }, [groupedMatches]);

  // Expandir o grupo mais recente por padrão, apenas 1 vez
  useEffect(() => {
    if (sortedKeys.length > 0 && !hasAutoExpanded) {
      setExpandedDate(sortedKeys[0]);
      setHasAutoExpanded(true);
    }
  }, [sortedKeys, hasAutoExpanded]);

  return (
    <div className="space-y-6">
      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        onOpenChange={(isOpen) => setConfirmDialog(s => ({ ...s, isOpen }))}
        title={confirmDialog.title}
        description={confirmDialog.desc}
        onConfirm={confirmDialog.onConfirm}
      />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Histórico de Jogos</h1>
          <p className="page-subtitle">Acompanhe os resultados das partidas, agrupadas por circuito.</p>
        </div>
        {canEdit && (
          <Link to="/matches/new" className="btn-primary flex items-center justify-center gap-2">
            <Plus size={16} />
            Nova Partida
          </Link>
        )}
      </div>

      {(isLoading || loadingGamedays) ? (
        <PageLoading />
      ) : matches.length === 0 ? (
        <EmptyState message="Nenhuma partida registrada ainda." icon="🏐" />
      ) : (
        <div className="space-y-6">
          {sortedKeys.map((key) => {
            const dayMatches = groupedMatches[key];
            const isExpanded = expandedDate === key;
            const gamedayId = key.startsWith('gd-') ? parseInt(key.replace('gd-', '')) : null;
            const gameday = gamedayId ? gamedays.find((g: any) => g.id === gamedayId) : null;
            const groupDate = dayMatches[0]?.date;

            return (
              <div key={key} className={`card overflow-hidden transition-all duration-300 ${isExpanded ? 'shadow-lg border-red/20' : 'border-border'}`}>
                {/* Header do Agrupamento (Dia/Circuito) Premium */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedDate(isExpanded ? null : key)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedDate(isExpanded ? null : key); } }}
                  className={`w-full flex items-center justify-between p-4 md:p-5 transition-colors relative overflow-hidden group cursor-pointer ${
                    isExpanded ? 'bg-surface-hover/80' : 'bg-surface hover:bg-surface-hover/50'
                  }`}
                >
                  {/* Sutil gradiente se expandido */}
                  {isExpanded && <div className="absolute inset-0 bg-gradient-to-r from-red/5 to-transparent pointer-events-none" />}
                  
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="text-left">
                      {gameday ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-red bg-red/10 px-2 py-0.5 rounded border border-red/20">
                              Circuito de Vôlei
                            </span>
                            {gameday.is_closed && (
                              <span className="text-[9px] uppercase font-bold tracking-widest text-text-muted bg-surface-hover px-2 py-0.5 rounded border border-border">
                                Encerrado
                              </span>
                            )}
                          </div>
                          <h2 className="text-text-primary text-base font-bold mt-1">
                            {formatDate(gameday.date)}
                          </h2>
                          <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5 font-medium">
                            {gameday.time && (
                              <span className="flex items-center gap-1">
                                🕒 {gameday.time.slice(0, 5)}
                              </span>
                            )}
                            {gameday.location && (
                              <span className="flex items-center gap-1">
                                <LocationMapModal location={gameday.location} className="font-medium text-text-muted hover:text-text-primary" />
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-blue bg-blue/10 px-2 py-0.5 rounded border border-blue/20 self-start">
                            Partidas Avulsas
                          </span>
                          <h2 className="text-text-primary text-base font-bold">
                            {formatDate(groupDate)}
                          </h2>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-background px-2 py-1 rounded-md border border-border">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-neon-green" />
                          <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">
                            {dayMatches.length} {dayMatches.length === 1 ? 'Jogo finalizado' : 'Jogos finalizados'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`p-2 rounded-full transition-colors ${isExpanded ? 'bg-red/10 text-red' : 'bg-surface-hover text-text-muted group-hover:text-text-primary group-hover:bg-border'}`}>
                    <ChevronDown
                      size={20}
                      className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                  </div>

                {/* Lista de Jogos do Dia */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 md:p-5 border-t border-border space-y-4 bg-background/50">
                        {dayMatches.map((match: Match, idx: number) => (
                          <MatchCard
                            key={match.id}
                            match={match}
                            idx={idx}
                            isAdmin={isAdmin}
                            isDeleting={deleteMutation.isPending}
                            expanded={expandedId === match.id}
                            onToggle={() => setExpandedId(expandedId === match.id ? null : match.id)}
                            onDelete={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'Excluir Partida',
                                desc: 'Tem certeza que deseja excluir esta partida? Todos os dados de desempenho dos jogadores serão perdidos.',
                                onConfirm: () => deleteMutation.mutate(match.id)
                              });
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
