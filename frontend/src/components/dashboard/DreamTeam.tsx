import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';

export function DreamTeam({ dreamTeam }: { dreamTeam: any[] }) {
  if (!dreamTeam || dreamTeam.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="relative bg-surface/30 backdrop-blur-md border border-red-900/30 rounded-2xl p-6 overflow-hidden group hover:border-red-900/50 transition-all hover:shadow-[0_0_30px_rgba(220,38,38,0.05)]"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-[50px] rounded-full pointer-events-none -z-10 group-hover:bg-red-500/10 transition-all" />
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          <Star size={20} className="text-red-400 fill-red-400/20" />
        </div>
        <div>
          <h2 className="font-display text-xl text-text-primary tracking-wider">DREAM TEAM HELLCIFE</h2>
          <p className="text-sm text-text-muted">A formação ideal: quem tem mais pontos no Fire Shark em cada posição.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {dreamTeam.map((player) => (
          <Link 
            key={player.id} 
            to={`/players/${player.id}`}
            className="flex flex-col items-center bg-black/40 border border-border/50 rounded-2xl p-4 hover:border-red-500/50 hover:bg-surface-highlight transition-all group"
          >
            <PositionBadge position={player.position as any} className="mb-3 text-[10px] px-2 py-0.5" />
            <Avatar name={player.name} src={player.avatar_url} size="lg" className="ring-2 ring-red-500/20 group-hover:ring-red-500/50 mb-3 shadow-[0_0_15px_rgba(239,68,68,0.1)] group-hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all" />
            <h3 className="font-bold text-sm text-text-primary text-center truncate w-full">{player.name}</h3>
            <div className="flex flex-col items-center mt-2 w-full bg-red-900/20 rounded-lg p-2 border border-red-500/10">
              <span className="text-orange-400 font-display text-lg leading-none">{player.score} <span className="text-[10px] font-sans font-bold">pts</span></span>
              <span className="text-[9px] text-text-muted uppercase font-bold tracking-widest mt-1">{player.wins}/{player.total_matches} vitórias</span>
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
