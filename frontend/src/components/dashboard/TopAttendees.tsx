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
          className="card p-5"
        >
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <Zap size={14} className="text-yellow-500" /> Os 5 Mais Assíduos
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
