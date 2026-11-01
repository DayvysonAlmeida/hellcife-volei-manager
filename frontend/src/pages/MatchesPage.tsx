import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { matchesService } from '@/services';
import type { Match } from '@/types';
import { useAuth } from '@/store/AuthContext';
import toast from 'react-hot-toast';
import { MatchCard } from '@/components/matches/MatchCard';
import { MatchGroupCard } from '@/components/matches/MatchGroupCard';
import { groupMatches, useOpenGroup } from '@/lib/matchGroups';

export function MatchesPage() {
  const { user } = useAuth();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';
  const isAdmin = user?.profile === 'admin';
  const qc = useQueryClient();

  const [expandedId, setExpandedId] = useState<number | null>(null);
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

  const matches = useMemo(() => data?.results || [], [data]);

  // Agrupar partidas por circuito (gameday) ou por data (se avulsa); o mais recente vem aberto
  const groups = useMemo(() => groupMatches(matches), [matches]);
  const { openKey, toggle } = useOpenGroup(groups[0]?.key);

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

      {isLoading ? (
        <PageLoading />
      ) : matches.length === 0 ? (
        <EmptyState message="Nenhuma partida registrada ainda." icon="🏐" />
      ) : (
        <div className="space-y-6">
          {groups.map(({ key, matches: dayMatches }) => (
            <MatchGroupCard key={key} matches={dayMatches} expanded={openKey === key} onToggle={() => toggle(key)}>
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
            </MatchGroupCard>
          ))}
        </div>
      )}
    </div>
  );
}
