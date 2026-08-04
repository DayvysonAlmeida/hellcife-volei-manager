import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trophy, Medal, Star, Swords, Zap, Shield, Activity, TrendingUp } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { OverallBadge } from '@/components/ui/OverallBadge';
import { PositionBadge } from '@/components/ui/Badges';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { playersService } from '@/services/players';
import type { Position } from '@/types';

const POSITIONS: { value: Position | ''; label: string }[] = [
  { value: '', label: 'Geral (Todos)' },
  { value: 'setter', label: 'Levantadores' },
  { value: 'outside', label: 'Ponteiros' },
  { value: 'opposite', label: 'Opostos' },
  { value: 'middle', label: 'Centrais' },
  { value: 'libero', label: 'Líberos' },
  { value: 'universal', label: 'Universais' },
];

const PlayerStats = ({ stats }: { stats: any }) => {
  if (!stats) return null;
  return (
    <div className="flex flex-wrap gap-2 justify-center mt-3 text-xs font-medium text-text-muted">
      {stats.matches > 0 && <span title="Partidas Jogadas" className="flex items-center gap-1 bg-surface px-1.5 py-0.5 rounded border border-border"><Activity size={12}/> {stats.matches}</span>}
      {stats.win_rate > 0 && <span title="Taxa de Vitória" className="flex items-center gap-1 bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded border border-green-500/20"><TrendingUp size={12}/> {stats.win_rate}%</span>}
      {stats.mvp > 0 && <span title="MVP" className="flex items-center gap-1 bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20"><Star size={12}/> {stats.mvp}</span>}
      {stats.best_attacker > 0 && <span title="Melhor Ataque" className="flex items-center gap-1 bg-red/10 text-red px-1.5 py-0.5 rounded border border-red/20"><Swords size={12}/> {stats.best_attacker}</span>}
      {stats.best_defender > 0 && <span title="Melhor Defesa" className="flex items-center gap-1 bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded border border-green-500/20"><Shield size={12}/> {stats.best_defender}</span>}
    </div>
  );
};

export function LeaderboardPage() {
  const [positionFilter, setPositionFilter] = useState<Position | ''>('');

  const { data: players, isLoading, error, refetch } = useQuery({
    queryKey: ['players-ranking', positionFilter],
    queryFn: () => playersService.ranking(positionFilter || undefined),
  });

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!players) return null;

  const officialPlayers = players.filter((p: any) => !p.is_guest);
  const guestPlayers = players.filter((p: any) => p.is_guest);

  const top3 = officialPlayers.slice(0, 3);
  const rest = officialPlayers.slice(3);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-3">
          <Trophy className="text-yellow-500" size={32} />
          LEADERBOARD
        </h1>
        <p className="page-subtitle">Ranking oficial dos atletas por pontuação de Overall.</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {POSITIONS.map((pos) => (
          <button
            key={pos.value}
            onClick={() => setPositionFilter(pos.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              positionFilter === pos.value
                ? 'bg-red text-white shadow-neon-red-sm'
                : 'bg-surface border border-border text-text-muted hover:border-border-subtle hover:text-text-primary'
            }`}
          >
            {pos.label}
          </button>
        ))}
      </div>

      {/* Pódio (Top 3) */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 pb-4 items-end">
          {/* 2º Lugar - Prata */}
          {top3[1] && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card !overflow-visible p-6 pt-8 text-center border-zinc-400/50 shadow-[0_0_20px_rgba(161,161,170,0.1)] relative mt-8 md:mt-0 flex flex-col h-full"
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-zinc-400 rounded-full flex items-center justify-center border-4 border-background shadow-lg z-10">
                <span className="text-background font-display font-bold text-xl">2</span>
              </div>
              <Avatar name={top3[1].name} src={top3[1].avatar_url} size="xl" className="mx-auto mb-4 ring-2 ring-zinc-400/50" />
              <h3 className="text-text-primary font-bold text-lg">{top3[1].nickname || top3[1].name}</h3>
              <div className="flex justify-center my-2">
                <PositionBadge position={top3[1].main_position} />
              </div>
              <div className="inline-flex items-center gap-2 mt-2">
                <Star className="text-zinc-400" size={16} fill="currentColor" />
                <span className="font-display text-2xl font-bold text-zinc-300">{top3[1].overall.toFixed(1)}</span>
              </div>
              <div className="mt-auto pt-4">
                <PlayerStats stats={top3[1].stats} />
              </div>
            </motion.div>
          )}

          {/* 1º Lugar - Ouro */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card !overflow-visible p-6 pt-10 text-center border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)] relative z-10 md:-translate-y-8 flex flex-col h-full"
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center border-4 border-background shadow-lg z-10">
              <Trophy className="text-background" size={24} fill="currentColor" />
            </div>
            <Avatar name={top3[0].name} src={top3[0].avatar_url} size="xl" className="mx-auto mb-4 ring-4 ring-yellow-500/50" />
            <h3 className="text-text-primary font-bold text-xl">{top3[0].nickname || top3[0].name}</h3>
            <div className="flex justify-center my-2">
              <PositionBadge position={top3[0].main_position} />
            </div>
            <div className="inline-flex items-center gap-2 mt-2">
              <Star className="text-yellow-500" size={20} fill="currentColor" />
              <span className="font-display text-3xl font-bold text-yellow-400">{top3[0].overall.toFixed(1)}</span>
            </div>
            <div className="mt-auto pt-4">
              <PlayerStats stats={top3[0].stats} />
            </div>
          </motion.div>

          {/* 3º Lugar - Bronze */}
          {top3[2] && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card !overflow-visible p-6 pt-8 text-center border-orange-700/50 shadow-[0_0_20px_rgba(194,65,12,0.1)] relative mt-8 md:mt-0 flex flex-col h-full"
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-orange-700 rounded-full flex items-center justify-center border-4 border-background shadow-lg z-10">
                <span className="text-background font-display font-bold text-xl">3</span>
              </div>
              <Avatar name={top3[2].name} src={top3[2].avatar_url} size="xl" className="mx-auto mb-4 ring-2 ring-orange-700/50" />
              <h3 className="text-text-primary font-bold text-lg">{top3[2].nickname || top3[2].name}</h3>
              <div className="flex justify-center my-2">
                <PositionBadge position={top3[2].main_position} />
              </div>
              <div className="inline-flex items-center gap-2 mt-2">
                <Star className="text-orange-600" size={16} fill="currentColor" />
                <span className="font-display text-2xl font-bold text-orange-500">{top3[2].overall.toFixed(1)}</span>
              </div>
              <div className="mt-auto pt-4">
                <PlayerStats stats={top3[2].stats} />
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Restante da Lista (Oficiais) */}
      {rest.length > 0 && (
        <div className="card p-4 space-y-2">
          {rest.map((player: any, idx: number) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + idx * 0.05 }}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-highlight transition-colors group"
            >
              <div className="w-8 text-center text-text-muted font-display font-bold text-lg">
                {idx + 4}
              </div>
              <Avatar name={player.name} src={player.avatar_url} size="sm" />
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <span className="text-text-primary font-medium text-sm truncate">
                  {player.nickname || player.name}
                </span>
                <PositionBadge position={player.main_position} />
                <div className="hidden sm:block ml-auto mr-4">
                  <PlayerStats stats={player.stats} />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <OverallBadge overall={player.overall} size="sm" showLabel />
                <div className="sm:hidden">
                  <PlayerStats stats={player.stats} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Convidados (Lista Colapsável) */}
      {guestPlayers.length > 0 && (
        <details className="card group overflow-hidden border border-border/50 bg-black/20 open:bg-black/40 transition-colors">
          <summary className="cursor-pointer list-none p-4 font-display font-bold text-sm text-text-muted hover:text-white uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap size={16} className="text-yellow-500" />
              Convidados Avaliados ({guestPlayers.length})
            </span>
            <span className="text-xl group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="p-4 pt-0 space-y-2 border-t border-border/10 mt-2">
            {guestPlayers.map((player: any, idx: number) => (
              <div
                key={player.id}
                className="flex items-center gap-4 p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors opacity-80"
              >
                <div className="w-8 text-center text-text-muted/60 font-display font-bold text-sm">
                  -
                </div>
                <Avatar name={player.name} src={player.avatar_url} size="sm" className="grayscale group-hover:grayscale-0 transition-all" />
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <span className="text-text-primary/80 font-medium text-xs truncate">
                    {player.nickname || player.name}
                  </span>
                  <div className="scale-75 origin-left">
                    <PositionBadge position={player.main_position} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 scale-90 origin-right">
                  <OverallBadge overall={player.overall} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {officialPlayers.length === 0 && guestPlayers.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          Nenhum atleta avaliado encontrado para esta posição.
        </div>
      )}
    </div>
  );
}
