import { motion } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { OverallBadge } from '@/components/ui/OverallBadge';
import { PositionBadge } from '@/components/ui/Badges';
import type { GeneratedTeam } from '@/types';

export function TeamCard({ team, idx }: { team: GeneratedTeam; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.1 }}
      className="bg-surface rounded-lg border border-border overflow-hidden shadow-sm"
    >
      <div className="flex justify-between items-center p-2 bg-surface-hover border-b border-border-subtle">
        <span className="font-display text-xs" style={{ color: team.color_hex }}>{team.name.toUpperCase()}</span>
        <span className="font-bold text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${team.color_hex}20`, color: team.color_hex }}>
          OVR: {team.avg_overall.toFixed(1)}
        </span>
      </div>

      <div className="p-1.5 flex flex-col gap-0.5">
        {team.players.map((player, i) => (
          <div key={player.id} className="flex justify-between items-center py-1 px-1 rounded hover:bg-surface-hover transition-colors">
            <div className="flex items-center gap-1.5 overflow-hidden flex-1">
              <span className="text-text-muted text-[10px] w-3">{i + 1}</span>
              <Avatar name={player.display_name} src={player.avatar_url} size="sm" className="w-5 h-5 text-[8px]" />
              <div className="flex flex-col min-w-0">
                <p className="text-text-primary text-[11px] font-medium leading-tight flex flex-wrap items-center gap-1">
                  {player.display_name}
                  {player.is_guest && (
                    <span className="text-[7px] bg-blue/20 text-blue px-1 rounded uppercase font-bold inline-block">
                      Conv
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="scale-75 origin-right">
                <PositionBadge position={player.main_position} />
              </div>
              <div className="scale-90 origin-right">
                <OverallBadge overall={player.overall} size="sm" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
