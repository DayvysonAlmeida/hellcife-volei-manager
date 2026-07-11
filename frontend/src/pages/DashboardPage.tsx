import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, UserCheck, CalendarCheck, Star, TrendingUp, Award } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { StatCard } from '@/components/ui/StatCard';
import { Avatar } from '@/components/ui/Avatar';
import { OverallBadge } from '@/components/ui/OverallBadge';
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
          icon={<CalendarCheck size={22} />}
          color="red"
          delay={0.2}
        />
        <StatCard
          title="Overall Médio"
          value={data.avg_overall.toFixed(1)}
          icon={<Star size={22} />}
          color="yellow"
          delay={0.3}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <BarChart data={data.position_distribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
              <XAxis dataKey="position" tick={{ fill: '#71717A', fontSize: 11 }} />
              <YAxis tick={{ fill: '#71717A', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.position_distribution.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top jogadores — gráfico horizontal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card p-6"
        >
          <h2 className="font-display text-lg text-text-primary tracking-wider mb-4 flex items-center gap-2">
            <Award size={18} className="text-red" />
            EVOLUÇÃO — TOP 10
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.top_players}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
              <XAxis type="number" domain={[0, 10]} tick={{ fill: '#71717A', fontSize: 10 }} />
              <YAxis
                dataKey="name"
                type="category"
                width={80}
                tick={{ fill: '#A1A1AA', fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="overall" fill="#D90429" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Ranking dos melhores atletas */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="card p-6"
      >
        <h2 className="font-display text-xl text-text-primary tracking-wider mb-6 flex items-center gap-2">
          <Award size={20} className="text-red" />
          RANKING DOS MELHORES ATLETAS
        </h2>
        <div className="space-y-3">
          {data.top_players.map((player, idx) => (
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
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-text-primary font-medium text-sm truncate">
                    {player.nickname || player.name}
                  </p>
                  {player.shirt_number && (
                    <span className="text-text-muted text-xs">#{player.shirt_number}</span>
                  )}
                </div>
                <PositionBadge position={player.position} />
              </div>

              {/* Overall */}
              <OverallBadge overall={player.overall} size="sm" showLabel />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
