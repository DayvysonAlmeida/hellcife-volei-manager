import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Users, UserCheck, CalendarCheck, Star, TrendingUp, Award, Swords, Shield, Trophy, Flame, Crown, Medal, CalendarDays, Sparkles, Zap } from 'lucide-react';
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

function HighlightColumn({ title, icon: Icon, colorClass, bgClass, data }: { title: string, icon: any, colorClass: string, bgClass: string, data: any[] }) {
  return (
    <div className="bg-surface rounded-xl p-4 border border-border flex flex-col items-center text-center">
      <div className={`w-10 h-10 rounded-full ${bgClass} ${colorClass} flex items-center justify-center mb-3`}>
        <Icon size={20} className={colorClass.includes('fill') ? colorClass : ''} />
      </div>
      <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">{title}</h3>
      {data && data.length > 0 ? (
        <div className="flex flex-col gap-2 w-full mt-2">
          {data.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 bg-surface/50 p-2 rounded-lg text-left border border-transparent hover:border-border transition-colors">
              <span className={`${colorClass} font-bold text-xs`}>{i + 1}º</span>
              <Avatar name={p.name} src={p.avatar_url} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary text-xs truncate">{p.name}</p>
              </div>
              <span className={`text-xs ${colorClass} font-bold`}>{p.count}x</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-text-muted text-sm my-auto opacity-50">Sem dados</p>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: dashboardService.get,
    refetchInterval: 1000 * 60 * 5, // Atualiza a cada 5 min (era 30s — desnecessário)
  });

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="page-title">DASHBOARD</h1>
        <p className="page-subtitle">
          Visão geral do desempenho do time.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="ATLETAS"
          value={data.total_players}
          icon={<Users size={20} />}
          color="blue"
          delay={0}
        />
        <StatCard
          title="ATLETAS ATIVOS"
          value={data.active_players}
          icon={<UserCheck size={20} />}
          color="green"
          delay={0.1}
        />
        <StatCard
          title="PRESENTES HOJE"
          value={data.present_today}
          subtitle={`${data.paid_today} pagaram`}
          icon={<CalendarCheck size={20} />}
          color="red"
          delay={0.2}
        />
      </div>

      {/* Ranking de Méritos */}
      {data.top_stars && data.top_stars.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6 border-yellow-500/20"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              <Star size={24} className="text-yellow-400 fill-yellow-400" />
              <div>
                <h2 className="font-display text-xl text-yellow-400 tracking-wider">RANKING DE MÉRITOS (ESTRELAS)</h2>
                <p className="text-sm text-text-muted">Top 10 membros com mais estrelas — grandes estrelas são mérito máximo</p>
              </div>
            </div>
            <Link to="/stars" className="btn-secondary text-xs px-4 py-2 flex items-center justify-center gap-2 whitespace-nowrap bg-surface hover:bg-surface-hover">
              <Star size={14} className="text-yellow-400" />
              Ver Sistema Completo
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.top_stars.map((player, idx) => {
              const hasBigStar = player.big_stars > 0;
              return (
                <Link
                  key={player.id}
                  to={`/players/${player.id}`}
                  className={`
                    relative rounded-xl p-3 flex flex-col items-center text-center transition-all duration-300 group
                    ${hasBigStar
                      ? 'bg-gradient-to-b from-yellow-500/15 to-surface/80 border-2 border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.15)] hover:shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:border-yellow-400/70'
                      : 'bg-surface/80 border border-border hover:border-yellow-400/30 hover:bg-surface-hover'}
                  `}
                >
                  {/* Badge de posição */}
                  <div className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md z-10 ${
                    idx === 0 ? 'bg-yellow-500 text-black' :
                    idx === 1 ? 'bg-zinc-300 text-black' :
                    idx === 2 ? 'bg-orange-400 text-black' :
                    'bg-surface-hover text-text-muted border border-border'
                  }`}>
                    {idx + 1}
                  </div>

                  {/* Troféu para grande estrela */}
                  {hasBigStar && (
                    <div className="absolute -top-2 -right-2 z-10">
                      <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/50">
                        <Trophy size={12} className="text-black" />
                      </div>
                    </div>
                  )}

                  {/* Avatar */}
                  <Avatar
                    name={player.name}
                    src={player.avatar_url}
                    size={hasBigStar ? 'lg' : 'md'}
                    className={`mb-2 ${hasBigStar ? 'ring-2 ring-yellow-400/60 shadow-lg shadow-yellow-500/20' : ''}`}
                  />

                  {/* Nome */}
                  <h3 className={`font-bold text-xs w-full truncate mb-2 ${
                    hasBigStar ? 'text-yellow-300' : 'text-text-primary'
                  }`}>{player.name}</h3>

                  {/* Estrelas Grandes */}
                  {hasBigStar && (
                    <div className="flex items-center gap-0.5 mb-1.5">
                      {Array.from({ length: Math.min(player.big_stars, 5) }).map((_, i) => (
                        <span key={i} className="text-sm">🌟</span>
                      ))}
                      {player.big_stars > 5 && <span className="text-xs text-yellow-400 font-bold">+{player.big_stars - 5}</span>}
                    </div>
                  )}

                  {/* Barras de categoria */}
                  <div className="w-full space-y-1 mt-auto">
                    {/* MVP */}
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-yellow-400 font-bold w-8 text-left">MVP</span>
                      <div className="flex-1 h-1 bg-surface-highlight rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${(player.mvp_stars / 5) * 100}%` }} />
                      </div>
                      <span className="text-[9px] text-text-muted w-3 text-right">{player.mvp_stars}</span>
                    </div>
                    {/* Ataque */}
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-red font-bold w-8 text-left">ATQ</span>
                      <div className="flex-1 h-1 bg-surface-highlight rounded-full overflow-hidden">
                        <div className="h-full bg-red rounded-full transition-all" style={{ width: `${(player.attack_stars / 5) * 100}%` }} />
                      </div>
                      <span className="text-[9px] text-text-muted w-3 text-right">{player.attack_stars}</span>
                    </div>
                    {/* Defesa */}
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-blue font-bold w-8 text-left">DEF</span>
                      <div className="flex-1 h-1 bg-surface-highlight rounded-full overflow-hidden">
                        <div className="h-full bg-blue rounded-full transition-all" style={{ width: `${(player.defense_stars / 5) * 100}%` }} />
                      </div>
                      <span className="text-[9px] text-text-muted w-3 text-right">{player.defense_stars}</span>
                    </div>

                    {/* Mini-estrelas totais */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/50 mt-1">
                      <span className="text-[9px] text-text-muted uppercase tracking-wider">Mini</span>
                      <span className="text-[10px] font-bold text-yellow-400">{player.mini_stars}/15</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>


        </motion.div>
      )}

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

      {/* OS COROADOS DA TEMPORADA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="card p-6 border-yellow-500/30 overflow-hidden relative"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent pointer-events-none" />
        <h2 className="font-display text-xl text-yellow-500 tracking-wider mb-6 flex items-center gap-2">
          <Crown size={20} className="text-yellow-500" />
          OS COROADOS (ÚLTIMOS DESTAQUES)
        </h2>
        
        {data.new_stars && data.new_stars.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {data.new_stars.map((player) => {
              const catConfig = {
                mvp: { label: 'MVP', icon: Trophy, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
                attack: { label: 'Melhor Ataque', icon: Zap, color: 'text-red bg-red/10 border-red/30' },
                defense: { label: 'Melhor Defesa', icon: Shield, color: 'text-blue bg-blue/10 border-blue/30' },
              };
              const cat = player.top_category ? catConfig[player.top_category] : null;
              const CatIcon = cat?.icon || Star;
              const catColor = cat ? cat.color : 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
              
              return (
                <Link
                  key={`coroado-${player.id}`}
                  to={`/players/${player.id}`}
                  className="bg-gradient-to-b from-surface-highlight to-surface/50 border border-border hover:border-yellow-500/40 rounded-2xl p-5 flex flex-col items-center text-center relative shadow-lg group transition-all"
                >
                  <div className={`absolute top-3 right-3 ${catColor} w-8 h-8 rounded-full flex items-center justify-center border`}>
                    <CatIcon size={14} />
                  </div>
                  
                  <Avatar name={player.name} src={player.avatar_url} size="xl" className="ring-4 ring-surface-highlight mb-3 shadow-md group-hover:ring-yellow-500/40 transition-all" />
                  
                  <h3 className="font-display text-lg text-text-primary truncate w-full group-hover:text-yellow-400 transition-colors">
                    {player.name}
                  </h3>
                  
                  {cat && (
                    <span className={`text-[10px] font-bold uppercase tracking-widest mt-2 px-2.5 py-1 rounded-full border ${cat.color}`}>
                      {cat.label}
                    </span>
                  )}
                  
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50 w-full justify-center">
                    {player.big_stars > 0 && (
                      <span className="text-xs text-yellow-500 font-bold" title="Grandes Estrelas">🌟 {player.big_stars}</span>
                    )}
                    <span className="text-xs text-yellow-500/70 font-bold" title="Mini Estrelas">✦ {player.mini_stars}/15</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-text-muted">Aguardando que atletas recebam estrelas para aparecerem aqui...</p>
        )}
      </motion.div>

      {/* Destaques (Corridas por Partida) */}
      {data.highlights && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card p-6"
        >
          <h2 className="font-display text-xl text-text-primary tracking-wider mb-6 flex items-center gap-2">
            <Trophy size={20} className="text-red" />
            A CORRIDA PELAS ESTATUETAS (LÍDERES DAS PARTIDAS)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <HighlightColumn title="Mais vezes MVP" icon={Star} colorClass="text-yellow-500 fill-yellow-500" bgClass="bg-yellow-500/20" data={data.highlights.mvp || []} />
            <HighlightColumn title="Melhor Ataque" icon={Swords} colorClass="text-red" bgClass="bg-red/20" data={data.highlights.best_attacker || []} />
            <HighlightColumn title="Melhor Defesa" icon={Shield} colorClass="text-green-500" bgClass="bg-green-500/20" data={data.highlights.best_defender || []} />
          </div>
        </motion.div>
      )}

      {/* Hall da Fama (Oficial) */}
      {data.hall_of_fame && data.hall_of_fame.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="card p-6 border-yellow-500/30"
        >
          <div className="flex items-center gap-3 mb-6">
            <Award size={28} className="text-yellow-500" />
            <div>
              <h2 className="font-display text-2xl text-yellow-500 tracking-wider">HALL DA FAMA</h2>
              <p className="text-sm text-text-muted">Premiações oficiais e históricas do time</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.hall_of_fame.map((entry) => (
              <div key={entry.id} className="bg-surface/80 rounded-xl p-4 flex items-center gap-4 border border-border hover:border-yellow-500/50 transition-colors group">
                <Avatar name={entry.player_name} src={entry.avatar_url} size="md" className="ring-2 ring-yellow-500/20 group-hover:ring-yellow-500/50" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-text-primary font-bold truncate">{entry.player_name}</h3>
                  <p className="text-sm text-yellow-500 font-medium">{entry.category}</p>
                  <p className="text-xs text-text-muted mt-0.5 uppercase tracking-widest">{entry.year}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}



      {/* Ranking dos maiores vencedores */}
      <WinnersSection winners={data.top_winners} />
    </div>
  );
}

const POSITION_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'libero', label: 'Líbero' },
  { value: 'setter', label: 'Levantador' },
  { value: 'outside', label: 'Ponteiro' },
  { value: 'middle', label: 'Central' },
  { value: 'opposite', label: 'Oposto' },
  { value: 'universal', label: 'Universal' },
];

function WinnersSection({ winners }: { winners: any[] }) {
  const [posFilter, setPosFilter] = useState('');

  const filtered = posFilter
    ? winners.filter(p => p.position === posFilter)
    : winners;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="card p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <h2 className="font-display text-xl text-text-primary tracking-wider flex items-center gap-2">
          <Award size={20} className="text-red" />
          MAIORES VENCEDORES
        </h2>
        {/* Filtros de posição */}
        <div className="flex flex-wrap gap-1.5">
          {POSITION_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setPosFilter(f.value)}
              className={`text-[11px] font-bold px-3 py-1 rounded-full transition-all border ${
                posFilter === f.value
                  ? 'bg-red text-white border-red shadow-[0_0_8px_rgba(217,4,41,0.4)]'
                  : 'bg-surface text-text-muted border-border hover:border-red/40 hover:text-text-secondary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-text-muted text-center py-4">Nenhum vencedor nessa posição ainda.</p>
        )}
        {filtered.map((player, idx) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04 }}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-colors group"
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
            <Avatar name={player.name} src={player.avatar_url} size="sm" />
            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2 flex-1">
                <p className="text-text-primary font-medium text-sm truncate">
                  {player.nickname || player.name}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-0.5 sm:mt-0">
                <PositionBadge position={player.position} />
                {player.big_stars > 0 && (
                  <div className="flex items-center text-yellow-400">
                    {[...Array(Math.min(player.big_stars, 3))].map((_, i) => (
                      <span key={i} className="text-sm">🌟</span>
                    ))}
                    {player.big_stars > 3 && <span className="text-xs text-yellow-400 font-bold ml-0.5">+{player.big_stars - 3}</span>}
                  </div>
                )}
                {player.mini_stars > 0 && player.big_stars === 0 && (
                  <span className="text-[10px] text-yellow-300 font-bold">{player.mini_stars}✦</span>
                )}
              </div>
            </div>
            <div className="text-right flex flex-col items-end flex-shrink-0">
              <span className="text-red font-bold text-lg leading-none">{player.wins}</span>
              <span className="text-[10px] text-text-muted uppercase">Vitórias</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
