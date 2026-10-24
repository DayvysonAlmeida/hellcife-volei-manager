import { memo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Edit, Trash2, Activity, Shield, Swords, AlertTriangle, Flame, Crosshair, Lock, Trophy } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { POSITION_LABELS } from '@/types';
import type { Player } from '@/types';
import { getOverallColor } from '@/lib/utils';

function CardWrapper({ linkTo, children }: { linkTo: string | null; children: ReactNode }) {
  if (!linkTo) return <div className="block w-full">{children}</div>;
  return <Link to={linkTo} className="block w-full outline-none">{children}</Link>;
}

interface PlayerCardProps {
  player: Player;
  idx: number;
  canEdit: boolean;
  /** Botão de excluir (só o admin exclui atleta). Sem informar, segue o canEdit. */
  canDelete?: boolean;
  onDelete: (player: Player) => void;
  winRank?: number; // 1, 2, 3 ou 4
  fireSharkRank?: number; // 1, 2, 3 ou 4
  /** O card abre a tela do jogador (só existe no admin). false no portal do atleta e nos exemplos. */
  linkable?: boolean;
}

export const PlayerCard = memo(function PlayerCard({ player, idx, canEdit, canDelete = canEdit, onDelete, winRank, fireSharkRank, linkable = true }: PlayerCardProps) {
  const navigate = useNavigate();

  const isInactive = player.status === 'inactive' || player.status === 'suspended';
  const hasAbsenceRisk = player.consecutive_absences >= 8 && player.status === 'active';

  // ── Elo Tier → Estilo LoL ──────────────────────────────────────────────────
  const eloTierStyles: Record<string, {
    colors: string[];
    glow: string;
    icon: string;
    name: string;
    textColor: string;
    pulse: boolean;
  }> = {
    // Até 10 partidas na temporada ainda não há faixa
    calibrating: {
      colors: ['#475569', '#334155', '#475569', '#1E293B', '#475569'],
      glow: 'none',
      icon: '⏳',
      name: 'Calibrando',
      textColor: '#94A3B8',
      pulse: false,
    },
    rookie:  {
      colors: ['#6B7280', '#4B5563', '#6B7280', '#374151', '#6B7280'],
      glow: 'none',
      icon: '🪨',
      name: 'Iniciante',
      textColor: '#9CA3AF',
      pulse: false,
    },
    bronze:  {
      colors: ['#CD7C2F', '#7C3A0A', '#E8A060', '#92400E', '#CD7C2F'],
      glow: 'drop-shadow(0 0 6px rgba(205,124,47,0.7))',
      icon: '🥉',
      name: 'Bronze',
      textColor: '#CD7C2F',
      pulse: false,
    },
    silver:  {
      colors: ['#CBD5E1', '#64748B', '#E2E8F0', '#475569', '#CBD5E1'],
      glow: 'drop-shadow(0 0 8px rgba(203,213,225,0.6))',
      icon: '🥈',
      name: 'Prata',
      textColor: '#CBD5E1',
      pulse: false,
    },
    gold:    {
      colors: ['#FDE68A', '#D97706', '#FCD34D', '#B45309', '#FDE68A'],
      glow: 'drop-shadow(0 0 10px rgba(234,179,8,0.85))',
      icon: '🥇',
      name: 'Ouro',
      textColor: '#FDE68A',
      pulse: false,
    },
    diamond: {
      colors: ['#67E8F9', '#0891B2', '#A5F3FC', '#0E7490', '#67E8F9'],
      glow: 'drop-shadow(0 0 12px rgba(6,182,212,0.9))',
      icon: '💎',
      name: 'Diamante',
      textColor: '#67E8F9',
      pulse: true,
    },
    elite:   {
      colors: ['#E879F9', '#7C3AED', '#F0ABFC', '#9333EA', '#E879F9'],
      glow: 'drop-shadow(0 0 16px rgba(147,51,234,1))',
      icon: '🔮',
      name: 'Elite',
      textColor: '#E879F9',
      pulse: true,
    },
    challenger: {
      colors: ['#EF4444', '#991B1B', '#FCA5A5', '#7F1D1D', '#EF4444'],
      glow: 'drop-shadow(0 0 20px rgba(239,68,68,1))',
      icon: '👑',
      name: 'Desafiante',
      textColor: '#EF4444',
      pulse: true,
    },
  };

  const eloTier = player.elo_tier || 'rookie';
  const eloStyle = eloTierStyles[eloTier as keyof typeof eloTierStyles] || eloTierStyles.rookie;
  const borderColors = eloStyle.colors;
  
  const TIER_LEVELS = {
    rookie: 0,
    bronze: 1,
    silver: 2,
    gold: 3,
    diamond: 4,
    elite: 5,
    challenger: 6
  };
  const tierLevel = TIER_LEVELS[eloTier as keyof typeof TIER_LEVELS] || 0;

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'libero': return 'text-cyan-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]';
      case 'setter': return 'text-purple-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]';
      case 'opposite': return 'text-red-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]';
      case 'outside': return 'text-green-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]';
      case 'middle': return 'text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]';
      case 'universal': return 'text-orange-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]';
      default: return 'text-white';
    }
  };

  // Formato exato do escudo do card
  const cardClipPath = 'polygon(10% 0, 90% 0, 100% 10.7%, 100% 85.7%, 50% 100%, 0 85.7%, 0 10.7%)';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: idx * 0.03 }}
      className={`relative w-full max-w-[240px] mx-auto group ${isInactive ? 'opacity-60 grayscale-[0.8]' : ''} px-2 pb-6 mb-4 md:mb-6`}
    >
      {/* Área Flutuante Superior (Sempre para cima do Card) */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-20 w-max pointer-events-none mb-1.5">
        {/* Alertas Externos (Convidado / Risco de Faltas) */}
        {(player.is_guest || hasAbsenceRisk) && (
          <div className="flex items-center gap-1">
            {player.is_guest && (
              <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded shadow-md uppercase font-bold tracking-wider max-w-[120px] truncate text-center">
                Convidado {player.invited_by ? `por: ${player.invited_by}` : ''}
              </span>
            )}
            {hasAbsenceRisk && (
              <span className="text-[9px] bg-orange-600 text-white px-2 py-0.5 rounded shadow-md uppercase font-bold flex items-center gap-1 animate-pulse" title={`${player.consecutive_absences} faltas seguidas`}>
                <AlertTriangle size={10} /> Risco
              </span>
            )}
          </div>
        )}
      </div>

      {/* Selo Win Streak removido do ombro */}

      <CardWrapper linkTo={linkable ? `/players/${player.id}` : null}>

        {/* Container Principal do Card */}
        <div
          className="w-full aspect-[5/7] relative flex flex-col items-center justify-start group-hover:-translate-y-2 transition-all duration-300 bg-zinc-950"
          style={{
            clipPath: cardClipPath,
            filter: eloStyle.glow,
            transition: 'filter 0.3s ease, transform 0.3s ease',
          }}
        >
          {/* BACKGROUND NEON ANIMADO / ESTILIZADO (CSS puro) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden bg-gradient-to-b from-zinc-900 to-black z-0">
            {/* Feixe de luz azul (Esquerda para cima) */}
            <div className="absolute top-[20%] -left-[50%] w-[200%] h-16 bg-blue-600/30 rotate-[-25deg] blur-2xl" />
            <div className="absolute top-[30%] -left-[30%] w-[150%] h-8 bg-blue-400/20 rotate-[-25deg] blur-xl" />

            {/* Feixe de luz vermelho (Direita para baixo) */}
            <div className="absolute bottom-[20%] -right-[50%] w-[200%] h-16 bg-red-600/30 rotate-[-25deg] blur-2xl" />
            <div className="absolute bottom-[30%] -right-[30%] w-[150%] h-8 bg-red-400/20 rotate-[-25deg] blur-xl" />

            {/* Brilho radial no centro (fundo) */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.2)_0%,transparent_60%)]" />

            {/* Partículas sutis simuladas com grid ou padrão (Opcional, dá uma textura) */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50 mix-blend-overlay" />
          </div>

          {/* PREMIUM ELO SVG BORDER (Construída do zero, sem imagens externas) */}
          <svg viewBox="0 0 100 140" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none z-40 overflow-visible" style={{ filter: eloStyle.glow }}>
            <defs>
              <linearGradient id={`border-${player.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={borderColors[0]} />
                <stop offset="20%" stopColor={borderColors[1]} />
                <stop offset="50%" stopColor={borderColors[2]} />
                <stop offset="80%" stopColor={borderColors[3]} />
                <stop offset="100%" stopColor={borderColors[4]} />
              </linearGradient>
              <linearGradient id="gold-highlight" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="15%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Fundo do brilho externo - mais forte em tiers altos */}
            <polygon
              points="10,0 90,0 100,15 100,120 50,140 0,120 0,15"
              fill="none"
              stroke={`url(#border-${player.id})`}
              strokeWidth={tierLevel >= 5 ? "8" : tierLevel >= 3 ? "5" : "3"}
              vectorEffect="non-scaling-stroke"
              className={`opacity-50 blur-[${tierLevel >= 5 ? '6' : '4'}px]`}
            />

            {/* Linha Principal da Borda */}
            <polygon
              points="10,0 90,0 100,15 100,120 50,140 0,120 0,15"
              fill="none"
              stroke={`url(#border-${player.id})`}
              strokeWidth={tierLevel >= 5 ? "2.5" : "2"}
              vectorEffect="non-scaling-stroke"
            />

            {/* Reflexo Metálico Interno */}
            <polygon
              points="10.5,1 89.5,1 99,15.5 99,119 50,138 1,119 1,15.5"
              fill="none"
              stroke="url(#gold-highlight)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              className="opacity-80 mix-blend-overlay"
            />

            {/* Adornos Premium no Rodapé (Asas e Diamante evolutivos) */}
            <g transform="translate(50, 139)">
              {/* Diamante Central (Apenas de Silver pra cima) */}
              {tierLevel >= 2 && (
                <>
                  <polygon points={tierLevel >= 5 ? "0,-10 6,0 0,8 -6,0" : "0,-8 5,0 0,6 -5,0"} fill={borderColors[0]} stroke="#fff" strokeWidth="0.5" vectorEffect="non-scaling-stroke" className="drop-shadow-md" />
                  <polygon points={tierLevel >= 5 ? "0,-5 3,0 0,4 -3,0" : "0,-4 2.5,0 0,3 -2.5,0"} fill="#fff" opacity="0.6" />
                </>
              )}

              {/* Asas */}
              {tierLevel >= 1 && (
                <>
                  {/* Asa 1 (Base - Bronze+) */}
                  <polygon points="-5,-1 -35,-15 -25,-18 -5,-4" fill={`url(#border-${player.id})`} stroke="#fff" strokeWidth="0.5" strokeOpacity="0.4" vectorEffect="non-scaling-stroke" />
                  <polygon points="5,-1 35,-15 25,-18 5,-4" fill={`url(#border-${player.id})`} stroke="#fff" strokeWidth="0.5" strokeOpacity="0.4" vectorEffect="non-scaling-stroke" />
                </>
              )}
              {tierLevel >= 3 && (
                <>
                  {/* Asa 2 (Média - Gold+) */}
                  <polygon points="-12,-4 -40,-20 -32,-22 -12,-7" fill={borderColors[2]} opacity="0.9" />
                  <polygon points="12,-4 40,-20 32,-22 12,-7" fill={borderColors[2]} opacity="0.9" />
                </>
              )}
              {tierLevel >= 5 && (
                <>
                  {/* Asa 3 (Elite+) */}
                  <polygon points="-18,-7 -45,-25 -38,-27 -18,-10" fill={borderColors[4]} opacity="0.7" />
                  <polygon points="18,-7 45,-25 38,-27 18,-10" fill={borderColors[4]} opacity="0.7" />
                </>
              )}
              {tierLevel === 6 && (
                <>
                  {/* Asa 4 Suprema (Apenas Challenger) */}
                  <polygon points="-24,-10 -50,-30 -43,-32 -24,-13" fill={borderColors[1]} opacity="0.8" />
                  <polygon points="24,-10 50,-30 43,-32 24,-13" fill={borderColors[1]} opacity="0.8" />
                </>
              )}

              {/* Estrelinhas flutuantes simulando energia (Diamond+) */}
              {tierLevel >= 4 && (
                <>
                  <circle cx="0" cy="-14" r="0.8" fill="#fff" className="animate-pulse" />
                  <circle cx="-6" cy="-10" r="0.5" fill="#fff" className="animate-pulse delay-75" />
                  <circle cx="6" cy="-10" r="0.5" fill="#fff" className="animate-pulse delay-150" />
                </>
              )}
              {tierLevel === 6 && (
                <>
                  {/* Aura Extra Challenger */}
                  <circle cx="-12" cy="-15" r="0.6" fill="#fff" className="animate-pulse delay-200" />
                  <circle cx="12" cy="-15" r="0.6" fill="#fff" className="animate-pulse delay-300" />
                  <circle cx="0" cy="-20" r="1.2" fill={borderColors[2]} className="animate-pulse opacity-80" />
                </>
              )}
            </g>

            {/* Adornos Premium no Topo (Garras evolutivas) */}
            {tierLevel >= 4 && (
              <g>
                <polyline points="0,25 0,15 10,0 20,0" fill="none" stroke={borderColors[0]} strokeWidth={tierLevel >= 5 ? "4" : "3"} vectorEffect="non-scaling-stroke" />
                <polyline points="100,25 100,15 90,0 80,0" fill="none" stroke={borderColors[0]} strokeWidth={tierLevel >= 5 ? "4" : "3"} vectorEffect="non-scaling-stroke" />
              </g>
            )}
            {tierLevel >= 5 && (
              <g>
                {/* Garras internas Elite+ */}
                <polyline points="0,35 0,25 5,15" fill="none" stroke={borderColors[2]} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <polyline points="100,35 100,25 95,15" fill="none" stroke={borderColors[2]} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </g>
            )}
            {tierLevel === 6 && (
              <g>
                {/* Coroa Divina Challenger */}
                <polygon points="40,0 45,-6 50,0 55,-6 60,0" fill="none" stroke={borderColors[0]} strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="opacity-80 drop-shadow-md" />
                <circle cx="45" cy="-8" r="1.5" fill="#fff" className="animate-pulse" />
                <circle cx="55" cy="-8" r="1.5" fill="#fff" className="animate-pulse delay-75" />
                <circle cx="50" cy="-4" r="1" fill={borderColors[2]} />
              </g>
            )}
          </svg>

          {/* Efeito de flash ao passar o mouse */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 group-hover:translate-x-full transition-all duration-700 pointer-events-none -translate-x-full skew-x-12 z-50" />

          {/* DADOS DO CARTÃO (Tudo acima dos backgrounds z-10+) */}

          {/* Top Left: Overall & Position */}
          <div className="absolute top-[8%] left-[10%] flex flex-col items-center z-20 w-12 sm:w-14">
            <span
              className="font-display text-3xl sm:text-4xl font-black leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
              style={{ color: player.latest_overall ? getOverallColor(player.latest_overall) : '#facc15' }} // Dourado padrão se não tiver
            >
              {player.latest_overall ? player.latest_overall.toFixed(1) : '-'}
            </span>
            <span className={`font-bold text-[10px] sm:text-xs uppercase tracking-widest mt-0.5 w-full text-center ${getPositionColor(player.main_position)}`}>
              {POSITION_LABELS[player.main_position]?.substring(0, 3)}
            </span>
          </div>

          {/* Top Right: Status + Tier */}
          <div className="absolute top-[8%] right-[8%] flex flex-col items-center gap-1 z-20">
            {/* Status dot */}
            {player.status === 'active' ? (
              <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] border border-white/40" title="Ativo" />
            ) : player.status === 'injured' ? (
              <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)] border border-white/40" title="Lesionado" />
            ) : (
              <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-zinc-600 shadow-[0_0_8px_rgba(82,82,91,0.8)] border border-white/40" title="Inativo/Suspenso" />
            )}
            {/* Ícone do Tier */}
            <span
              className={`text-[11px] sm:text-[13px] leading-none select-none drop-shadow-[0_0_6px_currentColor] ${eloStyle.pulse ? 'animate-pulse' : ''}`}
              title={eloStyle.name}
            >
              {eloStyle.icon}
            </span>
            {/* Nome do Tier */}
            <span
              className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest leading-none drop-shadow-[0_0_6px_currentColor]"
              style={{
                color: eloStyle.textColor,
                textShadow: `0 0 8px ${eloStyle.textColor}`,
              }}
            >
              {eloStyle.name}
            </span>
          </div>

          {/* Top Mini Stars Row (Yu-Gi-Oh Style) */}
          <div className="absolute top-[3%] inset-x-0 px-[10%] flex flex-wrap justify-center gap-[2px] z-20 pointer-events-none" title={`${player.mini_stars || 0}/15 Estrelas`}>
            {Array.from({ length: 15 }).map((_, idx) => {
              const isLit = idx < (player.mini_stars || 0);
              return (
                <Star
                  key={`star-${idx}`}
                  size={9}
                  className={isLit
                    ? 'fill-yellow-400 text-yellow-200 drop-shadow-[0_0_3px_rgba(250,204,21,0.8)]'
                    : 'fill-black/40 text-white/10'
                  }
                />
              );
            })}
          </div>

          {/* Badges de Topo (Win Streak + Top Ranks) */}
          {/* Entre o overall (esquerda) e a faixa (direita): estreito para quebrar linha em vez de sobrepor */}
          <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[46%] flex flex-wrap justify-center items-center gap-1 z-30 pointer-events-none">
            {(player.stats?.win_streak ?? 0) >= 2 && (
              <div className="flex items-center gap-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-pulse" title={`${player.stats?.win_streak} vitórias consecutivas`}>
                <span className="text-sm font-black text-white">{player.stats?.win_streak}</span>
                <Flame size={18} className="text-yellow-300 fill-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
              </div>
            )}
            {winRank && winRank <= 4 && (
              <div className="flex items-center justify-center gap-0.5 px-1.5 h-4 sm:h-5 rounded-full bg-gradient-to-tr from-yellow-500 to-yellow-200 border border-yellow-600 shadow-md" title={`Top ${winRank} Vitórias`}>
                <span className="text-[8px] sm:text-[9px] font-black text-black">🏆{winRank}</span>
              </div>
            )}
            {fireSharkRank && fireSharkRank <= 4 && (
              <div className="flex items-center justify-center gap-0.5 px-1.5 h-4 sm:h-5 rounded-full bg-gradient-to-tr from-red-600 to-orange-500 border border-red-700 shadow-md" title={`Top ${fireSharkRank} Fire Shark`}>
                <span className="text-[9px] sm:text-[10px] leading-none">🦈</span>
                <span className="text-[8px] sm:text-[9px] font-black text-white">{fireSharkRank}</span>
              </div>
            )}
          </div>

          {/* Avatar Area */}
          <div className="absolute inset-x-0 top-[10%] bottom-[35%] flex justify-center items-center z-10 pointer-events-none">

            {player.avatar_url ? (
              <>
                {player.avatar_url.toLowerCase().includes('.png') || player.avatar_url.toLowerCase().includes('.webp') || (player.avatar_url.toLowerCase().includes('cloudinary') && !player.avatar_url.toLowerCase().includes('.jpg') && !player.avatar_url.toLowerCase().includes('.jpeg')) ? (
                  <img
                    src={player.avatar_url}
                    alt={player.name}
                    loading="lazy"
                    className="pointer-events-auto h-[120%] w-[120%] object-contain object-bottom drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] scale-125"
                  />
                ) : (
                  // Máscara perfeita para fotos em JPG não se deformarem (sempre círculo no meio do card)
                  <img
                    src={player.avatar_url}
                    alt={player.name}
                    loading="lazy"
                    className="pointer-events-auto h-[95%] aspect-square object-cover object-top rounded-full border-[3px] shadow-[0_10px_20px_rgba(0,0,0,0.8)] mt-2"
                    style={{ borderColor: borderColors[1] }}
                  />
                )}
                {/* Degradê na base da foto para misturar a cintura do atleta ao fundo escuro */}
                <div className="absolute bottom-0 inset-x-0 h-[40%] bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent z-10" />
              </>
            ) : (
              <div className="h-[75%] aspect-square rounded-full border-2 border-yellow-500/30 shadow-xl overflow-hidden flex items-center justify-center bg-black/40 pointer-events-auto mt-4">
                <Avatar name={player.display_name} size="xl" className="w-full h-full text-4xl sm:text-5xl opacity-80" />
              </div>
            )}
          </div>

          {/* Área de Dados Base */}
          <div className="absolute bottom-[16%] inset-x-0 flex flex-col items-center z-30 px-3">

            {/* Name & Shirt Number */}
            <div className="relative w-full mb-1 flex items-end justify-center">
              {player.shirt_number && (
                <div className="absolute left-1 bottom-0.5 pointer-events-none z-20" title={`Camisa ${player.shirt_number}`}>
                  <span className="text-white/70 font-display font-black text-lg sm:text-2xl tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                    {player.shirt_number}
                  </span>
                </div>
              )}

              <h3 className="font-display text-base sm:text-xl font-black uppercase tracking-wider text-yellow-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate z-10 px-4 sm:px-6 w-full text-center">
                {player.display_name}
              </h3>
            </div>

            {/* Linha divisória fina — cor do tier */}
            <div
              className="w-3/4 h-[1px] mb-1 opacity-90"
              style={{
                background: `linear-gradient(90deg, transparent, ${borderColors[1]}, transparent)`,
              }}
            />

            {/* Estrelas em Destaque (Mini e Grandes) */}
            <div className="flex flex-col items-center justify-center w-full max-w-[180px] mb-1 drop-shadow-md">

              {/* Estrelas Grandes (Grandes Conquistas) em total destaque */}
              {player.big_stars > 0 && (
                <div className="flex gap-1 mb-1 items-center bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/30">
                  {Array.from({ length: Math.min(player.big_stars, 5) }).map((_, i) => (
                    <Star key={`big-${i}`} size={20} className="fill-yellow-400 text-yellow-200 drop-shadow-[0_0_12px_rgba(250,204,21,1)] animate-pulse" />
                  ))}
                  {player.big_stars > 5 && <span className="text-yellow-400 text-sm font-black ml-1">+{player.big_stars - 5}</span>}
                </div>
              )}

              {/* Mini Estrelas Separadas por Categoria */}
              {(player.attack_stars > 0 || player.defense_stars > 0 || player.mvp_stars > 0 || player.setter_stars > 0 || player.pass_stars > 0 || player.block_stars > 0) && (
                <div className="flex flex-nowrap justify-center gap-1 sm:gap-1.5 w-full bg-black/40 rounded-lg py-1 px-1 sm:px-2 border border-white/10 shadow-inner overflow-hidden">
                  {player.mvp_stars > 0 && (
                    <div className="flex items-center gap-0.5 sm:gap-1 text-yellow-400" title={`${player.mvp_stars} Estrelas MVP`}>
                      <Star className="fill-yellow-400 w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span className="text-[9px] sm:text-[11px] font-black">{player.mvp_stars}</span>
                    </div>
                  )}
                  {player.attack_stars > 0 && (
                    <div className="flex items-center gap-0.5 sm:gap-1 text-red-400" title={`${player.attack_stars} Estrelas de Ataque`}>
                      <Swords className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span className="text-[9px] sm:text-[11px] font-black">{player.attack_stars}</span>
                    </div>
                  )}
                  {player.defense_stars > 0 && (
                    <div className="flex items-center gap-0.5 sm:gap-1 text-blue-400" title={`${player.defense_stars} Estrelas de Defesa`}>
                      <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span className="text-[9px] sm:text-[11px] font-black">{player.defense_stars}</span>
                    </div>
                  )}
                  {player.setter_stars > 0 && (
                    <div className="flex items-center gap-0.5 sm:gap-1 text-orange-400" title={`${player.setter_stars} Estrelas de Levantador`}>
                      <Crosshair className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span className="text-[9px] sm:text-[11px] font-black">{player.setter_stars}</span>
                    </div>
                  )}
                  {player.pass_stars > 0 && (
                    <div className="flex items-center gap-0.5 sm:gap-1 text-green-400" title={`${player.pass_stars} Estrelas de Passe`}>
                      <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span className="text-[9px] sm:text-[11px] font-black">{player.pass_stars}</span>
                    </div>
                  )}
                  {player.block_stars > 0 && (
                    <div className="flex items-center gap-0.5 sm:gap-1 text-purple-400" title={`${player.block_stars} Estrelas de Bloqueio`}>
                      <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span className="text-[9px] sm:text-[11px] font-black">{player.block_stars}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Base Stats Panel */}
            {player.stats && ((player.stats.matches || 0) > 0 || (player.stats.total_matches || 0) > 0 || (player.stats.win_rate || 0) > 0) && (
              <div className="flex items-center justify-center divide-x divide-white/20 w-full max-w-[90%] bg-black/60 backdrop-blur-md border border-white/10 rounded overflow-hidden mt-1.5 pointer-events-auto shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                
                {((player.stats.matches || 0) > 0 || (player.stats.total_matches || 0) > 0) && (
                  <div title="Partidas Jogadas" className="flex flex-col items-center flex-1 py-1 px-1 hover:bg-white/10 transition-colors cursor-help">
                    <span className="text-[6px] sm:text-[7px] text-white/60 font-medium uppercase tracking-widest leading-none mb-0.5">Partidas</span>
                    <span className="text-[10px] sm:text-xs font-display font-black text-blue-400 leading-none drop-shadow-sm">{player.stats.matches || player.stats.total_matches}</span>
                  </div>
                )}
                
                {(player.stats.wins || 0) > 0 && (
                  <div title="Vitórias" className="flex flex-col items-center flex-1 py-1 px-1 hover:bg-white/10 transition-colors cursor-help bg-gradient-to-t from-yellow-500/10 to-transparent">
                    <span className="text-[6px] sm:text-[7px] text-yellow-500/80 font-medium uppercase tracking-widest leading-none mb-0.5 flex items-center gap-0.5"><Trophy size={6} /> Vitórias</span>
                    <span className="text-[10px] sm:text-xs font-display font-black text-yellow-400 leading-none drop-shadow-sm">{player.stats.wins}</span>
                  </div>
                )}
                
                {(player.stats.win_rate || 0) > 0 && (
                  <div title="Win Rate" className="flex flex-col items-center flex-1 py-1 px-1 hover:bg-white/10 transition-colors cursor-help">
                    <span className="text-[6px] sm:text-[7px] text-white/60 font-medium uppercase tracking-widest leading-none mb-0.5">Win Rate</span>
                    <span className="text-[10px] sm:text-xs font-display font-black text-green-400 leading-none drop-shadow-sm">{player.stats.win_rate}%</span>
                  </div>
                )}
                
              </div>
            )}

          </div>
        </div>
        
        {/* A borda e os adornos agora são renderizados 100% via SVG Premium acima, removendo a gambiarra da imagem PNG */}
      </CardWrapper>

      {/* Admin Actions Overlay (External bottom) - Hidden on Mobile */}
      {canEdit && (
        <div className="hidden absolute -bottom-2 md:-bottom-4 left-1/2 -translate-x-1/2 opacity-0 md:group-hover:opacity-100 transition-all duration-300 z-30 md:flex flex-row gap-3 pointer-events-none md:translate-y-2 md:group-hover:translate-y-0">
          <button
            onClick={(e) => { e.preventDefault(); navigate(`/players/${player.id}/edit`); }}
            className="p-2 sm:p-2.5 rounded-full bg-zinc-900 text-yellow-500 shadow-[0_4px_12px_rgba(0,0,0,0.8)] border border-yellow-500/50 hover:bg-zinc-800 pointer-events-auto hover:scale-110 transition-transform"
            title="Editar Jogador"
          >
            <Edit size={14} className="sm:w-4 sm:h-4" />
          </button>
          {canDelete && <button
            onClick={(e) => { e.preventDefault(); onDelete(player); }}
            className="p-2 sm:p-2.5 rounded-full bg-red-600/95 text-white shadow-[0_4px_12px_rgba(0,0,0,0.8)] border border-red-500 hover:bg-red-500 pointer-events-auto hover:scale-110 transition-transform"
            title="Deletar Jogador"
          >
            <Trash2 size={14} className="sm:w-4 sm:h-4" />
          </button>}
        </div>
      )}
    </motion.div>
  );
});
