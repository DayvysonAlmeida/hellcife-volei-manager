import { motion } from 'framer-motion';
import { Users, UserCheck } from 'lucide-react';

export function StatsPills({ totalPlayers, activePlayers }: { totalPlayers: number; activePlayers: number }) {
  return (
        <div className="flex flex-col sm:flex-row lg:flex-col gap-4 justify-center lg:w-64 flex-shrink-0">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card-gradient border border-blue-500/20 rounded-2xl p-5 flex items-center gap-4 hover:border-blue-500/50 hover:shadow-neon-blue transition-all w-full relative overflow-hidden"
          >
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-blue-500/10 rounded-full blur-xl" />
            <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
              <Users size={24} />
            </div>
            <div className="z-10">
              <p className="text-white/60 text-[10px] font-black tracking-widest uppercase mb-1">Total Registrado</p>
              <p className="font-display text-4xl text-white leading-none">{totalPlayers}</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card-gradient border border-green-500/20 rounded-2xl p-5 flex items-center gap-4 hover:border-green-500/50 hover:shadow-neon-green transition-all w-full relative overflow-hidden"
          >
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-green-500/10 rounded-full blur-xl" />
            <div className="w-12 h-12 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center shrink-0 border border-green-500/30">
              <UserCheck size={24} />
            </div>
            <div className="z-10">
              <p className="text-white/60 text-[10px] font-black tracking-widest uppercase mb-1">Jogadores Ativos</p>
              <p className="font-display text-4xl text-white leading-none">{activePlayers}</p>
            </div>
          </motion.div>
        </div>
  );
}
