import { useState, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Swords, Trophy, Shield, Crown, Star, ChevronDown, ChevronUp, Loader2, Calendar } from 'lucide-react';
import { PageLoading } from '@/components/ui/Loading';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

function MatchCard({ match }: { match: any }) {
  const [expanded, setExpanded] = useState(false);

  const teams: any[] = match.match_teams || [];
  const winner = teams.find((t: any) => t.winner);
  const isDraw = teams.length > 0 && teams.every((t: any) => !t.winner);

  return (
    <motion.div
      layout
      className="card overflow-hidden hover:border-border/80 transition-all duration-300"
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          isDraw ? 'bg-zinc-500/10 text-zinc-400' : 'bg-yellow-500/10 text-yellow-400'
        )}>
          {isDraw ? <Shield size={18} /> : <Trophy size={18} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-text-muted text-xs uppercase tracking-wider">{match.modality_display || 'Jogo'}</p>
            {match.created_at && (
              <p className="text-text-muted/60 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                • 🕒 {new Date(match.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          {/* Placar */}
          <div className="flex items-center gap-2 mt-1">
            {teams.map((t: any, i: number) => (
              <span key={t.id} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-text-muted/40 text-sm">vs</span>}
                <span
                  className={cn(
                    'font-display text-base',
                    t.winner ? 'text-yellow-400' : 'text-text-secondary'
                  )}
                  style={{ color: t.winner ? undefined : t.color_hex ? `${t.color_hex}99` : undefined }}
                >
                  {t.team_name}
                </span>
                <span className={cn(
                  'font-display text-xl',
                  t.winner ? 'text-green-400' : 'text-text-muted'
                )}>
                  {t.score}
                </span>
              </span>
            ))}
          </div>
          {isDraw && <p className="text-xs text-zinc-400 mt-0.5">Empate</p>}
        </div>

        <button
          onClick={() => setExpanded(v => !v)}
          className="p-1.5 text-text-muted hover:text-text-primary transition-colors rounded-lg hover:bg-surface-highlight"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Destaques */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-t border-border/50"
        >
          {teams.map((team: any) => (
            <div key={team.id} className="p-4 border-b border-border/30 last:border-0">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: team.color_hex || '#666' }}
                />
                <span className="text-text-secondary text-sm font-medium">{team.team_name}</span>
                {team.winner && <span className="text-yellow-400 text-xs">🏆 Vencedor</span>}
              </div>
              <div className="space-y-1.5">
                {(team.match_players || []).map((mp: any) => (
                  <div key={mp.id} className="flex items-center gap-2.5">
                    <Avatar name={mp.player_name} src={mp.player_avatar} size="sm" />
                    <span className="text-text-primary text-sm flex-1">{mp.player_name}</span>
                    <div className="flex items-center gap-2">
                      {mp.mvp && (
                        <span className="flex items-center gap-1 text-yellow-400 text-xs">
                          <Crown size={11} /> MVP
                        </span>
                      )}
                      {mp.best_attacker && (
                        <span className="text-orange-400 text-xs">⚡ Ataque</span>
                      )}
                      {mp.best_defender && (
                        <span className="text-blue-400 text-xs">🛡️ Defesa</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

export function AthleteMatchesPage() {
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

  const matches = matchesData?.pages.flatMap(p => p.results) || [];

  const groupedMatches = useMemo(() => {
    return matches.reduce((acc: any, match: any) => {
      const key = match.gameday 
        ? `${match.gameday_location || 'Circuito'} — ${formatDate(match.gameday_date || match.date)}`
        : `Jogo Avulso — ${formatDate(match.date)}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(match);
      return acc;
    }, {});
  }, [matches]);

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
            {Object.entries(groupedMatches).map(([groupName, groupMatches]: [string, any], idx) => (
              <div key={groupName}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Calendar size={14} className="text-red" />
                  <h3 className="font-display text-text-primary text-sm tracking-wider uppercase">{groupName}</h3>
                  <span className="text-text-muted text-xs ml-auto">{groupMatches.length} jogos</span>
                </div>
                <div className="space-y-3">
                  {groupMatches.map((match: any, i: number) => (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (idx * 0.1) + (i * 0.03) }}
                    >
                      <MatchCard match={match} />
                    </motion.div>
                  ))}
                </div>
              </div>
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
