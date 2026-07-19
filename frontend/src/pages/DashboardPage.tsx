import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, UserCheck, CalendarCheck, Star, TrendingUp, Award, Swords, Zap, Shield, Trophy, Target, Hand, Flame, Crown, Medal, CalendarDays, Sparkles } from 'lucide-react';
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
    refetchInterval: 30000, // Atualiza a cada 30s
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
          className="card p-6 border-yellow-200/20"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              <Star size={24} className="text-yellow-400 fill-yellow-400" />
              <div>
                <h2 className="font-display text-xl text-yellow-400 tracking-wider">RANKING DE MÉRITOS (ESTRELAS)</h2>
                <p className="text-sm text-text-muted">Membros com mais estrelas da comunidade</p>
              </div>
            </div>
            <Link to="/stars" className="btn-secondary text-xs px-4 py-2 flex items-center justify-center gap-2 whitespace-nowrap bg-surface hover:bg-surface-hover">
              <Star size={14} className="text-yellow-400" />
              Ver Ranking Completo
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {data.top_stars.map((player, idx) => (
              <div key={player.id} className="bg-surface/80 rounded-xl p-4 flex flex-col items-center text-center border border-border hover:border-yellow-400/50 transition-colors relative shadow-lg shadow-yellow-500/5">
                <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg ${
                  idx === 0 ? 'bg-yellow-500 text-black' : 
                  idx === 1 ? 'bg-zinc-300 text-black' : 
                  idx === 2 ? 'bg-orange-400 text-black' : 
                  'bg-surface-hover text-text-muted border border-border'
                }`}>
                  {idx + 1}º
                </div>
                
                <Avatar name={player.name} src={player.avatar_url} size="lg" className={`mb-3 ${idx < 3 ? 'ring-2 ring-yellow-400/50' : ''}`} />
                
                <h3 className="text-text-primary font-bold text-sm w-full truncate mb-2">{player.name}</h3>
                
                <div className="flex flex-col gap-1 items-center bg-background/50 rounded-lg p-2 w-full">
                  {player.big_stars > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-text-muted">{player.big_stars}x</span>
                      <div className="flex gap-0.5 text-yellow-500">
                        {[...Array(Math.min(player.big_stars, 5))].map((_, i) => <Star key={`big-${i}`} size={16} className="fill-yellow-500" />)}
                        {player.big_stars > 5 && <span className="text-xs text-yellow-500 font-bold ml-1">...</span>}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-text-muted">{player.mini_stars}x</span>
                    <div className="flex gap-0.5 text-yellow-200">
                      {[...Array(Math.min(player.mini_stars, 5))].map((_, i) => <Star key={`mini-${i}`} size={14} className="fill-yellow-200" />)}
                      {player.mini_stars > 5 && <span className="text-xs text-yellow-200 font-bold ml-1">...</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Novos Estrelados */}
          {data.new_stars && data.new_stars.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border/50">
              <h3 className="text-sm font-bold text-text-primary tracking-wider mb-4 flex items-center gap-2">
                <Sparkles size={16} className="text-yellow-400" />
                NOVOS ESTRELADOS
              </h3>
              <div className="flex flex-wrap gap-4">
                {data.new_stars.map((player: any) => (
                  <div key={`new-${player.id}`} className="flex items-center gap-3 bg-surface rounded-full pr-4 p-1.5 border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                    <Avatar name={player.name} src={player.avatar_url} size="sm" />
                    <span className="text-sm font-medium text-text-primary">{player.name}</span>
                    <div className="flex items-center gap-0.5 ml-2">
                      <Star size={12} className="fill-yellow-400 text-yellow-400" />
                      <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Novo</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
          OS COROADOS DA TEMPORADA
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* MVP da Temporada */}
          <div className="bg-gradient-to-b from-yellow-500/20 to-surface/50 border border-yellow-500/30 rounded-2xl p-6 flex flex-col items-center text-center relative shadow-[0_0_30px_rgba(234,179,8,0.1)]">
            <div className="absolute top-4 right-4 text-yellow-500/30">
              <Star size={40} className="fill-yellow-500/20" />
            </div>
            <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-widest mb-4">MVP da Temporada</h3>
            {data.season_mvp ? (
              <>
                <Avatar name={data.season_mvp.name} src={data.season_mvp.avatar_url} size="xl" className="ring-4 ring-yellow-500/50 mb-4 shadow-lg shadow-yellow-500/20" />
                <p className="font-display text-xl text-text-primary truncate w-full">{data.season_mvp.name}</p>
                <p className="text-sm text-yellow-500 font-bold mt-2 bg-yellow-500/10 px-3 py-1 rounded-full">{data.season_mvp.count} títulos de MVP</p>
              </>
            ) : (
              <p className="text-text-muted mt-auto mb-auto">Aguardando mais jogos...</p>
            )}
          </div>

          {/* Revelação */}
          <div className="bg-gradient-to-b from-indigo-500/20 to-surface/50 border border-indigo-500/30 rounded-2xl p-6 flex flex-col items-center text-center relative shadow-[0_0_30px_rgba(99,102,241,0.1)]">
            <div className="absolute top-4 right-4 text-indigo-500/30">
              <Medal size={40} />
            </div>
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-4">Revelação</h3>
            {data.revelation ? (
              <>
                <Avatar name={data.revelation.name} src={data.revelation.avatar_url} size="xl" className="ring-4 ring-indigo-500/50 mb-4 shadow-lg shadow-indigo-500/20" />
                <p className="font-display text-xl text-text-primary truncate w-full">{data.revelation.name}</p>
                <p className="text-sm text-indigo-400 font-bold mt-2 bg-indigo-500/10 px-3 py-1 rounded-full">{data.revelation.matches} partidas jogadas</p>
              </>
            ) : (
              <p className="text-text-muted mt-auto mb-auto">Aguardando novos jogadores...</p>
            )}
          </div>

          {/* Mais Presente */}
          <div className="bg-gradient-to-b from-emerald-500/20 to-surface/50 border border-emerald-500/30 rounded-2xl p-6 flex flex-col items-center text-center relative shadow-[0_0_30px_rgba(16,185,129,0.1)]">
            <div className="absolute top-4 right-4 text-emerald-500/30">
              <CalendarDays size={40} />
            </div>
            <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-4">Mais Presente</h3>
            {data.most_present ? (
              <>
                <Avatar name={data.most_present.name} src={data.most_present.avatar_url} size="xl" className="ring-4 ring-emerald-500/50 mb-4 shadow-lg shadow-emerald-500/20" />
                <p className="font-display text-xl text-text-primary truncate w-full">{data.most_present.name}</p>
                <p className="text-sm text-emerald-500 font-bold mt-2 bg-emerald-500/10 px-3 py-1 rounded-full">{data.most_present.count} presenças confirmadas</p>
              </>
            ) : (
              <p className="text-text-muted mt-auto mb-auto">Aguardando listas de presença...</p>
            )}
          </div>
        </div>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <HighlightColumn title="Mais vezes MVP" icon={Star} colorClass="text-yellow-500 fill-yellow-500" bgClass="bg-yellow-500/20" data={data.highlights.mvp || []} />
            <HighlightColumn title="Melhor Ataque" icon={Swords} colorClass="text-red" bgClass="bg-red/20" data={data.highlights.best_attacker || []} />
            <HighlightColumn title="Melhor Saque" icon={Zap} colorClass="text-blue-400" bgClass="bg-blue-500/20" data={data.highlights.best_server || []} />
            <HighlightColumn title="Melhor Defesa" icon={Shield} colorClass="text-green-500" bgClass="bg-green-500/20" data={data.highlights.best_defender || []} />
            
            <HighlightColumn title="Melhor Levantador" icon={Target} colorClass="text-indigo-400" bgClass="bg-indigo-500/20" data={data.highlights.best_setter || []} />
            <HighlightColumn title="Melhor Líbero" icon={UserCheck} colorClass="text-teal-400" bgClass="bg-teal-500/20" data={data.highlights.best_libero || []} />
            <HighlightColumn title="Melhor Blocador" icon={Hand} colorClass="text-orange-400" bgClass="bg-orange-500/20" data={data.highlights.best_blocker || []} />
            <HighlightColumn title="Melhor Oposto" icon={Flame} colorClass="text-rose-500" bgClass="bg-rose-500/20" data={data.highlights.best_opposite || []} />
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
