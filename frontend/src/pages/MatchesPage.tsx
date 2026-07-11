import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Swords, Plus, Calendar, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { matchesService } from '@/services';
import { formatDate } from '@/lib/utils';
import { MODALITY_LABELS } from '@/types';
import type { Modality } from '@/types';
import { useAuth } from '@/store/AuthContext';

export function MatchesPage() {
  const { user } = useAuth();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';

  const { data, isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => matchesService.list(),
  });

  const matches = data?.results || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Partidas</h1>
          <p className="page-subtitle">Histórico de partidas e resultados.</p>
        </div>
        {canEdit && (
          <Link to="/matches/new" className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Nova partida
          </Link>
        )}
      </div>

      {isLoading ? (
        <PageLoading />
      ) : matches.length === 0 ? (
        <EmptyState message="Nenhuma partida registrada ainda." icon="🏐" />
      ) : (
        <div className="space-y-3">
          {matches.map((match, idx) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="card p-5 flex items-center gap-4 hover:border-border-subtle transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-red/10 flex items-center justify-center flex-shrink-0">
                <Swords size={20} className="text-red" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-display text-lg text-text-primary tracking-wider">
                    {MODALITY_LABELS[match.modality as Modality]}
                  </span>
                  <span className="badge-active">{match.modality_display}</span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <div className="flex items-center gap-1 text-text-muted text-xs">
                    <Calendar size={11} />
                    {formatDate(match.date)}
                  </div>
                  {match.location && (
                    <div className="flex items-center gap-1 text-text-muted text-xs">
                      <MapPin size={11} />
                      {match.location}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-text-muted text-xs">
                {(match as { teams_count?: number }).teams_count ?? 0} times
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
