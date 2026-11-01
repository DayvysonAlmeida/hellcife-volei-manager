import { useState, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Swords, Trophy, Star, ChevronDown, Loader2 } from 'lucide-react';
import { PageLoading } from '@/components/ui/Loading';
import { MatchCard } from '@/components/matches/MatchCard';
import { MatchGroupCard } from '@/components/matches/MatchGroupCard';
import { groupMatches, useOpenGroup } from '@/lib/matchGroups';
import api from '@/lib/api';
import type { Match } from '@/types';

export function AthleteMatchesPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: myPlayer } = useQuery({
    queryKey: ['athlete-me'],
    queryFn: () => api.get('/players/me/').then(r => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['athlete-stats', myPlayer?.id],
    queryFn: () => api.get(`/players/${myPlayer.id}/stats/`).then(r => r.data),
    enabled: !!myPlayer?.id,
  });

  const { data: matchesData, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['athlete-matches-paginated', myPlayer?.id],
    queryFn: ({ pageParam = 1 }) => api.get(`/matches/?ordering=-date&player_id=${myPlayer?.id}&page=${pageParam}&page_size=10`).then(r => r.data),
    getNextPageParam: (lastPage: any, allPages: any[]) => lastPage.next ? allPages.length + 1 : undefined,
    enabled: !!myPlayer?.id,
    initialPageParam: 1,
  });

  const matches: Match[] = useMemo(() => matchesData?.pages.flatMap(p => p.results) || [], [matchesData]);

  // Mesmos cards da tela da staff: um por circuito, o mais recente aberto
  const groups = useMemo(() => groupMatches(matches), [matches]);
  const { openKey, toggle } = useOpenGroup(groups[0]?.key);

  if (isLoading) return <PageLoading />;

  return (
    <div className="space-y-6">
      {/* ── Minhas Stats ── */}
      {myPlayer && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { label: 'Minhas Partidas', value: stats?.total_matches || 0, icon: Swords, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Vitórias', value: stats?.wins || 0, icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
            { label: 'MVPs', value: stats?.mvps || 0, icon: Star, color: 'text-red', bg: 'bg-red/10' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="card p-4 text-center"
            >
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mx-auto mb-2`}>
                <s.icon size={18} className={s.color} />
              </div>
              <p className="font-display text-2xl text-text-primary">{s.value}</p>
              <p className="text-text-muted text-xs mt-0.5 leading-tight">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── Lista de Jogos ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-text-primary tracking-wider">HISTÓRICO DE JOGOS</h2>
          <span className="text-text-muted text-sm">{stats?.total_matches || 0} jogos totais</span>
        </div>

        {matches.length > 0 ? (
          <div className="space-y-6">
            {groups.map(({ key, matches: dayMatches }) => (
              <MatchGroupCard key={key} matches={dayMatches} expanded={openKey === key} onToggle={() => toggle(key)}>
                {dayMatches.map((match, idx) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    idx={idx}
                    isAdmin={false}
                    isDeleting={false}
                    expanded={expandedId === match.id}
                    onToggle={() => setExpandedId(expandedId === match.id ? null : match.id)}
                    onDelete={() => {}}
                  />
                ))}
              </MatchGroupCard>
            ))}

            {hasNextPage && (
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="btn-secondary w-full py-3 flex justify-center items-center gap-2"
              >
                {isFetchingNextPage ? (
                  <Loader2 size={16} className="animate-spin text-text-muted" />
                ) : (
                  <ChevronDown size={16} />
                )}
                Carregar mais
              </button>
            )}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <Swords size={48} className="text-text-muted/20 mx-auto mb-4" />
            <h3 className="font-display text-xl text-text-primary tracking-wider mb-2">SEM JOGOS</h3>
            <p className="text-text-muted text-sm">Nenhum jogo registrado ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
