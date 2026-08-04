import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Trophy, Flame, Star, ChevronRight, TrendingUp, Medal, History, Crown, AlertTriangle, Swords, CalendarCheck, Info, Zap, Target, Share2 } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { PageLoading } from '@/components/ui/Loading';
import { ShareAchievementModal, type ShareModalProps } from '@/components/ui/ShareAchievementModal';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { PositionBadge } from '@/components/ui/Badges';
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

  // ── Estado do Modal de Compartilhamento
  const [shareModal, setShareModal] = useState<Omit<ShareModalProps, 'isOpen' | 'onClose'> | null>(null);

  const openShareModal = (props: Omit<ShareModalProps, 'isOpen' | 'onClose'>) => setShareModal(props);
  const closeShareModal = () => setShareModal(null);

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
    { label: 'Faltas Cons.', value: player?.consecutive_absences ?? 0, icon: AlertTriangle, color: 'text-red-400' },
  ];

  const playerStatus = player?.status ? STATUS_MAP[player.status] : null;

  // ── Checar se o atleta é o Fire Shark #1
  const fireSharkRankIndex = dashboard?.fire_sharks?.findIndex(p => p.id === player?.id) ?? -1;
  const isFireSharkRanked = fireSharkRankIndex !== -1;

  return (
    <div className="space-y-8 pb-10">
      {/* ── Modal de Compartilhamento (Global) ── */}
      {shareModal && (
        <ShareAchievementModal
          isOpen={true}
          onClose={closeShareModal}
          {...shareModal}
        />
      )}
      {/* ── Header de Boas-vindas (Estilo Premium E-Sports c/ Raios) ── */}
      <div className="relative group/header mb-4">
        {/* Glow dinâmico de fundo */}
        <div className="absolute -inset-[3px] bg-gradient-to-br from-red/80 via-purple-500/50 to-blue-500/80 rounded-[36px] opacity-60 group-hover/header:opacity-100 transition-all duration-700 blur-md pointer-events-none animate-pulse"></div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", type: "spring" }}
          className="relative overflow-hidden rounded-[32px] bg-[#050508] border-2 border-white/10 p-8 sm:p-10 shadow-2xl"
        >
          {/* Fundo Trovões e Raios (Background Animado / SVGs) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-red/30 blur-[80px] rounded-full mix-blend-screen animate-[pulse_3s_ease-in-out_infinite]" />
            <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-600/30 blur-[90px] rounded-full mix-blend-screen animate-[pulse_4s_ease-in-out_infinite]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
            
            {/* SVG Relâmpagos */}
            <svg className="absolute inset-0 w-full h-full opacity-30 group-hover/header:opacity-60 transition-opacity duration-700 scale-110" preserveAspectRatio="none" viewBox="0 0 1000 300" fill="none">
              <path d="M-50,50 L200,100 L150,150 L400,20 L350,120 L600,0 L500,200 L800,50 L750,250 L1050,-50" stroke="url(#paint0_linear)" strokeWidth="3" filter="url(#glow)"/>
              <path d="M-50,250 L200,150 L150,200 L400,50 L350,180 L600,250 L500,100 L800,200 L750,50 L1050,300" stroke="url(#paint1_linear)" strokeWidth="2" filter="url(#glow)"/>
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="paint0_linear" x1="0" y1="0" x2="1000" y2="300" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#ef4444" />
                  <stop offset="0.5" stopColor="#a855f7" />
                  <stop offset="1" stopColor="#3b82f6" />
                </linearGradient>
                <linearGradient id="paint1_linear" x1="1000" y1="0" x2="0" y2="300" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3b82f6" />
                  <stop offset="0.5" stopColor="#ef4444" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="relative z-10 flex flex-col xl:flex-row items-center xl:items-start gap-8 text-center xl:text-left">
            <div className="relative flex-shrink-0 flex items-center justify-center mb-4 xl:mb-0 group/avatar cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-tr from-red to-blue-500 rounded-full blur-xl opacity-40 group-hover/avatar:opacity-80 transition-opacity animate-spin-slow"></div>
              <Avatar
                name={player?.display_name || user?.name || ''}
                src={player?.avatar_url || undefined}
                size="xl"
                className={cn("relative ring-4 shadow-2xl z-10 w-28 h-28 sm:w-32 sm:h-32 transition-transform duration-500 group-hover/avatar:scale-105", isFireSharkRanked ? "ring-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.8)]" : "ring-white/20")}
              />
              {isFireSharkRanked && (
                <div className="absolute -bottom-4 bg-black/90 border border-orange-500 px-4 py-1 rounded-full text-orange-500 font-black text-[10px] tracking-[0.3em] z-20 shadow-[0_0_20px_rgba(249,115,22,0.6)] flex items-center gap-1.5 whitespace-nowrap">
                  <Flame size={14} className="animate-pulse" /> SHARK #{fireSharkRankIndex + 1}
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col justify-center h-full pt-2">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                <p className="text-white/70 text-xs sm:text-sm uppercase tracking-[0.3em] font-bold drop-shadow-md">{greeting()},</p>
                {playerStatus && (
                  <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-lg backdrop-blur-md bg-opacity-30", playerStatus.color)}>
                    {playerStatus.label}
                  </span>
                )}
              </div>
              <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 tracking-wider truncate drop-shadow-[0_2px_20px_rgba(255,255,255,0.3)] pb-2">
                {(player?.display_name || user?.name || '').toUpperCase()}
              </h1>
              
              {player?.shirt_number && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
                  <div className="bg-red/20 border border-red/40 px-5 py-2 rounded-xl flex items-center gap-2 backdrop-blur-md shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                    <span className="text-red-100 text-[10px] sm:text-xs uppercase tracking-widest font-medium">Camisa</span>
                    <span className="text-white font-display text-xl sm:text-2xl leading-none drop-shadow-[0_0_8px_rgba(220,38,38,0.8)]">#{player.shirt_number}</span>
                  </div>
                  {player?.main_position_display && (
                    <div className="flex items-center gap-1 bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/30 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                      <PositionBadge position={player.main_position} />
                    </div>
                  )}
                </div>
              )}
            {/* Faltas Consecutivas Alerta Crítico */}
            {player && player.consecutive_absences >= 8 && (
              <div className={cn("mt-5 flex items-start gap-3 p-3 rounded-xl max-w-lg border backdrop-blur-sm", 
                player.consecutive_absences >= 8 ? "bg-red/20 border-red/40 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-[pulse_2s_ease-in-out_infinite]" : "bg-orange-500/10 border-orange-500/30 text-orange-200"
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

      {stats && stats.total_matches < 10 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-center justify-between text-orange-200 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500/20 p-2 rounded-lg text-orange-400">
              <Flame size={20} className="animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-sm tracking-widest uppercase text-orange-400">Tubarão em Avaliação</p>
              <p className="text-xs text-orange-200/70 mt-0.5">Você tem {stats.total_matches} partida(s). Jogue no mínimo 10 para entrar no Ranking Fire Shark oficial!</p>
            </div>
          </div>
        </div>
      )}

      {/* ── FIRE SHARK RANKING (Top Win Rate) ── */}
      {dashboard?.fire_sharks && dashboard.fire_sharks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-[32px] overflow-hidden bg-[#050202] flex flex-col xl:flex-row gap-0 w-full max-w-full xl:max-w-6xl mx-auto border border-orange-500/30 neon-border"
        >
          <style>{`
            @keyframes fireParticle {
              0% { transform: translateY(0) scale(1); opacity: 0; }
              20% { opacity: 0.8; }
              80% { opacity: 0.4; }
              100% { transform: translateY(-120px) scale(0.2); opacity: 0; }
            }
            .fire-particle {
              position: absolute;
              bottom: 5%;
              width: 5px;
              height: 5px;
              background: #f97316;
              border-radius: 50%;
              box-shadow: 0 0 10px #f97316, 0 0 20px #ef4444;
              animation: fireParticle 2s infinite ease-in;
            }
            @keyframes pulseGlow {
              0%, 100% { box-shadow: 0 0 30px rgba(249,115,22,0.15); }
              50% { box-shadow: 0 0 60px rgba(249,115,22,0.5), inset 0 0 20px rgba(239,68,68,0.2); }
            }
            .neon-border {
              animation: pulseGlow 3s infinite;
            }
            @keyframes lightningFlash {
              0%, 92%, 96% { opacity: 0; }
              93%, 97% { opacity: 0.6; }
              100% { opacity: 0; }
            }
            .lightning {
              position: absolute;
              inset: 0;
              background: radial-gradient(circle at top right, rgba(59,130,246,0.3) 0%, transparent 50%);
              animation: lightningFlash 6s infinite;
              pointer-events: none;
            }
            .text-glow {
              text-shadow: 0 0 20px rgba(249,115,22,0.8), 0 0 40px rgba(239,68,68,0.6);
            }
          `}</style>

          {/* Header & 1st Place */}
          <div className="relative z-10 w-full xl:w-[45%] p-4 sm:p-6 pt-10 flex flex-col items-center border-b xl:border-b-0 xl:border-r border-orange-500/40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/40 via-[#050202] to-[#050202] overflow-hidden">
            <div className="lightning" />
            
            {/* Particles */}
            {Array.from({length: 15}).map((_, i) => (
               <div key={i} className="fire-particle" style={{ left: `${10 + Math.random() * 80}%`, animationDelay: `${Math.random() * 2}s`, animationDuration: `${1.5 + Math.random()}s` }} />
            ))}

            <div className="absolute top-0 left-0 bg-gradient-to-r from-red-700 to-red-600 text-white text-[9px] sm:text-[11px] font-black px-3 sm:px-4 py-1.5 shadow-[0_4px_15px_rgba(220,38,38,0.7)] tracking-widest uppercase" style={{ clipPath: 'polygon(0 0, 100% 0, 90% 100%, 0% 100%)' }}>
              Mín. 10 Partidas
            </div>

            {/* Botão especial Fire Shark — aparece se o atleta estiver no Top 10 */}
            {isFireSharkRanked && (
              <button
                onClick={() => {
                  const mySharkData = dashboard.fire_sharks[fireSharkRankIndex];
                  openShareModal({
                    type: 'fire_shark_top1',
                    athleteName: player?.display_name || user?.name || '',
                    shirtNumber: player?.shirt_number,
                    avatarUrl: player?.avatar_url || undefined,
                    avatarInitial: (player?.display_name || user?.name || 'A').charAt(0),
                    position: player?.main_position_display,
                    overall: player?.latest_overall,
                    winRate: mySharkData.win_rate,
                    wins: mySharkData.wins,
                    totalMatches: mySharkData.total_matches,
                    winRank: fireSharkRankIndex + 1,
                  });
                }}
                className="absolute top-2 right-2 sm:top-3 sm:right-3 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-orange-500/50 bg-black/40 hover:bg-black/60 text-gray-400 hover:text-orange-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all duration-300 group/share backdrop-blur-sm"
              >
                <Share2 size={12} className="group-hover/share:-rotate-12 transition-transform" />
                Compartilhar Rank
              </button>
            )}
            
            <img src="/fireshark.png" alt="Fire Shark" className="w-36 sm:w-48 h-auto object-contain drop-shadow-[0_0_35px_rgba(249,115,22,0.6)] animate-pulse" />
            
            <h2 className="font-display text-4xl sm:text-5xl tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-orange-500 to-red-600 font-black mt-2 uppercase filter drop-shadow-lg italic -skew-x-6 text-glow">
              FIRE SHARK
            </h2>
            <p className="text-[8px] sm:text-[10px] text-gray-400 tracking-[0.3em] font-bold uppercase mb-6 sm:mb-8">Ranking da Quadra</p>

            {dashboard.fire_sharks[0] && (
              <div className="flex w-full items-center justify-between gap-1 sm:gap-2">
                {/* Stats Left */}
                <div className="flex flex-col gap-4 sm:gap-6 w-[25%] items-center text-center">
                  <div className="flex flex-col items-center">
                    <Zap size={16} className="text-red-500 mb-1 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] sm:w-5 sm:h-5" />
                    <span className="text-[7px] sm:text-[9px] text-gray-300 tracking-widest font-bold uppercase mb-1">Vitórias</span>
                    <span className="text-red-500 font-display text-lg sm:text-2xl leading-none">{dashboard.fire_sharks[0].wins}/{dashboard.fire_sharks[0].total_matches}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Target size={16} className="text-gray-300 mb-1 sm:w-5 sm:h-5" />
                    <span className="text-[7px] sm:text-[9px] text-gray-300 tracking-widest font-bold uppercase mb-1">Aproveitamento</span>
                    <span className="text-orange-400 font-display text-lg sm:text-2xl leading-none">{dashboard.fire_sharks[0].win_rate}%</span>
                  </div>
                </div>

                {/* Center Avatar */}
                <div className="relative w-[50%] flex justify-center mt-2 sm:mt-0">
                  <div className="absolute inset-0 m-auto w-[130px] sm:w-[170px] h-[130px] sm:h-[170px] rounded-full animate-[spin_4s_linear_infinite]" style={{ background: 'conic-gradient(from 180deg, #3b82f6 0deg 180deg, #f97316 180deg 360deg)' }} />
                  <div className="absolute inset-0 m-auto w-[122px] sm:w-[160px] h-[122px] sm:h-[160px] rounded-full bg-[#050202]" />
                  
                  {/* Badge 1º Lugar Flutuante no Topo */}
                  <span className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 bg-black border border-yellow-500/50 px-4 py-1 rounded-full text-yellow-500 font-bold text-[8px] sm:text-[10px] tracking-[0.2em] z-30 shadow-[0_0_15px_rgba(234,179,8,0.4)] whitespace-nowrap flex items-center gap-1.5">
                    <Crown size={12} className="text-yellow-400" />
                    1º LUGAR
                  </span>

                  <div className="relative z-10 flex flex-col items-center w-[114px] sm:w-[150px] h-[114px] sm:h-[150px] rounded-full bg-[#111] border-[2px] sm:border-[3px] border-black shadow-inner justify-center overflow-hidden">
                    {dashboard.fire_sharks[0].avatar_url ? (
                      <img src={dashboard.fire_sharks[0].avatar_url} alt={dashboard.fire_sharks[0].name} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-display text-5xl sm:text-7xl z-10 drop-shadow-lg">{dashboard.fire_sharks[0].name.charAt(0).toUpperCase()}</span>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10 pointer-events-none" />
                  </div>

                  <div className="absolute -bottom-4 sm:-bottom-5 left-1/2 -translate-x-1/2 w-20 sm:w-28 h-12 sm:h-16 bg-gradient-to-b from-orange-500 to-red-900 flex flex-col items-center justify-center z-20 shadow-[0_0_20px_rgba(249,115,22,0.6)]" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
                    <div className="w-[94%] h-[90%] bg-black flex flex-col items-center justify-center" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
                       <span className="text-orange-400 font-display text-base sm:text-xl leading-none pt-1 sm:pt-2">{dashboard.fire_sharks[0].win_rate}%</span>
                       <span className="text-yellow-500/80 text-[6px] sm:text-[8px] font-bold tracking-widest leading-none mt-1">WIN RATE</span>
                    </div>
                  </div>
                </div>

                {/* Energy Meter Right */}
                <div className="flex flex-col items-center w-[25%] h-full justify-center">
                  <Zap size={16} className="text-yellow-500 mb-2 drop-shadow-[0_0_8px_rgba(234,179,8,1)] sm:w-5 sm:h-5" />
                  <div className="h-28 sm:h-36 w-4 sm:w-6 border-2 border-orange-500/30 rounded-sm p-0.5 flex flex-col justify-end gap-[2px] bg-black/50">
                     {Array.from({length: 12}).map((_, i) => (
                       <div key={i} className={cn("w-full h-full rounded-[1px]", i > 2 ? "bg-gradient-to-r from-orange-600 to-red-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" : "bg-white/5")} />
                     ))}
                  </div>
                  <span className="text-red-600 text-[9px] sm:text-xs font-display mt-2 tracking-widest drop-shadow-[0_0_5px_rgba(239,68,68,0.8)] italic">MAX</span>
                </div>
              </div>
            )}
            
            {dashboard.fire_sharks[0] && (
               <div className="mt-8 sm:mt-10 flex flex-col items-center w-full">
                  <h3 className="text-3xl sm:text-4xl font-display text-white drop-shadow-md truncate max-w-full px-2 sm:px-4">{dashboard.fire_sharks[0].name}</h3>
                  <div className="flex items-center gap-2 mt-1 sm:mt-2 w-full max-w-[240px] sm:max-w-[280px]">
                     <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-red-600" />
                     <p className="text-red-600 text-[8px] sm:text-[9px] tracking-[0.2em] font-bold uppercase whitespace-nowrap">
                        O TUBARÃO DA QUADRA
                     </p>
                     <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-red-600" />
                  </div>
                </div>
            )}
          </div>

          {/* List Rank 1-10 */}
          <div className="relative z-10 w-full xl:w-[55%] p-4 sm:p-6 pt-4 xl:pt-6 flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-2">
               <Flame size={16} className="text-red-600 animate-pulse" />
               <h3 className="text-xs font-bold text-gray-300 tracking-[0.1em] uppercase">TOP 10 - TUBARÕES DA QUADRA</h3>
            </div>
            
            {dashboard.fire_sharks.map((shark, idx) => {
              const isPlayer = player?.id === shark.id;
              return (
              <Link to={`/players/${shark.id}`} key={shark.id} className={cn(
                "flex items-center gap-2 sm:gap-4 p-2 sm:p-2.5 rounded-xl border transition-all duration-300 group relative overflow-hidden",
                isPlayer ? "bg-orange-900/20 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.15)]" : "bg-gradient-to-r from-white/[0.03] to-transparent border-white/5 hover:border-white/10"
              )}>
                {/* Hex Rank */}
                <div className="relative w-[50px] h-[55px] flex items-center justify-center flex-shrink-0" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
                   <div className={cn("absolute inset-0", 
                     idx === 0 ? "bg-gradient-to-br from-yellow-300 via-orange-500 to-red-600" :
                     idx === 1 ? "bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500" :
                     idx === 2 ? "bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900" :
                     "bg-gradient-to-br from-gray-700 to-gray-900"
                   )} />
                   <div className="absolute inset-[2px] bg-black flex items-center justify-center" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
                      <span className={cn("font-display text-2xl drop-shadow-md",
                         idx === 0 ? "text-yellow-500" :
                         idx === 1 ? "text-gray-300" :
                         idx === 2 ? "text-amber-600" :
                         "text-gray-500"
                      )}>{idx + 1}</span>
                   </div>
                </div>
                
                <Avatar name={shark.name} src={shark.avatar_url} size="md" className={cn("ring-2", isPlayer ? "ring-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" : "ring-white/5 group-hover:ring-white/20")} />
                
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className={cn("font-bold text-base truncate drop-shadow-sm", isPlayer ? "text-orange-400" : "text-white")}>{shark.name}</p>
                  <p className="text-[9px] text-gray-500 font-medium tracking-wider uppercase mt-0.5">{shark.wins} vitórias em {shark.total_matches} partidas</p>
                </div>
                
                <div className="flex flex-col items-end justify-center w-20 sm:w-24 md:w-32 flex-shrink-0">
                  <p className="text-orange-500 font-display text-lg sm:text-xl leading-none">{shark.win_rate}%</p>
                  <p className="text-[7px] sm:text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-1 mb-1.5">WIN RATE</p>
                  <div className="w-full h-[4px] sm:h-[6px] bg-[#0a0a0a] border border-white/10 rounded-full overflow-hidden relative">
                     <div className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 relative" style={{ width: `${shark.win_rate}%` }}>
                        <div className="absolute right-0 top-0 bottom-0 w-3 bg-blue-300 blur-[2px]" />
                     </div>
                  </div>
                </div>
              </Link>
            )})}
          </div>
        </motion.div>
      )}

      {/* ── Stats Pessoais Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            whileHover={{ scale: 1.05, y: -5 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="relative overflow-hidden rounded-[24px] bg-gray-50/80 dark:bg-[#111]/60 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-4 text-center hover:bg-white dark:hover:bg-black/80 hover:border-red/50 hover:shadow-neon-red transition-all duration-300 group cursor-pointer"
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
                <motion.div 
                  key={p.id} 
                  whileHover={{ scale: 1.02, x: 5 }}
                  className={cn("relative overflow-hidden flex items-center gap-4 p-3 rounded-2xl transition-all border cursor-pointer", bgClass, isTop3 ? "shadow-lg my-1" : "")}
                >
                  
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
                </motion.div>
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
                <motion.div 
                  key={p.id} 
                  whileHover={{ scale: 1.02, x: 5 }}
                  className={cn("relative overflow-hidden flex items-start gap-4 p-3 rounded-2xl transition-all border cursor-pointer", bgClass, isTop3 ? "shadow-lg my-1" : "")}
                >
                  
                  {/* Gráfico de Barra (Mini Stars / 15) no background */}
                  <div 
                    className={cn("absolute inset-y-0 left-0 z-0 opacity-10", isFirst ? "bg-yellow-500" : isSecond ? "bg-gray-400" : isThird ? "bg-amber-600" : "bg-blue-500")}
                    style={{ width: `${Math.min(((p.mini_stars || 0) / 15) * 100, 100)}%` }}
                  />

                  <div className="relative z-10 flex items-start gap-4 w-full">
                    <div className={cn("w-8 text-center font-display mt-1", isTop3 ? "text-2xl" : "text-lg text-text-muted")}>
                      {isFirst ? '👑' : isSecond ? '🥈' : isThird ? '🥉' : `${i + 1}º`}
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
                </motion.div>
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
              const isMyAchievement = player?.id === star.player_id;
              return (
                <div key={star.id} className={cn("flex gap-3 p-3 rounded-xl transition-all border", isPromo ? "bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/30" : "bg-surface-highlight/30 hover:bg-surface-highlight border-border/20")}>
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
                  {/* Botão de compartilhar — só nos achievements do atleta logado */}
                  {isMyAchievement && (
                    <button
                      onClick={() => openShareModal({
                        type: isPromo ? 'big_star' : 'mini_star',
                        athleteName: star.player_name,
                        avatarUrl: star.avatar_url || undefined,
                        avatarInitial: star.player_name.charAt(0),
                        shirtNumber: player?.shirt_number,
                        starCategory: star.category,
                        starCategoryLabel: cat?.label,
                        bigStarsTotal: player?.big_stars,
                        miniStarsCount: player?.mini_stars,
                      })}
                      className="flex-shrink-0 self-center w-7 h-7 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-all duration-200 group/si"
                      title="Compartilhar conquista"
                    >
                      <Share2 size={12} className="group-hover/si:rotate-12 transition-transform" />
                    </button>
                  )}
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
