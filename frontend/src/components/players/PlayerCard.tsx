import { memo } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Edit, Trash2, Activity, TrendingUp, Shield, Swords, AlertTriangle, Flame, Crosshair, Lock, Trophy } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { POSITION_LABELS } from '@/types';
import type { Player } from '@/types';
import { getOverallColor } from '@/lib/utils';

interface PlayerCardProps {
  player: Player;
  idx: number;
  canEdit: boolean;
  onDelete: (player: Player) => void;
  winRank?: number; // 1, 2, 3 ou 4
  fireSharkRank?: number; // 1, 2, 3 ou 4
}

export const PlayerCard = memo(function PlayerCard({ player, idx, canEdit, onDelete, winRank, fireSharkRank }: PlayerCardProps) {
  const navigate = useNavigate();

  const isInactive = player.status === 'inactive' || player.status === 'suspended';
  const hasAbsenceRisk = player.consecutive_absences >= 8 && player.status === 'active';

  const borderColors = player.latest_overall
    ? (
      player.latest_overall >= 8.5 ? ['#fca5a5', '#dc2626', '#fca5a5', '#991b1b', '#fca5a5'] :
        player.latest_overall >= 7.5 ? ['#93c5fd', '#2563eb', '#93c5fd', '#1e3a8a', '#93c5fd'] :
          player.latest_overall >= 6.5 ? ['#86efac', '#16a34a', '#86efac', '#14532d', '#86efac'] :
            player.latest_overall >= 5.5 ? ['#fef08a', '#ca8a04', '#fef08a', '#854d0e', '#fef08a'] :
              ['#e4e4e7', '#71717a', '#e4e4e7', '#3f3f46', '#e4e4e7']
    )
    : ['#fef08a', '#ca8a04', '#fef08a', '#854d0e', '#fef08a'];

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
      className={`relative w-full max-w-[240px] mx-auto group ${isInactive ? 'opacity-60 grayscale-[0.8]' : ''} mb-6 md:mb-6`}
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

      <Link to={`/players/${player.id}`} className="block w-full outline-none">

        {/* Container Principal do Card - Construído 100% em CSS puro */}
        <div
          className="w-full aspect-[5/7] relative flex flex-col items-center justify-start group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(234,179,8,0.4)] transition-all duration-300 bg-zinc-950"
          style={{ clipPath: cardClipPath }}
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

          {/* BORDA DOURADA (SVG perfeitamente alinhado com o escudo) */}
          <svg viewBox="0 0 100 140" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none z-40">
            <polygon
              points="10,1 90,1 99,15 99,119 50,139 1,119 1,15"
              fill="none"
              stroke={`url(#border-${player.id})`}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {/* Efeito de brilho metálico no centro superior */}
            <polygon
              points="10,0 90,0 100,15 100,120 50,140 0,120 0,15"
              fill="none"
              stroke="url(#gold-highlight)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              className="opacity-50"
            />
            <defs>
              <linearGradient id={`border-${player.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={borderColors[0]} />
                <stop offset="20%" stopColor={borderColors[1]} />
                <stop offset="50%" stopColor={borderColors[2]} />
                <stop offset="80%" stopColor={borderColors[3]} />
                <stop offset="100%" stopColor={borderColors[4]} />
              </linearGradient>
              <linearGradient id="gold-highlight" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                <stop offset="20%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>
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

          {/* Top Right: Status */}
          <div className="absolute top-[8%] right-[12%] flex flex-col items-center gap-2 z-20">
            {player.status === 'active' ? (
              <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] border border-white/40" title="Ativo" />
            ) : player.status === 'injured' ? (
              <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)] border border-white/40" title="Lesionado" />
            ) : (
              <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-zinc-600 shadow-[0_0_8px_rgba(82,82,91,0.8)] border border-white/40" title="Inativo/Suspenso" />
            )}
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
          <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[70%] flex flex-wrap justify-center items-center gap-1 z-30 pointer-events-none">
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
          <div className="absolute bottom-[12%] inset-x-0 flex flex-col items-center z-30 px-3">

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

            {/* Linha divisória fina dourada */}
            <div className="w-3/4 h-[1px] bg-gradient-to-r from-transparent via-yellow-500 to-transparent mb-1 opacity-80" />

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
      </Link>

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
          <button
            onClick={(e) => { e.preventDefault(); onDelete(player); }}
            className="p-2 sm:p-2.5 rounded-full bg-red-600/95 text-white shadow-[0_4px_12px_rgba(0,0,0,0.8)] border border-red-500 hover:bg-red-500 pointer-events-auto hover:scale-110 transition-transform"
            title="Deletar Jogador"
          >
            <Trash2 size={14} className="sm:w-4 sm:h-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
});
