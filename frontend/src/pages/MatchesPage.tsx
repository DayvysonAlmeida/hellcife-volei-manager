import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Plus, Calendar, MapPin, Trophy, Star, Zap, Shield, ChevronDown, Users, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Avatar } from '@/components/ui/Avatar';
import { matchesService } from '@/services';
import { formatDate } from '@/lib/utils';
import { MODALITY_LABELS } from '@/types';
import type { Modality, Match, MatchPlayer } from '@/types';
import { useAuth } from '@/store/AuthContext';
import toast from 'react-hot-toast';
import { MatchCard } from '@/components/matches/MatchCard';

export function MatchesPage() {
  const { user } = useAuth();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';
  const isAdmin = user?.profile === 'admin';
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', desc: '', onConfirm: () => {} });

  const { data, isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => matchesService.list(),
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
          <h1 className="page-title">Jogos (Resultados)</h1>
          <p className="page-subtitle">Histórico de todos os confrontos individuais e destaques.</p>
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
        <div className="space-y-4">
          {matches.map((match: Match, idx: number) => (
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
      )}
    </div>
  );
}
