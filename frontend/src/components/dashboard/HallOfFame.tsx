import { motion } from 'framer-motion';
import { Award } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';

export function HallOfFame({ hallOfFame }: { hallOfFame: any[] }) {
  if (!hallOfFame || hallOfFame.length === 0) return null;
  return (
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
          {hallOfFame.map((entry) => (
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
  );
}
