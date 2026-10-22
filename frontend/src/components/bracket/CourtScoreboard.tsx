import { Star } from 'lucide-react';
import type { CourtTeam } from '@/types';

interface CourtScoreboardProps {
  team: CourtTeam | null;
  score: number;
  consecutive: number;
  isReversed?: boolean;
  onUpdateScore: (delta: number) => void;
  /** Outro celular está marcando: os botões ficam travados (só acompanha). */
  disabled?: boolean;
}

export function CourtScoreboard({ team, score, consecutive, isReversed, onUpdateScore, disabled }: CourtScoreboardProps) {
  if (!team) {
    return (
      <div className="flex-1 card flex flex-col overflow-hidden relative justify-center items-center opacity-50 border-dashed">
        <span className="text-text-muted font-bold tracking-widest uppercase">Aguardando Time</span>
      </div>
    );
  }

  return (
    <div className="flex-1 card flex flex-col overflow-hidden relative" style={{ borderColor: `${team.color_hex}40` }}>
      <div className="absolute inset-0 opacity-10" style={{ backgroundColor: team.color_hex }} />
      
      <div className="relative z-10 p-6 md:p-10 flex flex-col h-full">
        <div className={`flex items-start justify-between mb-2 ${isReversed ? 'flex-row-reverse' : ''}`}>
          <div className={`flex flex-col min-w-0 flex-1 ${isReversed ? 'pl-2' : 'pr-2'}`}>
            <h2 
              className={`font-display text-4xl sm:text-5xl lg:text-6xl font-bold truncate tracking-wider w-full ${isReversed ? 'text-right' : ''}`} 
              style={{ color: team.color_hex }}
            >
              {team.name.toUpperCase()}
            </h2>
            <div className={`flex flex-wrap gap-1 mt-1 w-full ${isReversed ? 'justify-end' : ''}`}>
              {team.team_players.map((p: any) => (
                <span 
                  key={p.player} 
                  className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full border truncate max-w-[100px] sm:max-w-[150px] flex items-center gap-1 ${isReversed ? 'flex-row-reverse' : ''} ${p.is_borrowed ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'text-text-muted bg-surface/50 border-border/50'}`}
                >
                  {p.player_name}
                  {p.is_borrowed && <span className="text-[9px] uppercase font-bold opacity-80">(Emp)</span>}
                </span>
              ))}
            </div>
          </div>
          {consecutive > 0 && (
            <div className={`flex text-yellow-400 flex-shrink-0 mt-1 ${isReversed ? 'flex-row-reverse' : ''}`} title={`${consecutive} vitórias seguidas. Na 2ª, também sai!`}>
              {Array.from({ length: consecutive }).map((_, i) => <Star key={i} size={24} className="fill-yellow-400 sm:w-8 sm:h-8" />)}
              {consecutive === 1 && <Star size={24} className="opacity-20 sm:w-8 sm:h-8" />}
            </div>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center py-4 md:py-8 lg:py-12">
          <span className="text-[7rem] sm:text-[10rem] lg:text-[18rem] leading-none font-display font-bold tabular-nums tracking-tighter" style={{ color: team.color_hex }}>
            {score}
          </span>
        </div>

        <div className={`flex gap-2 sm:gap-4 md:gap-8 mt-auto ${disabled ? 'pointer-events-none opacity-30' : ''}`} aria-disabled={disabled}>
          <button 
            onClick={() => onUpdateScore(-1)} 
            className="flex-1 h-16 sm:h-20 md:h-28 rounded-xl sm:rounded-2xl md:rounded-3xl bg-surface/80 hover:bg-surface border border-border text-4xl sm:text-5xl md:text-7xl font-bold text-text-muted transition-colors active:scale-95"
          >
            -
          </button>
          <button 
            onClick={() => onUpdateScore(1)} 
            className="flex-[1.5] sm:flex-1 h-16 sm:h-20 md:h-28 rounded-xl sm:rounded-2xl md:rounded-3xl bg-surface/80 hover:bg-surface border text-4xl sm:text-5xl md:text-8xl font-bold transition-colors active:scale-95 shadow-lg flex items-center justify-center" 
            style={{ borderColor: `${team.color_hex}80`, color: team.color_hex }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
