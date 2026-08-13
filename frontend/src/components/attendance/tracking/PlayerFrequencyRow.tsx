import { Link } from "react-router-dom";
import { Avatar } from "@/components/ui/Avatar";
import type { Player } from "@/types";

export function PlayerFrequencyRow({ player }: { player: Player }) {
  const absences = player.consecutive_absences;
  const isWarning = absences >= 8 && absences < 10;
  const isDanger = absences >= 10;
  
  // Create an array of 10 blocks for the visual tracker
  const blocks = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 transition-colors hover:bg-surface-highlight ${isDanger ? 'bg-red/5' : isWarning ? 'bg-orange-500/5' : ''}`}>
      <div className="flex items-center gap-4 min-w-[200px]">
        <Avatar name={player.display_name} src={player.avatar_url} size="sm" className={isDanger ? 'border border-red/50 opacity-75' : ''} />
        <div>
          <p className={`font-bold text-sm flex items-center gap-2 ${isDanger ? 'text-red line-through opacity-75' : 'text-text-primary'}`}>
            {player.display_name}
            {player.is_guest && (
              <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                Convidado
              </span>
            )}
          </p>
          <p className="text-text-muted text-xs">{player.main_position_display}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-start md:items-center justify-center max-w-md w-full">
        <div className="flex items-center justify-between w-full mb-1.5 px-1">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
            {isDanger ? 'Inativado (10+)' : isWarning ? 'Em Risco (8+)' : 'Contagem'}
          </span>
          <span className={`text-xs font-black ${isDanger ? 'text-red' : isWarning ? 'text-orange-500' : 'text-text-primary'}`}>
            {absences} / 10
          </span>
        </div>
        
        <div className="flex w-full h-2.5 gap-1">
          {blocks.map(num => {
            const isFilled = num <= absences;
            let bgColor = "bg-surface-hover border-border/50";
            
            if (isFilled) {
              if (num >= 10) bgColor = "bg-red border-red shadow-[0_0_8px_rgba(239,68,68,0.5)]";
              else if (num >= 8) bgColor = "bg-orange-500 border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]";
              else bgColor = "bg-primary border-primary/80";
            }
            
            return (
              <div 
                key={num} 
                className={`flex-1 rounded-sm border ${bgColor} transition-all duration-300`}
                title={`${num}ª falta`}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end min-w-[100px]">
        <Link to={`/players/${player.id}`} className="btn-secondary py-1.5 px-3 text-xs w-full text-center">Ver Perfil</Link>
      </div>
    </div>
  );
}
