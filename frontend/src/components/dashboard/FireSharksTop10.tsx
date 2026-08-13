import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';

export function FireSharksTop10({ fireSharks }: { fireSharks: any[] }) {
  if (!fireSharks || fireSharks.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="card p-6 bg-gradient-to-br from-[#050202] to-[#110505] border border-orange-500/20 shadow-[0_0_30px_rgba(249,115,22,0.1)] relative overflow-hidden"
    >
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
        {fireSharks.map((player, idx) => (
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
  );
}
