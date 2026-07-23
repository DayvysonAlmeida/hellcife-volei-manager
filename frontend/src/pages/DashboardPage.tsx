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
import { SyncButton } from '@/components/ui/SyncButton';
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
  const first = data[0];
  const second = data[1];
  const third = data[2];

  return (
    <div className="bg-surface rounded-xl p-4 border border-border flex flex-col items-center text-center">
      <div className={`w-10 h-10 rounded-full ${bgClass} ${colorClass} flex items-center justify-center mb-3`}>
        <Icon size={20} className={colorClass.includes('fill') ? colorClass : ''} />
      </div>
      <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">{title}</h3>
      {data && data.length > 0 ? (
        <div className="flex flex-col items-center w-full relative pt-4 pb-2">
          {/* PÓDIO */}
          <div className="flex items-end justify-center gap-2 w-full h-36 mb-4 relative mt-4">
            {/* 2º Lugar */}
            {second && (
              <div className="flex flex-col items-center w-1/3 z-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <Avatar name={second.name} src={second.avatar_url} size="sm" className="mb-2 ring-2 ring-zinc-400/50" />
                <p className="font-medium text-text-primary text-[10px] truncate w-full text-center">{second.name}</p>
                <div className={`mt-1 text-xs font-bold ${colorClass}`}>{second.count}x</div>
                <div className="w-full bg-surface-highlight h-10 mt-2 rounded-t-md flex items-end justify-center pb-1 border-t-2 border-zinc-400/50">
                  <span className="text-[10px] font-bold text-zinc-400">2º</span>
                </div>
              </div>
            )}
            
            {/* 1º Lugar */}
            {first && (
              <div className="relative flex flex-col items-center w-[40%] z-20 -mb-2 animate-fade-in-up">
                <div className="absolute -top-7 text-yellow-400 animate-pulse">
                  <Crown size={20} />
                </div>
                <Avatar name={first.name} src={first.avatar_url} size="md" className={`mb-2 ring-4 shadow-[0_0_15px_currentColor] ${colorClass.split(' ')[0].replace('text-', 'ring-').replace('fill-', '')} ${colorClass}`} />
                <p className="font-bold text-text-primary text-[11px] truncate w-full text-center">{first.name}</p>
                <div className={`mt-1 text-sm font-bold ${colorClass} bg-surface-highlight px-2 py-0.5 rounded-full`}>{first.count}x</div>
                <div className={`w-full bg-gradient-to-t from-surface-highlight to-surface h-14 mt-2 rounded-t-md flex items-end justify-center pb-1 border-t-4 border-current ${colorClass}`}>
                  <span className="text-[12px] font-bold">1º</span>
                </div>
              </div>
            )}

            {/* 3º Lugar */}
            {third && (
              <div className="flex flex-col items-center w-1/3 z-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <Avatar name={third.name} src={third.avatar_url} size="sm" className="mb-2 ring-2 ring-orange-600/50" />
                <p className="font-medium text-text-primary text-[10px] truncate w-full text-center">{third.name}</p>
                <div className={`mt-1 text-xs font-bold ${colorClass}`}>{third.count}x</div>
                <div className="w-full bg-surface-highlight h-8 mt-2 rounded-t-md flex items-end justify-center pb-1 border-t-2 border-orange-600/50">
                  <span className="text-[10px] font-bold text-orange-600/80">3º</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Outros (4º em diante) se houver */}
          {data.length > 3 && (
            <div className="flex flex-col gap-1.5 w-full mt-2 pt-2 border-t border-border/50 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
              {data.slice(3).map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 bg-surface/30 p-1.5 rounded-lg text-left">
                  <span className="text-text-muted font-bold text-[10px] w-4 text-center">{i + 4}º</span>
                  <Avatar name={p.name} src={p.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary text-[10px] truncate">{p.name}</p>
                  </div>
                  <span className={`text-[10px] ${colorClass} font-bold`}>{p.count}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-text-muted text-sm my-auto opacity-50 pt-4">Sem dados</p>
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
      <SyncButton 
        onSync={() => {
          refetch();
        }} 
      />

      {/* Page header */}
      <div>
        <h1 className="page-title">DASHBOARD</h1>
        <p className="page-subtitle">
          Visão geral do desempenho do time.
        </p>
      </div>

      {/* Stat Cards - Desconstruídos */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        {/* Card Principal de Presenças */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 bg-gradient-to-br from-red/20 via-surface to-surface border-2 border-red/30 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(217,4,41,0.15)] flex items-center justify-between"
        >
          <div className="absolute -right-6 -top-6 text-red/5">
            <Flame size={120} />
          </div>
          <div className="z-10 relative">
            <div className="flex items-center gap-2 text-red/80 font-bold tracking-widest text-xs mb-2">
              <CalendarCheck size={16} />
              HOJE NA QUADRA
            </div>
            <div className="flex items-baseline gap-3">
              <h2 className="font-display text-6xl text-text-primary leading-none">{data.present_today}</h2>
              <span className="text-text-secondary text-sm">atletas presentes</span>
            </div>
            {data.paid_today > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 bg-green-500/10 text-green-500 text-xs font-bold px-3 py-1 rounded-full border border-green-500/20">
                <span>💰</span> {data.paid_today} pagamentos confirmados
              </div>
            )}
          </div>
        </motion.div>

        {/* Estatísticas Secundárias em Pills */}
        <div className="flex flex-col gap-3 justify-center lg:w-64 flex-shrink-0">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-surface/80 border border-blue/30 rounded-xl p-4 flex items-center gap-4 hover:border-blue/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-blue/20 text-blue flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <p className="text-text-muted text-[10px] font-bold tracking-wider uppercase mb-0.5">Total Registrado</p>
              <p className="font-display text-2xl text-text-primary leading-none">{data.total_players}</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-surface/80 border border-green-500/30 rounded-xl p-4 flex items-center gap-4 hover:border-green-500/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center">
              <UserCheck size={20} />
            </div>
            <div>
              <p className="text-text-muted text-[10px] font-bold tracking-wider uppercase mb-0.5">Jogadores Ativos</p>
              <p className="font-display text-2xl text-text-primary leading-none">{data.active_players}</p>
            </div>
          </motion.div>
        </div>
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
            <Link to="/stars-system" className="btn-secondary text-xs px-4 py-2 flex items-center justify-center gap-2 whitespace-nowrap bg-surface hover:bg-surface-hover">
              <Star size={14} className="text-yellow-400" />
              Ver Sistema Completo
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            {/* 1º Lugar Gigante */}
            {data.top_stars[0] && (() => {
              const p1 = data.top_stars[0];
              const hasBig = p1.big_stars > 0;
              return (
                <Link
                  to={`/players/${p1.id}`}
                  className="bg-gradient-to-r from-yellow-500/20 via-surface to-surface border border-yellow-500/40 rounded-2xl p-5 flex items-center gap-6 group hover:shadow-[0_0_30px_rgba(234,179,8,0.2)] transition-all"
                >
                  <div className="relative">
                    <div className="absolute -top-3 -left-3 w-8 h-8 bg-yellow-500 text-black font-black flex items-center justify-center rounded-full shadow-lg z-10 text-sm">
                      1
                    </div>
                    <Avatar name={p1.name} src={p1.avatar_url} size="xl" className="ring-4 ring-yellow-400/60 shadow-[0_0_20px_rgba(250,204,21,0.5)]" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-display text-2xl text-yellow-400 tracking-wide group-hover:text-yellow-300 transition-colors">{p1.name}</h3>
                      {hasBig && (
                        <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded-full border border-yellow-500/30">
                          {Array.from({ length: Math.min(p1.big_stars, 3) }).map((_, i) => (
                            <span key={i} className="text-sm">🌟</span>
                          ))}
                          {p1.big_stars > 3 && <span className="text-xs text-yellow-400 font-bold ml-1">+{p1.big_stars - 3}</span>}
                        </div>
                      )}
                    </div>
                    
                    {/* Barras Horizontais do 1º colocado */}
                    <div className="grid grid-cols-3 gap-4 max-w-lg mt-3">
                       <div className="flex flex-col">
                         <span className="text-[10px] text-yellow-400 font-bold uppercase mb-1 flex justify-between">MVP <span>{p1.mvp_stars}</span></span>
                         <div className="h-1.5 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-yellow-400 rounded-full" style={{width: `${(p1.mvp_stars/5)*100}%`}}></div></div>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] text-red font-bold uppercase mb-1 flex justify-between">ATQ <span>{p1.attack_stars}</span></span>
                         <div className="h-1.5 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-red rounded-full" style={{width: `${(p1.attack_stars/5)*100}%`}}></div></div>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] text-blue font-bold uppercase mb-1 flex justify-between">DEF <span>{p1.defense_stars}</span></span>
                         <div className="h-1.5 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-blue rounded-full" style={{width: `${(p1.defense_stars/5)*100}%`}}></div></div>
                       </div>
                    </div>
                  </div>
                  
                  <div className="hidden sm:flex flex-col items-center justify-center bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
                    <span className="text-[10px] text-yellow-500/80 font-bold uppercase tracking-wider mb-1">Total Mini</span>
                    <span className="font-display text-4xl text-yellow-500 leading-none">{p1.mini_stars}</span>
                    <span className="text-xs text-yellow-500/60 font-bold">/15</span>
                  </div>
                </Link>
              );
            })()}

            {/* Restante: Grid em escada */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {data.top_stars.slice(1).map((player, sliceIdx) => {
                const idx = sliceIdx + 1; // índice real
                const hasBigStar = player.big_stars > 0;
                
                return (
                  <Link
                    key={player.id}
                    to={`/players/${player.id}`}
                    className={`
                      relative rounded-xl p-3 flex items-center text-left transition-all duration-300 group
                      ${hasBigStar
                        ? 'bg-gradient-to-b from-yellow-500/10 to-surface border border-yellow-500/30 hover:border-yellow-400/60'
                        : 'bg-surface border border-border hover:border-yellow-400/30'}
                    `}
                  >
                    <div className={`absolute -top-2 -left-2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-md z-10 ${
                      idx === 1 ? 'bg-zinc-300 text-black' :
                      idx === 2 ? 'bg-orange-400 text-black' :
                      'bg-surface-highlight text-text-muted border border-border'
                    }`}>
                      {idx + 1}
                    </div>

                    <Avatar name={player.name} src={player.avatar_url} size="sm" className="mr-3" />
                    
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold text-xs truncate ${hasBigStar ? 'text-yellow-400' : 'text-text-primary'}`}>{player.name}</h3>
                      <div className="flex flex-wrap items-center gap-x-2 mt-0.5 text-[9px] font-bold">
                        {hasBigStar && (
                          <span className="text-[10px] text-yellow-500 mr-1">🌟 {player.big_stars}</span>
                        )}
                        {player.mvp_stars > 0 && <span className="text-yellow-400">MVP {player.mvp_stars}</span>}
                        {player.attack_stars > 0 && <span className="text-red">ATQ {player.attack_stars}</span>}
                        {player.defense_stars > 0 && <span className="text-blue">DEF {player.defense_stars}</span>}
                        {player.mini_stars === 0 && !hasBigStar && <span className="text-text-muted">Sem minis</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Heroes (Os 2 Mais Recentes) */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.new_stars.slice(0, 2).map((p0, idx) => {
                const catConfig = {
                  mvp: { label: 'MVP', icon: Trophy, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30 glow-yellow' },
                  attack: { label: 'Melhor Ataque', icon: Zap, color: 'text-red bg-red/10 border-red/30 glow-red' },
                  defense: { label: 'Melhor Defesa', icon: Shield, color: 'text-blue bg-blue/10 border-blue/30 glow-blue' },
                };
                const cat = p0.top_category ? catConfig[p0.top_category] : null;
                const CatIcon = cat?.icon || Star;
                const heroColor = cat ? cat.color.split(' ')[0] : 'text-yellow-500';
                
                return (
                  <Link
                    key={`hero-${p0.id}`}
                    to={`/players/${p0.id}`}
                    className="block bg-surface border border-border rounded-2xl overflow-hidden group hover:border-yellow-500/50 transition-all h-full"
                  >
                    {/* Header bg */}
                    <div className={`h-24 w-full bg-gradient-to-r ${
                      p0.top_category === 'mvp' ? 'from-yellow-500/20 to-surface' :
                      p0.top_category === 'attack' ? 'from-red/20 to-surface' :
                      p0.top_category === 'defense' ? 'from-blue/20 to-surface' :
                      'from-yellow-500/20 to-surface'
                    } relative`}>
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-surface/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-primary">
                          {idx === 0 ? 'Último Destaque' : 'Penúltimo Destaque'}
                        </span>
                        <Sparkles size={12} className={heroColor} />
                      </div>
                    </div>
                    
                    <div className="px-6 pb-6 relative -mt-12 flex flex-col items-center text-center gap-4">
                      <Avatar name={p0.name} src={p0.avatar_url} size="xl" className="w-24 h-24 ring-4 ring-surface shadow-xl" />
                      
                      <div className="w-full flex flex-col items-center">
                        <h3 className="font-display text-2xl text-text-primary group-hover:text-yellow-400 transition-colors">{p0.name}</h3>
                        
                        {cat && (
                          <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full border ${cat.color} font-bold text-xs uppercase tracking-widest`}>
                            <CatIcon size={12} />
                            Ganhou como {cat.label}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border/50 w-full">
                          {p0.big_stars > 0 && (
                            <span className="text-sm font-bold text-yellow-500 flex items-center gap-1">
                              🌟 {p0.big_stars} Grandes
                            </span>
                          )}
                          <span className="text-sm font-bold text-yellow-500/70 flex items-center gap-1">
                            ✦ {p0.mini_stars}/15 Minis
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Outros na lateral */}
            {data.new_stars.length > 2 && (
              <div className="lg:col-span-1 flex flex-col gap-3">
                {data.new_stars.slice(2).map(player => {
                  const catConfig = {
                    mvp: { label: 'MVP', icon: Trophy, color: 'text-yellow-400 bg-yellow-500/10' },
                    attack: { label: 'ATQ', icon: Zap, color: 'text-red bg-red/10' },
                    defense: { label: 'DEF', icon: Shield, color: 'text-blue bg-blue/10' },
                  };
                  const cat = player.top_category ? catConfig[player.top_category] : null;
                  const CatIcon = cat?.icon || Star;
                  
                  return (
                    <Link
                      key={`coroado-${player.id}`}
                      to={`/players/${player.id}`}
                      className="flex items-center gap-3 bg-surface/50 border border-border hover:border-yellow-500/30 p-3 rounded-xl transition-all group"
                    >
                      <Avatar name={player.name} src={player.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-text-primary truncate group-hover:text-yellow-400 transition-colors">{player.name}</p>
                        <p className="text-[10px] text-text-muted mt-0.5 uppercase">{player.big_stars > 0 ? `🌟 ${player.big_stars} | ` : ''}✦ {player.mini_stars}/15</p>
                      </div>
                      {cat && (
                        <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg border border-border/50 ${cat.color}`}>
                          <CatIcon size={12} className="mb-0.5" />
                          <span className="text-[8px] font-bold tracking-widest">{cat.label}</span>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
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
            <HighlightColumn title="Melhor Defesa" icon={Shield} colorClass="text-blue" bgClass="bg-blue/20" data={data.highlights.best_defender || []} />
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
