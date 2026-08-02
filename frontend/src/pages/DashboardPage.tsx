import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Users, UserCheck, CalendarCheck, Star, TrendingUp, Award, Swords, Shield, Trophy, Flame, Crown, Medal, CalendarDays, Sparkles, Zap, Crosshair, Activity, Lock } from 'lucide-react';
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
import { formatDateTime, cn } from '@/lib/utils';
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

// Funções e Componentes utilitários removidos para dar espaço ao Fire Shark

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
        {/* Próximo Circuito */}
        {data.next_circuit ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 bg-gradient-to-br from-red/20 via-surface to-surface border-2 border-red/30 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(217,4,41,0.15)] flex flex-col justify-between"
          >
            <div className="absolute -right-6 -top-6 text-red/5">
              <Flame size={120} />
            </div>
            <div className="z-10 relative mb-4">
              <div className="flex items-center gap-2 text-red/80 font-bold tracking-widest text-xs mb-2 uppercase truncate">
                <CalendarCheck size={16} className="flex-shrink-0" />
                <span className="truncate">
                  {data.next_circuit.description || 'Circuito Aberto'} • {data.next_circuit.location || 'Sem local'} ({new Date(data.next_circuit.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })})
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-5xl text-text-primary leading-none">
                  {data.next_circuit.total_present}
                  <span className="text-2xl text-text-muted">/{data.next_circuit.max_players || '∞'}</span>
                </h2>
                <span className="text-text-secondary text-sm">confirmados</span>
              </div>
            </div>

            <div className="z-10 relative flex flex-col sm:flex-row gap-3">
              {data.next_circuit.total_unpaid > 0 && data.next_circuit.court_price > 0 && (
                <div className="inline-flex items-center gap-2 bg-red/10 text-red text-xs font-bold px-3 py-2 rounded-lg border border-red/20">
                  <span className="animate-pulse">⚠️</span> {data.next_circuit.total_unpaid} aguardando pagamento
                </div>
              )}
              {data.next_circuit.court_price > 0 && (
                <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-500 text-xs font-bold px-3 py-2 rounded-lg border border-green-500/20">
                  <span>💰</span> R$ {data.next_circuit.court_price} (Quadra)
                </div>
              )}
            </div>
            
            {/* Barra de progresso */}
            {data.next_circuit.max_players > 0 && (
              <div className="mt-4 w-full h-2 bg-surface-highlight rounded-full overflow-hidden z-10 relative">
                <div 
                  className={cn("h-full rounded-full transition-all duration-1000", data.next_circuit.total_present >= data.next_circuit.max_players ? "bg-red" : "bg-green-500")}
                  style={{ width: `${Math.min((data.next_circuit.total_present / data.next_circuit.max_players) * 100, 100)}%` }}
                />
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 bg-surface border border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center"
          >
            <CalendarDays size={48} className="text-text-muted mb-4 opacity-20" />
            <h3 className="text-lg font-bold text-text-primary mb-1">Nenhum Circuito Aberto</h3>
            <p className="text-sm text-text-muted">Crie um novo GameDay para iniciar as confirmações.</p>
          </motion.div>
        )}

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

      {/* Operacional Secundário */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Gráfico de Frequência */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card p-5"
        >
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-blue" /> Taxa de Lotação (Últimos 6)
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.attendance_trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#71717A', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717A', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="rate" stroke="#2563EB" strokeWidth={3} dot={{ r: 4, fill: '#2563EB', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Lotação %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top Assíduos */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-5"
        >
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <Zap size={14} className="text-yellow-500" /> Os 5 Mais Assíduos
          </h3>
          <div className="flex flex-col gap-2">
            {data.top_attendees?.length > 0 ? data.top_attendees.map((att, i) => (
              <Link to={`/players/${att.id}`} key={att.id} className="flex items-center gap-3 bg-surface-highlight/30 p-2 rounded-lg hover:bg-surface-highlight/60 transition-colors">
                <span className="text-text-muted text-[10px] font-bold w-4 text-center">{i + 1}º</span>
                <Avatar name={att.name} src={att.avatar_url} size="sm" />
                <span className="flex-1 text-sm font-medium text-text-primary truncate">{att.name}</span>
                <span className="text-[10px] font-bold bg-surface px-2 py-1 rounded text-text-secondary border border-border">
                  {att.presence_count} presenças
                </span>
              </Link>
            )) : (
              <p className="text-text-muted text-xs text-center py-4">Nenhum dado de presença.</p>
            )}
          </div>
        </motion.div>
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
                    <div className="grid grid-cols-3 gap-2 mt-3 w-full">
                       <div className="flex flex-col">
                         <span className="text-[9px] text-yellow-400 font-bold uppercase mb-1 flex justify-between">MVP <span>{p1.mvp_stars}</span></span>
                         <div className="h-1 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-yellow-400 rounded-full" style={{width: `${(p1.mvp_stars/5)*100}%`}}></div></div>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[9px] text-red font-bold uppercase mb-1 flex justify-between">ATQ <span>{p1.attack_stars}</span></span>
                         <div className="h-1 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-red rounded-full" style={{width: `${(p1.attack_stars/5)*100}%`}}></div></div>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[9px] text-blue font-bold uppercase mb-1 flex justify-between">DEF <span>{p1.defense_stars}</span></span>
                         <div className="h-1 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-blue rounded-full" style={{width: `${(p1.defense_stars/5)*100}%`}}></div></div>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[9px] text-orange-500 font-bold uppercase mb-1 flex justify-between">LEV <span>{p1.setter_stars}</span></span>
                         <div className="h-1 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full" style={{width: `${(p1.setter_stars/5)*100}%`}}></div></div>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[9px] text-green-500 font-bold uppercase mb-1 flex justify-between">PAS <span>{p1.pass_stars}</span></span>
                         <div className="h-1 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{width: `${(p1.pass_stars/5)*100}%`}}></div></div>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[9px] text-purple-500 font-bold uppercase mb-1 flex justify-between">BLO <span>{p1.block_stars}</span></span>
                         <div className="h-1 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{width: `${(p1.block_stars/5)*100}%`}}></div></div>
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
                        {player.setter_stars > 0 && <span className="text-orange-500">LEV {player.setter_stars}</span>}
                        {player.pass_stars > 0 && <span className="text-green-500">PAS {player.pass_stars}</span>}
                        {player.block_stars > 0 && <span className="text-purple-500">BLO {player.block_stars}</span>}
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
          <div className="flex flex-col gap-6">
            {(() => {
              const mvpIndex = data.new_stars.findIndex(p => p.top_category === 'mvp');
              const mvpPlayer = mvpIndex >= 0 ? data.new_stars[mvpIndex] : null;
              const otherPlayers = data.new_stars.filter((_, idx) => idx !== mvpIndex);
              
              const catConfig: Record<string, { label: string, icon: any, color: string }> = {
                mvp: { label: 'MVP', icon: Trophy, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30 glow-yellow' },
                attack: { label: 'Melhor Ataque', icon: Zap, color: 'text-red bg-red/10 border-red/30 glow-red' },
                defense: { label: 'Melhor Defesa', icon: Shield, color: 'text-blue bg-blue/10 border-blue/30 glow-blue' },
                setter: { label: 'Melhor Levantador', icon: Crosshair, color: 'text-orange-500 bg-orange-500/10 border-orange-500/30 glow-orange' },
                pass: { label: 'Melhor Passe', icon: Activity, color: 'text-green-500 bg-green-500/10 border-green-500/30 glow-green' },
                block: { label: 'Melhor Bloqueio', icon: Lock, color: 'text-purple-500 bg-purple-500/10 border-purple-500/30 glow-purple' },
              };

              // MVP Card Rendering
              const renderMVP = (p0: any) => {
                const cat = p0.top_category ? catConfig[p0.top_category] : null;
                const CatIcon = cat?.icon || Star;
                const heroColor = cat ? cat.color.split(' ')[0] : 'text-yellow-500';

                return (
                  <Link
                    key={`hero-${p0.id}`}
                    to={`/players/${p0.id}`}
                    className="block bg-surface border border-border rounded-2xl overflow-hidden group hover:border-yellow-500/50 transition-all w-full"
                  >
                    <div className="h-32 w-full bg-gradient-to-r from-yellow-500/20 via-surface to-surface relative">
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-surface/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border">
                        <span className="text-xs font-black uppercase tracking-widest text-yellow-500">
                          {cat?.label || 'Destaque'}
                        </span>
                        <Sparkles size={14} className={heroColor} />
                      </div>
                    </div>
                    <div className="px-6 pb-6 relative -mt-16 flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
                      <Avatar name={p0.name} src={p0.avatar_url} size="xl" className="w-32 h-32 ring-4 ring-surface shadow-2xl" />
                      <div className="flex-1 flex flex-col md:flex-row items-center md:items-center justify-between w-full">
                        <div>
                          <h3 className="font-display text-3xl text-text-primary group-hover:text-yellow-400 transition-colors">{p0.name}</h3>
                          {cat && (
                            <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full border ${cat.color} font-bold text-xs uppercase tracking-widest`}>
                              <CatIcon size={12} />
                              Rei do Circuito
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-4 md:mt-0 bg-surface-highlight p-3 rounded-xl border border-border">
                          {p0.big_stars > 0 && (
                            <div className="flex flex-col items-center justify-center min-w-[70px]">
                              <span className="text-xl font-black text-yellow-500">{p0.big_stars}</span>
                              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Grandes</span>
                            </div>
                          )}
                          {p0.big_stars > 0 && <div className="w-px h-8 bg-border" />}
                          <div className="flex flex-col items-center justify-center min-w-[70px]">
                            <span className="text-xl font-black text-yellow-500/80">{p0.mini_stars}/15</span>
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Minis</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              };

              // Secondary Cards Rendering
              const renderSecondary = (player: any) => {
                const cat = player.top_category ? catConfig[player.top_category] : null;
                const CatIcon = cat?.icon || Star;
                const heroColor = cat ? cat.color.split(' ')[0] : 'text-yellow-500';
                
                return (
                  <Link
                    key={`coroado-${player.id}`}
                    to={`/players/${player.id}`}
                    className="flex flex-col bg-surface border border-border hover:border-text-muted/50 rounded-2xl overflow-hidden transition-all group h-full"
                  >
                    <div className={`h-16 w-full bg-gradient-to-b ${cat ? cat.color.split(' ')[1].replace('/10', '/20') : 'from-surface'} to-surface relative flex justify-center`}>
                      <div className="absolute top-2 right-2">
                        {cat && <CatIcon size={16} className={heroColor} opacity={0.5} />}
                      </div>
                    </div>
                    <div className="px-4 pb-4 relative -mt-8 flex flex-col items-center text-center gap-2 flex-1">
                      <Avatar name={player.name} src={player.avatar_url} size="md" className="w-16 h-16 ring-4 ring-surface shadow-lg" />
                      <div className="flex-1 flex flex-col items-center w-full">
                        <p className="font-bold text-sm text-text-primary group-hover:text-text-primary transition-colors line-clamp-1 w-full">{player.name}</p>
                        {cat && (
                          <div className={`mt-1 text-[9px] font-black uppercase tracking-widest ${heroColor} bg-surface-highlight px-2 py-0.5 rounded-full border border-border w-full truncate`}>
                            {cat.label}
                          </div>
                        )}
                        <div className="mt-auto pt-3 flex items-center justify-center gap-2 w-full">
                          {player.big_stars > 0 && (
                            <span className="text-[10px] font-bold text-yellow-500 flex items-center">
                              🌟 {player.big_stars}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-text-muted flex items-center">
                            ✦ {player.mini_stars}/15
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              };

              return (
                <>
                  {/* Destaque Principal (MVP) */}
                  {mvpPlayer && renderMVP(mvpPlayer)}
                  
                  {/* Outros Destaques */}
                  {otherPlayers.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                      {otherPlayers.map(renderSecondary)}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <p className="text-text-muted">Aguardando que atletas recebam estrelas para aparecerem aqui...</p>
        )}
      </motion.div>

      {/* ── DREAM TEAM (Top Win Rate por Posição) ── */}
      {data.dream_team && data.dream_team.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card p-6 bg-gradient-to-br from-surface to-[#0a0505] border border-red-900/30 shadow-[0_0_20px_rgba(220,38,38,0.05)]"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
              <Star size={24} className="fill-red-500/20" />
            </div>
            <div>
              <h2 className="font-display text-xl text-red-400 tracking-wider">DREAM TEAM HELLCIFE</h2>
              <p className="text-sm text-text-muted">A formação ideal baseada no aproveitamento Fire Shark de cada posição.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {data.dream_team.map((player) => (
              <Link 
                key={player.id} 
                to={`/players/${player.id}`}
                className="flex flex-col items-center bg-black/40 border border-border/50 rounded-2xl p-4 hover:border-red-500/50 hover:bg-surface-highlight transition-all group"
              >
                <PositionBadge position={player.position as any} className="mb-3 text-[10px] px-2 py-0.5" />
                <Avatar name={player.name} src={player.avatar_url} size="lg" className="ring-2 ring-red-500/20 group-hover:ring-red-500/50 mb-3 shadow-[0_0_15px_rgba(239,68,68,0.1)] group-hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all" />
                <h3 className="font-bold text-sm text-text-primary text-center truncate w-full">{player.name}</h3>
                <div className="flex flex-col items-center mt-2 w-full bg-red-900/20 rounded-lg p-2 border border-red-500/10">
                  <span className="text-orange-400 font-display text-lg leading-none">{player.win_rate}%</span>
                  <span className="text-[9px] text-text-muted uppercase font-bold tracking-widest mt-1">{player.wins}/{player.total_matches} vitórias</span>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── FIRE SHARKS TOP 10 ── */}
      {data.fire_sharks && data.fire_sharks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card p-6 bg-gradient-to-br from-[#050202] to-[#110505] border border-orange-500/20 shadow-[0_0_30px_rgba(249,115,22,0.1)] relative overflow-hidden"
        >
          {/* Subtle bg decorations */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-600/5 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="relative z-10 flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
               <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                 <Flame size={24} />
               </div>
               <div>
                 <h2 className="font-display text-2xl text-orange-400 tracking-wider flex items-center gap-2">
                   TUBARÕES DA QUADRA <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/30">TOP 10</span>
                 </h2>
                 <p className="text-sm text-text-muted">Ranking de aproveitamento Fire Shark (Mínimo de 10 jogos)</p>
               </div>
             </div>
          </div>
          
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.fire_sharks.map((player, idx) => (
              <Link
                key={player.id}
                to={`/players/${player.id}`}
                className={`flex items-center gap-4 p-3 sm:p-4 rounded-2xl border transition-all duration-300 group ${
                  idx === 0 
                    ? 'bg-gradient-to-r from-orange-900/30 to-black border-orange-500/50 hover:border-orange-400' 
                    : 'bg-black/40 border-border/50 hover:bg-surface/60 hover:border-orange-500/30'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-lg ${
                  idx === 0 ? 'bg-orange-500 text-black shadow-[0_0_10px_rgba(249,115,22,0.8)]' : 
                  idx === 1 ? 'bg-zinc-300 text-black' : 
                  idx === 2 ? 'bg-orange-700 text-black' : 
                  'bg-surface-highlight text-text-muted border border-border'
                }`}>
                  {idx + 1}
                </div>
                
                <Avatar name={player.name} src={player.avatar_url} size={idx === 0 ? "lg" : "md"} className={idx === 0 ? "ring-2 ring-orange-500" : ""} />
                
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold truncate ${idx === 0 ? 'text-orange-400 text-base' : 'text-text-primary text-sm'}`}>
                    {player.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <PositionBadge position={player.position as any} className="text-[9px] px-1.5 py-0.5" />
                    <span className="text-text-muted text-xs">{player.wins}V - {player.total_matches - player.wins}D</span>
                  </div>
                </div>
                
                <div className="flex flex-col items-end">
                   <div className="flex items-center gap-1">
                     <span className={`font-display ${idx === 0 ? 'text-2xl text-orange-400' : 'text-xl text-text-primary'}`}>
                       {player.win_rate}%
                     </span>
                   </div>
                   <span className="text-[9px] text-text-muted uppercase font-bold tracking-widest mt-0.5">Win Rate</span>
                </div>
              </Link>
            ))}
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
