import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Plus, Calendar, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { matchesService } from '@/services';
import { formatDate } from '@/lib/utils';
import type { Match } from '@/types';
import { useAuth } from '@/store/AuthContext';
import toast from 'react-hot-toast';
import { MatchCard } from '@/components/matches/MatchCard';

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

  const matches = data?.results || [];

  // Agrupar partidas por data (YYYY-MM-DD)
  const groupedMatches = useMemo(() => {
    return matches.reduce((acc: Record<string, Match[]>, match: Match) => {
      const d = match.date;
      if (!acc[d]) acc[d] = [];
      acc[d].push(match);
      return acc;
    }, {});
  }, [matches]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedMatches).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [groupedMatches]);

  // Expandir a data mais recente por padrão, apenas 1 vez
  useEffect(() => {
    if (sortedDates.length > 0 && !hasAutoExpanded) {
      setExpandedDate(sortedDates[0]);
      setHasAutoExpanded(true);
    }
  }, [sortedDates, hasAutoExpanded]);

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
          <h1 className="page-title">Histórico de Jogos</h1>
          <p className="page-subtitle">Resultados, times e destaques de todas as peladas.</p>
        </div>
        {canEdit && (
          <Link to="/matches/new" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} />
            <span className="hidden sm:inline">Nova partida</span>
            <span className="sm:hidden">Nova</span>
          </Link>
        )}
      </div>

      {isLoading ? (
        <PageLoading />
      ) : matches.length === 0 ? (
        <EmptyState message="Nenhuma partida registrada ainda." icon="🏐" />
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => {
            const dayMatches = groupedMatches[date];
            const isExpanded = expandedDate === date;

            return (
              <div key={date} className="card overflow-hidden">
                {/* Header do Agrupamento (Dia) */}
                <button
                  onClick={() => setExpandedDate(isExpanded ? null : date)}
                  className="w-full flex items-center justify-between p-4 md:p-5 bg-surface hover:bg-surface/80 transition-colors"
                >
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 rounded-full bg-red/10 text-red flex items-center justify-center flex-shrink-0">
                      <Calendar size={20} />
                    </div>
                    <div className="text-left">
                      <h2 className="font-display text-lg md:text-xl text-text-primary tracking-wider">
                        {formatDate(date)}
                      </h2>
                      <p className="text-xs text-text-muted mt-0.5">
                        {dayMatches.length} {dayMatches.length === 1 ? 'partida realizada' : 'partidas realizadas'}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

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
                      <div className="p-4 md:p-5 border-t border-border space-y-4 bg-background/30">
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
