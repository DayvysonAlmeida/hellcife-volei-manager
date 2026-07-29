import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Trophy, Flame, Star, ChevronRight, TrendingUp, Medal, History, Crown, AlertTriangle, Swords, CalendarCheck, Info } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { PageLoading } from '@/components/ui/Loading';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import type { DashboardStats } from '@/types';

const CATEGORY_MAP: Record<string, { label: string, color: string, icon: any }> = {
  mvp: { label: 'MVP', color: 'text-yellow-400 bg-yellow-500/10', icon: Crown },
  attack: { label: 'Ataque', color: 'text-red bg-red/10', icon: Flame },
  defense: { label: 'Defesa', color: 'text-blue-400 bg-blue-500/10', icon: Star },
  setter: { label: 'Levantamento', color: 'text-green-400 bg-green-500/10', icon: Star },
  pass: { label: 'Passe', color: 'text-purple-400 bg-purple-500/10', icon: Star },
  block: { label: 'Bloqueio', color: 'text-orange-400 bg-orange-500/10', icon: Star },
  promotion: { label: 'Grande Estrela', color: 'text-yellow-500 bg-yellow-500/10', icon: Crown },
};

const STATUS_MAP: Record<string, { label: string, color: string }> = {
  active: { label: 'Ativo', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  inactive: { label: 'Inativo', color: 'bg-red/10 text-red border-red/20' },
  injured: { label: 'Lesionado', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  suspended: { label: 'Suspenso', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
};

export function AthleteDashboardPage() {
  const { user } = useAuth();

  const { data: player, isLoading: loadingPlayer } = useQuery({
    queryKey: ['athlete-me'],
    queryFn: () => api.get('/players/me/').then(r => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['athlete-stats', player?.id],
    queryFn: () => api.get(`/players/${player.id}/stats/`).then(r => r.data),
    enabled: !!player?.id,
  });

  const { data: dashboard, isLoading: loadingDashboard } = useQuery<DashboardStats>({
    queryKey: ['athlete-dashboard-stats'],
    queryFn: () => api.get('/players/dashboard-stats/').then(r => r.data),
  });

  if (loadingPlayer || loadingDashboard) return <PageLoading />;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const statCards = [
    { label: 'Top 10 Vits', value: dashboard?.top_wins.findIndex(p => p.id === player?.id) !== -1 ? `#${(dashboard?.top_wins.findIndex(p => p.id === player?.id) ?? -1) + 1}` : '—', icon: Trophy, color: 'text-yellow-400' },
    { label: 'Top 10 Estrelas', value: dashboard?.top_stars.findIndex(p => p.id === player?.id) !== -1 ? `#${(dashboard?.top_stars.findIndex(p => p.id === player?.id) ?? -1) + 1}` : '—', icon: Star, color: 'text-blue-400' },
    { label: 'Partidas', value: stats?.total_matches ?? '—', icon: Swords, color: 'text-blue-400' },
    { label: 'Vitórias', value: stats?.wins ?? '—', icon: Trophy, color: 'text-green-400' },
    { label: 'Presença', value: stats?.attendance_rate != null ? `${stats.attendance_rate}%` : '—', icon: CalendarCheck, color: 'text-purple-400' },
    { label: 'Mini Estrelas', value: player?.mini_stars ?? '—', icon: Flame, color: 'text-orange-400' },
  ];

  const playerStatus = player?.status ? STATUS_MAP[player.status] : null;

  return (
    <div className="space-y-8 pb-10">
      {/* ── Header de Boas-vindas (Estilo Carta Premium Glassmorphism) ── */}
      <div className="relative group/header">
        {/* Animated Gradient Border Layer */}
        <div className="absolute -inset-[2px] bg-gradient-to-br from-red/80 via-transparent to-blue/80 rounded-[34px] opacity-40 group-hover/header:opacity-100 transition-opacity duration-700 blur-sm pointer-events-none"></div>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[32px] bg-white/80 dark:bg-[#050505]/80 backdrop-blur-3xl border border-gray-200 dark:border-white/10 p-8 shadow-neon-red"
        >
          {/* Ambient inner glow */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-red/60 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-blue/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none opacity-50" />
        
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="relative flex-shrink-0 group">
            <div className="absolute -inset-1 bg-gradient-to-r from-red to-orange-500 rounded-full blur opacity-70 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse" />
            <Avatar
              name={player?.display_name || user?.name || ''}
              src={player?.avatar_url || undefined}
              size="xl"
              className="relative ring-4 ring-black shadow-2xl"
            />
            {player?.big_stars > 0 && (
              <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-full w-10 h-10 flex items-center justify-center text-sm font-black text-black shadow-xl border-2 border-black transform rotate-12">
                {player.big_stars}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center h-full pt-2">
            <div className="flex items-center justify-center sm:justify-start gap-3 mb-1">
              <p className="text-text-muted text-sm uppercase tracking-[0.2em] font-medium">{greeting()},</p>
              {playerStatus && (
                <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-lg", playerStatus.color)}>
                  {playerStatus.label}
                </span>
              )}
            </div>
            <h1 className="font-display text-4xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-white/70 tracking-wider truncate drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
              {(player?.display_name || user?.name || '').toUpperCase()}
            </h1>
            {player?.shirt_number && (
              <div className="flex items-center justify-center sm:justify-start gap-3 mt-3">
                <div className="bg-red/20 border border-red/30 px-4 py-1.5 rounded-lg flex items-center gap-2">
                  <span className="text-text-muted text-xs uppercase tracking-wider">Camisa</span>
                  <span className="text-red font-display text-xl leading-none">#{player.shirt_number}</span>
                </div>
                {player?.main_position_display && (
                  <div className="bg-surface-highlight/50 border border-border/50 px-4 py-1.5 rounded-lg">
                    <span className="text-text-muted text-xs uppercase tracking-wider">{player.main_position_display}</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Faltas Consecutivas Alerta Crítico */}
            {player && player.consecutive_absences > 0 && (
              <div className={cn("mt-5 flex items-start gap-3 p-3 rounded-xl max-w-lg border backdrop-blur-sm", 
                player.consecutive_absences >= 8 ? "bg-red/20 border-red/40 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.3)]" : "bg-orange-500/10 border-orange-500/30 text-orange-200"
              )}>
                <AlertTriangle size={20} className={cn("mt-0.5 flex-shrink-0", player.consecutive_absences >= 8 ? "text-red" : "text-orange-400")} />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold tracking-wide">
                    {player.consecutive_absences} faltas consecutivas na quadra.
                  </p>
                  <p className={cn("text-xs mt-1", player.consecutive_absences >= 8 ? "text-red-300 font-bold" : "text-orange-400/80")}>
                    Ao atingir 10 faltas sem check-in, seu cadastro será inativado automaticamente.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
      </div>

      {/* ── Stats Pessoais Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="relative overflow-hidden rounded-[24px] bg-gray-50/80 dark:bg-[#111]/60 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-4 text-center hover:bg-white dark:hover:bg-black/80 hover:border-red/50 hover:shadow-neon-red transition-all duration-300 group"
          >
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${s.color.replace('text-', 'from-').replace('-400', '-500/10')} to-transparent rounded-bl-full pointer-events-none`} />
            <s.icon size={24} className={`mx-auto mb-2 transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1 ${s.color}`} />
            <p className="font-display text-3xl text-gray-900 dark:text-white drop-shadow-sm">{s.value}</p>
            <p className="text-text-muted text-[10px] uppercase tracking-widest font-medium mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Rankings Top 10 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top 10 Vitórias */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-[32px] border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-[#050505]/60 backdrop-blur-2xl overflow-hidden flex flex-col shadow-2xl"
        >
          <div className="p-6 border-b border-gray-200 dark:border-white/10 flex flex-col items-center justify-center gap-1 bg-gray-100/80 dark:bg-[#111]/80 backdrop-blur-md relative overflow-hidden text-center">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/10 to-transparent pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              <Trophy size={24} className="text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
              <h2 className="font-display text-xl tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 font-bold">GLADIADORES</h2>
            </div>
            <p className="text-[11px] text-gray-400/80 font-medium relative z-10 max-w-sm mt-1 uppercase tracking-wider">
              O RANKING DOS GUERREIROS COM MAIS VITÓRIAS <br className="hidden sm:block" />(A barra % reflete a taxa de vitórias sobre os jogos disputados)
            </p>
          </div>
          <div className="p-3 space-y-2 flex-1 bg-white/40 dark:bg-black/40">
            {dashboard?.top_wins.map((p, i) => {
              const isFirst = i === 0;
              const isSecond = i === 1;
              const isThird = i === 2;
              const isTop3 = isFirst || isSecond || isThird;
              
              const bgClass = isFirst ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-500/5 border-yellow-500/30' :
                              isSecond ? 'bg-gradient-to-r from-gray-300/20 to-gray-300/5 border-gray-300/30' :
                              isThird ? 'bg-gradient-to-r from-amber-700/20 to-amber-700/5 border-amber-700/30' :
                              p.id === player?.id ? 'bg-red/10 border-red/30' : 'bg-surface hover:bg-surface-highlight border-border/20';
                              
              const textClass = isFirst ? 'text-yellow-400 font-bold' :
                                isSecond ? 'text-gray-300 font-bold' :
                                isThird ? 'text-amber-500 font-bold' :
                                p.id === player?.id ? 'text-red font-bold' : 'text-text-primary';

              return (
                <div key={p.id} className={cn("relative overflow-hidden flex items-center gap-4 p-3 rounded-2xl transition-all border", bgClass, isTop3 ? "shadow-lg scale-[1.02] my-1" : "")}>
                  
                  {/* Gráfico de Barra (Win Rate) no background */}
                  <div 
                    className={cn("absolute inset-y-0 left-0 z-0 opacity-20", isFirst ? "bg-yellow-500" : isSecond ? "bg-gray-400" : isThird ? "bg-amber-600" : "bg-green-500")}
                    style={{ width: `${p.win_rate || 0}%` }}
                  />
                  
                  <div className="relative z-10 flex items-center gap-4 w-full">
                    <div className={cn("w-8 text-center font-display", isTop3 ? "text-2xl" : "text-lg text-text-muted")}>
                      {isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : `${i + 1}º`}
                    </div>
                    <Avatar name={p.name} src={p.avatar_url || undefined} size={isTop3 ? "md" : "sm"} className={isFirst ? "ring-2 ring-yellow-400" : ""} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-base truncate tracking-wide", textClass)}>{p.name}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-display leading-none", isTop3 ? "text-2xl text-gray-900 dark:text-white" : "text-xl text-text-primary")}>{p.wins}</p>
                      <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium mt-1">{p.win_rate}% Win</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {(!dashboard?.top_wins || dashboard.top_wins.length === 0) && (
              <p className="text-center text-text-muted text-sm py-10">Nenhum dado disponível.</p>
            )}
          </div>
        </motion.div>

        {/* Top 10 Estrelas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-[32px] border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-[#050505]/60 backdrop-blur-2xl overflow-hidden flex flex-col shadow-2xl"
        >
          <div className="p-6 border-b border-gray-200 dark:border-white/10 flex flex-col items-center justify-center gap-1 bg-gray-100/80 dark:bg-[#111]/80 backdrop-blur-md relative overflow-hidden text-center">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              <Star size={24} className="text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
              <h2 className="font-display text-xl tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-blue-600 font-bold">MURAL DAS ESTRELAS</h2>
            </div>
            <p className="text-[11px] text-gray-400/80 font-medium relative z-10 max-w-sm mt-1 uppercase tracking-wider">
              ACUMULE 15 MINI ESTRELAS PARA FORJAR UMA GRANDE ESTRELA DE PRESTÍGIO
            </p>
          </div>
          <div className="p-3 space-y-2 flex-1 bg-white/40 dark:bg-black/40">
            {dashboard?.top_stars.map((p, i) => {
              const isFirst = i === 0;
              const isSecond = i === 1;
              const isThird = i === 2;
              const isTop3 = isFirst || isSecond || isThird;
              
              const bgClass = isFirst ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-500/5 border-yellow-500/30' :
                              isSecond ? 'bg-gradient-to-r from-gray-300/20 to-gray-300/5 border-gray-300/30' :
                              isThird ? 'bg-gradient-to-r from-amber-700/20 to-amber-700/5 border-amber-700/30' :
                              p.id === player?.id ? 'bg-red/10 border-red/30' : 'bg-surface hover:bg-surface-highlight border-border/20';

              const textClass = isFirst ? 'text-yellow-400 font-bold' :
                                isSecond ? 'text-gray-300 font-bold' :
                                isThird ? 'text-amber-500 font-bold' :
                                p.id === player?.id ? 'text-red font-bold' : 'text-text-primary';

              return (
                <div key={p.id} className={cn("relative overflow-hidden flex items-start gap-4 p-3 rounded-2xl transition-all border", bgClass, isTop3 ? "shadow-lg scale-[1.02] my-1" : "")}>
                  
                  {/* Gráfico de Barra (Mini Stars / 15) no background */}
                  <div 
                    className={cn("absolute inset-y-0 left-0 z-0 opacity-10", isFirst ? "bg-yellow-500" : isSecond ? "bg-gray-400" : isThird ? "bg-amber-600" : "bg-blue-500")}
                    style={{ width: `${Math.min(((p.mini_stars || 0) / 15) * 100, 100)}%` }}
                  />

                  <div className="relative z-10 flex items-start gap-4 w-full">
                    <div className={cn("w-8 text-center font-display mt-1", isTop3 ? "text-2xl" : "text-lg text-text-muted")}>
                      {isFirst ? '👑' : isSecond ? '⭐' : isThird ? '⭐' : `${i + 1}º`}
                    </div>
                    <Avatar name={p.name} src={p.avatar_url || undefined} size={isTop3 ? "md" : "sm"} className={cn("mt-1", isFirst ? "ring-2 ring-yellow-400" : "")} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-base truncate tracking-wide", textClass)}>{p.name}</p>
                      
                      {/* Estrelas Visuais Específicas */}
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {p.big_stars! > 0 && (
                          <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-500 text-[10px] px-1.5 py-0.5 rounded border border-yellow-500/30">
                            🌟 {p.big_stars}
                          </span>
                        )}
                        {p.mvp_stars! > 0 && (
                          <span className="flex items-center gap-1 bg-purple-500/20 text-purple-400 text-[10px] px-1.5 py-0.5 rounded border border-purple-500/30" title="MVP">
                            🥇 {p.mvp_stars}
                          </span>
                        )}
                        {p.attack_stars! > 0 && (
                          <span className="flex items-center gap-1 bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded border border-red-500/30" title="Ataque">
                            ⚔️ {p.attack_stars}
                          </span>
                        )}
                        {p.defense_stars! > 0 && (
                          <span className="flex items-center gap-1 bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded border border-blue-500/30" title="Defesa">
                            🛡️ {p.defense_stars}
                          </span>
                        )}
                        {p.setter_stars! > 0 && (
                          <span className="flex items-center gap-1 bg-green-500/20 text-green-400 text-[10px] px-1.5 py-0.5 rounded border border-green-500/30" title="Levantamento">
                            🎯 {p.setter_stars}
                          </span>
                        )}
                        {p.pass_stars! > 0 && (
                          <span className="flex items-center gap-1 bg-cyan-500/20 text-cyan-400 text-[10px] px-1.5 py-0.5 rounded border border-cyan-500/30" title="Passe">
                            🦅 {p.pass_stars}
                          </span>
                        )}
                        {p.block_stars! > 0 && (
                          <span className="flex items-center gap-1 bg-orange-500/20 text-orange-400 text-[10px] px-1.5 py-0.5 rounded border border-orange-500/30" title="Bloqueio">
                            🧱 {p.block_stars}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4 mt-1">
                      {p.big_stars! > 0 && (
                        <div className="flex flex-col items-center">
                          <span className={cn("font-display text-yellow-500 leading-none", isTop3 ? "text-2xl" : "text-lg")}>{p.big_stars}</span>
                          <span className="text-[9px] text-text-muted uppercase tracking-widest mt-1">Big</span>
                        </div>
                      )}
                      <div className="flex flex-col items-center">
                        <span className={cn("font-display text-orange-400 leading-none", isTop3 ? "text-2xl" : "text-lg")}>{p.mini_stars}</span>
                        <span className="text-[9px] text-text-muted uppercase tracking-widest mt-1">Mini</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {(!dashboard?.top_stars || dashboard.top_stars.length === 0) && (
              <p className="text-center text-text-muted text-sm py-10">Nenhum dado disponível.</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Destaques Recentes e Últimos Ganhadores ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Galeria de Últimos Ganhadores */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 rounded-[32px] border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-[#050505]/60 backdrop-blur-2xl overflow-hidden flex flex-col shadow-2xl"
        >
          <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center gap-2 bg-gray-100/80 dark:bg-[#111]/80 backdrop-blur-md">
            <Medal size={18} className="text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
            <h2 className="font-display tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-white/70 font-bold">ATUAIS DONOS DO TÍTULO</h2>
          </div>
          <div className="p-4 flex-1">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {['mvp', 'attack', 'defense', 'setter', 'pass', 'block'].map((key) => {
                const cat = CATEGORY_MAP[key];
                const winner = dashboard?.last_category_winners?.[key];
                return (
                  <div key={key} className="bg-gray-50/80 dark:bg-[#111]/60 backdrop-blur-md border border-white/5 rounded-[24px] p-3 flex flex-col items-center text-center hover:bg-white dark:hover:bg-black/80 hover:border-red/30 hover:shadow-neon-red-sm transition-all duration-300">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-3 drop-shadow-md", cat.color)}>
                      <cat.icon size={20} />
                    </div>
                    {winner ? (
                      <>
                        <Avatar name={winner.player_name} src={winner.avatar_url || undefined} size="sm" className="mb-2" />
                        <p className="text-sm font-medium text-text-primary line-clamp-1">{winner.player_name}</p>
                        <p className="text-[10px] text-text-muted uppercase tracking-wider mt-1">{cat.label}</p>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-full bg-surface-hover mb-2" />
                        <p className="text-sm font-medium text-text-muted">Aguardando</p>
                        <p className="text-[10px] text-text-muted uppercase tracking-wider mt-1">{cat.label}</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Últimos Destaques Feed (Ao Vivo) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-[32px] border border-red/30 bg-white/60 dark:bg-[#050505]/60 backdrop-blur-2xl overflow-hidden flex flex-col shadow-neon-red max-h-[400px] lg:max-h-[500px]"
        >
          <div className="p-5 border-b border-red/30 flex items-center justify-between gap-2 bg-gray-100/80 dark:bg-[#111]/80 backdrop-blur-md relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-red/10 via-transparent to-transparent pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="relative flex items-center justify-center w-6 h-6">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red opacity-50 animate-ping"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red shadow-[0_0_10px_rgba(217,4,41,1)]"></span>
              </div>
              <h2 className="font-display text-xl tracking-[0.2em] text-neon-red font-bold">ÚLTIMOS DESTAQUES</h2>
            </div>
            <History size={18} className="text-red/80 relative z-10" />
          </div>
          <div className="p-3 overflow-y-auto custom-scrollbar flex-1 bg-gray-100 dark:bg-black/10 space-y-2">
            {dashboard?.recent_stars.map((star) => {
              const cat = CATEGORY_MAP[star.category];
              const isPromo = star.category === 'promotion';
              return (
                <div key={star.id} className={cn("flex gap-4 p-3 rounded-xl transition-all border", isPromo ? "bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/30" : "bg-surface-highlight/30 hover:bg-surface-highlight border-border/20")}>
                  <Avatar name={star.player_name} src={star.avatar_url || undefined} size="md" className={isPromo ? "ring-2 ring-yellow-400" : ""} />
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-sm text-text-primary leading-tight">
                      <span className={cn("font-bold", isPromo ? "text-yellow-400 text-base" : "text-red")}>{star.player_name}</span> 
                      <br className="sm:hidden" />
                      <span className="opacity-90 ml-1">
                        {isPromo ? 'conquistou 1 Grande Estrela 🌟' : `ganhou +${star.count} ${cat?.label || 'Estrela'} ⭐`}
                      </span>
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className={cn("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1", cat?.color || "bg-border text-text-muted")}>
                        <cat.icon size={10} />
                        {cat?.label || 'Estrela'}
                      </div>
                      <p className="text-[10px] text-text-muted font-medium">{new Date(star.created_at).toLocaleDateString('pt-BR')} às {new Date(star.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                  </div>
                </div>
              )
            })}
            {(!dashboard?.recent_stars || dashboard.recent_stars.length === 0) && (
              <div className="text-center py-8">
                <History size={32} className="text-text-muted/30 mx-auto mb-3" />
                <p className="text-text-muted text-sm font-medium">Nenhum destaque recente.</p>
                <p className="text-xs text-text-muted/50 mt-1">Os próximos eventos aparecerão aqui ao vivo.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Perfil CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Link
          to="/athlete/profile"
          className="flex items-center justify-between p-4 rounded-[24px] bg-gray-50/80 dark:bg-[#111]/60 backdrop-blur-xl border border-gray-200 dark:border-white/10 hover:border-red/50 hover:shadow-neon-red transition-all duration-300 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red/10 flex items-center justify-center text-red group-hover:scale-110 transition-transform">
              <Star size={18} />
            </div>
            <div>
              <p className="text-text-primary font-medium text-sm">Ver meu perfil completo</p>
              <p className="text-text-muted text-xs">Análise de Habilidades, evolução e histórico</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-text-muted group-hover:text-red transition-colors" />
        </Link>
      </motion.div>
    </div>
  );
}
