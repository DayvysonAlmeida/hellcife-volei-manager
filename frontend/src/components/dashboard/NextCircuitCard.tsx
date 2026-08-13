import { motion } from 'framer-motion';
import { Flame, CalendarCheck, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NextCircuitCard({ nextCircuit }: { nextCircuit: any }) {
  if (nextCircuit) {
    return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 bg-gradient-to-br from-red/20 via-surface to-surface border-2 border-red/30 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(217,4,41,0.15)] flex flex-col justify-between"
          >
            <div className="absolute -right-6 -top-6 text-red/5">
              <Flame size={120} />
            </div>
            <div className="z-10 relative mb-4">
              <div className="flex items-center gap-2 text-red/80 font-bold tracking-widest text-xs mb-2 uppercase truncate">
                <CalendarCheck size={16} className="flex-shrink-0" />
                <span className="truncate">
                  {nextCircuit.description || 'Circuito Aberto'} • {nextCircuit.location || 'Sem local'} ({new Date(nextCircuit.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })})
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-5xl text-text-primary leading-none">
                  {nextCircuit.total_present}
                  <span className="text-2xl text-text-muted">/{nextCircuit.max_players || '∞'}</span>
                </h2>
                <span className="text-text-secondary text-sm">confirmados</span>
              </div>
            </div>

            <div className="z-10 relative flex flex-col sm:flex-row gap-3">
              {nextCircuit.total_unpaid > 0 && nextCircuit.court_price > 0 && (
                <div className="inline-flex items-center gap-2 bg-red/10 text-red text-xs font-bold px-3 py-2 rounded-lg border border-red/20">
                  <span className="animate-pulse">⚠️</span> {nextCircuit.total_unpaid} aguardando pagamento
                </div>
              )}
              {nextCircuit.court_price > 0 && (
                <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-500 text-xs font-bold px-3 py-2 rounded-lg border border-green-500/20">
                  <span>💰</span> R$ {nextCircuit.court_price} (Quadra)
                </div>
              )}
            </div>
            
            {/* Barra de progresso */}
            {nextCircuit.max_players > 0 && (
              <div className="mt-4 w-full h-2 bg-surface-highlight rounded-full overflow-hidden z-10 relative">
                <div 
                  className={cn("h-full rounded-full transition-all duration-1000", nextCircuit.total_present >= nextCircuit.max_players ? "bg-red" : "bg-green-500")}
                  style={{ width: `${Math.min((nextCircuit.total_present / nextCircuit.max_players) * 100, 100)}%` }}
                />
              </div>
            )}
          </motion.div>
    );
  }
  
  return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 bg-surface border border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center"
          >
            <CalendarDays size={48} className="text-text-muted mb-4 opacity-20" />
            <h3 className="text-lg font-bold text-text-primary mb-1">Nenhum Circuito Aberto</h3>
            <p className="text-sm text-text-muted">Crie um novo GameDay para iniciar as confirmações.</p>
          </motion.div>
  );
}
