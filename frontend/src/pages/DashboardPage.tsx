import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, UserCheck, CalendarCheck, Star, TrendingUp, Award, Swords, Zap, Shield, Trophy } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { StatCard } from '@/components/ui/StatCard';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { dashboardService } from '@/services';
import { formatDateTime } from '@/lib/utils';
import type { DashboardData } from '@/types';

const CHART_COLORS = ['#D90429', '#2563EB', '#16A34A', '#CA8A04', '#7C3AED', '#EA580C'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) => {
  if (active && payload && (payload as { value: number }[]).length) {
    return (
      <div className="glass rounded-lg px-3 py-2 text-sm">
        <p className="text-text-primary font-medium">{label}</p>
        {(payload as { value: number; name: string }[]).map((p, i) => (
          <p key={i} className="text-text-secondary">{p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: dashboardService.get,
    refetchInterval: 30000, // Atualiza a cada 30s
  });

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Visão geral do desempenho do time • Atualizado em {formatDateTime(data.last_updated)}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Atletas"
          value={data.total_players}
          icon={<Users size={22} />}
          color="blue"
          delay={0}
        />
        <StatCard
          title="Atletas Ativos"
          value={data.active_players}
          icon={<UserCheck size={22} />}
          color="green"
          delay={0.1}
        />
        <StatCard
          title="Presentes Hoje"
          value={data.present_today}
          subtitle={`${data.paid_today} pagaram`}
          icon={<CalendarCheck size={22} />}
          color="red"
          delay={0.2}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6">
        {/* Distribuição por posição */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-6"
        >
          <h2 className="font-display text-lg text-text-primary tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-red" />
            DISTRIBUIÇÃO POR POSIÇÃO
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.position_distribution || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
              <XAxis dataKey="position" tick={{ fill: '#71717A', fontSize: 11 }} />
              <YAxis tick={{ fill: '#71717A', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {(data.position_distribution || []).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Destaques (Hall of Fame) */}
      {data.highlights && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card p-6"
        >
          <h2 className="font-display text-xl text-text-primary tracking-wider mb-6 flex items-center gap-2">
            <Trophy size={20} className="text-yellow-500" />
            DESTAQUES DA TEMPORADA
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* MVP */}
            <div className="bg-surface rounded-xl p-4 border border-border flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center mb-3">
                <Star size={20} className="fill-yellow-500" />
              </div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Mais vezes MVP</h3>
              {data.highlights.mvp && data.highlights.mvp.length > 0 ? (
                <div className="flex flex-col gap-2 w-full mt-2">
                  {data.highlights.mvp.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2 bg-surface/50 p-2 rounded-lg text-left">
                      <span className="text-yellow-500 font-bold text-xs">{i + 1}º</span>
                      <Avatar name={p.name} src={p.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary text-xs truncate">{p.name}</p>
                      </div>
                      <span className="text-xs text-yellow-500 font-bold">{p.count}x</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-muted text-sm my-auto">Sem dados</p>
              )}
            </div>

            {/* Melhor Ataque */}
            <div className="bg-surface rounded-xl p-4 border border-border flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-red/20 text-red flex items-center justify-center mb-3">
                <Swords size={20} />
              </div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Melhor Ataque</h3>
              {data.highlights.best_attacker && data.highlights.best_attacker.length > 0 ? (
                <div className="flex flex-col gap-2 w-full mt-2">
                  {data.highlights.best_attacker.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2 bg-surface/50 p-2 rounded-lg text-left">
                      <span className="text-red font-bold text-xs">{i + 1}º</span>
                      <Avatar name={p.name} src={p.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary text-xs truncate">{p.name}</p>
                      </div>
                      <span className="text-xs text-red font-bold">{p.count}x</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-muted text-sm my-auto">Sem dados</p>
              )}
            </div>

            {/* Melhor Saque */}
            <div className="bg-surface rounded-xl p-4 border border-border flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-blue/20 text-blue flex items-center justify-center mb-3">
                <Zap size={20} />
              </div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Melhor Saque</h3>
              {data.highlights.best_server && data.highlights.best_server.length > 0 ? (
                <div className="flex flex-col gap-2 w-full mt-2">
                  {data.highlights.best_server.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2 bg-surface/50 p-2 rounded-lg text-left">
                      <span className="text-blue-400 font-bold text-xs">{i + 1}º</span>
                      <Avatar name={p.name} src={p.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary text-xs truncate">{p.name}</p>
                      </div>
                      <span className="text-xs text-blue-400 font-bold">{p.count}x</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-muted text-sm my-auto">Sem dados</p>
              )}
            </div>

            {/* Melhor Defesa */}
            <div className="bg-surface rounded-xl p-4 border border-border flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mb-3">
                <Shield size={20} />
              </div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Melhor Defesa</h3>
              {data.highlights.best_defender && data.highlights.best_defender.length > 0 ? (
                <div className="flex flex-col gap-2 w-full mt-2">
                  {data.highlights.best_defender.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2 bg-surface/50 p-2 rounded-lg text-left">
                      <span className="text-green-500 font-bold text-xs">{i + 1}º</span>
                      <Avatar name={p.name} src={p.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary text-xs truncate">{p.name}</p>
                      </div>
                      <span className="text-xs text-green-500 font-bold">{p.count}x</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-muted text-sm my-auto">Sem dados</p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Ranking dos maiores vencedores */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="card p-6"
      >
        <h2 className="font-display text-xl text-text-primary tracking-wider mb-6 flex items-center gap-2">
          <Award size={20} className="text-red" />
          MAIORES VENCEDORES (TIME GANHADOR)
        </h2>
        <div className="space-y-3">
          {data.top_winners.map((player, idx) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + idx * 0.05 }}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface transition-colors group"
            >
              {/* Rank */}
              <div className={`
                w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                  idx === 1 ? 'bg-zinc-400/20 text-zinc-300' :
                  idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                  'bg-surface text-text-muted'}
              `}>
                {idx + 1}
              </div>

              {/* Avatar */}
              <Avatar name={player.name} src={player.avatar_url} size="sm" />

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <p className="text-text-primary font-medium text-sm truncate">
                    {player.nickname || player.name}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1 sm:mt-0">
                  <PositionBadge position={player.position} />
                  
                  {/* Estrelas do Jogador */}
                  <div className="flex items-center gap-0.5 min-w-[60px]">
                    {player.big_stars > 0 && (
                      <div className="flex items-center text-yellow-400">
                        {[...Array(player.big_stars)].map((_, i) => <Star key={`big-${i}`} size={14} className="fill-yellow-400" />)}
                      </div>
                    )}
                    {player.mini_stars > 0 && (
                      <div className="flex items-center text-yellow-200">
                        {[...Array(player.mini_stars)].map((_, i) => <Star key={`mini-${i}`} size={12} className="fill-yellow-200" />)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Vitórias */}
              <div className="text-right flex flex-col items-end">
                <span className="text-red font-bold text-lg leading-none">{player.wins}</span>
                <span className="text-[10px] text-text-muted uppercase">Vitórias</span>
              </div>
            </motion.div>
          ))}
          {data.top_winners.length === 0 && (
            <p className="text-text-muted text-center py-4">Nenhum dado de vitória registrado ainda.</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
