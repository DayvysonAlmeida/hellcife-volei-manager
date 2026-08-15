import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';

export function TopAttendees({ attendees }: { attendees: any[] }) {
  return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative bg-surface/30 backdrop-blur-md border border-white/5 rounded-2xl p-6 overflow-hidden group hover:border-white/10 transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.03)]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 blur-[50px] rounded-full pointer-events-none -z-10 group-hover:bg-yellow-500/10 transition-all" />
          
          <h3 className="font-display text-lg text-text-primary tracking-wider mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
              <Zap size={16} className="text-yellow-500" />
            </div>
            MAIS ASSÍDUOS
          </h3>
          <div className="flex flex-col gap-2">
            {attendees?.length > 0 ? attendees.map((att, i) => (
              <Link to={`/players/${att.id}`} key={att.id} className="flex items-center gap-3 bg-surface-highlight/30 p-2 rounded-lg hover:bg-surface-highlight/60 transition-colors">
                <span className="text-text-muted text-[10px] font-bold w-4 text-center">{i + 1}º</span>
                <Avatar name={att.name} src={att.avatar_url} size="sm" />
                <span className="flex-1 text-sm font-medium text-text-primary truncate">{att.name}</span>
                <span className="text-[10px] font-bold bg-surface px-2 py-1 rounded text-text-secondary border border-border">
                  {att.presence_count} presenças
                </span>
              </Link>
            )) : (
              <p className="text-text-muted text-xs text-center py-4">Nenhum dado de presença.</p>
            )}
          </div>
        </motion.div>
  );
}
