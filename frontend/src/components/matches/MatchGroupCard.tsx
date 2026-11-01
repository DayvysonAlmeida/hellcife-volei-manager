import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { LocationMapModal } from '@/components/ui/LocationMapModal';
import { formatDate } from '@/lib/utils';
import type { Match } from '@/types';

/** Card do circuito na lista de jogos: cabeçalho que abre e fecha, com as partidas dentro. */
export function MatchGroupCard({ matches, expanded, onToggle, children }: {
  matches: Match[];
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const first = matches[0];

  return (
    <div className={`card overflow-hidden transition-all duration-300 ${expanded ? 'shadow-lg border-red/20' : 'border-border'}`}>
      {/* Header do Agrupamento (Dia/Circuito) Premium */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className={`w-full flex items-center justify-between p-4 md:p-5 transition-colors relative overflow-hidden group cursor-pointer ${
          expanded ? 'bg-surface-hover/80' : 'bg-surface hover:bg-surface-hover/50'
        }`}
      >
        {/* Sutil gradiente se expandido */}
        {expanded && <div className="absolute inset-0 bg-gradient-to-r from-red/5 to-transparent pointer-events-none" />}

        <div className="flex items-center gap-3 relative z-10">
          <div className="text-left">
            {first.gameday ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-red bg-red/10 px-2 py-0.5 rounded border border-red/20">
                    Circuito de Vôlei
                  </span>
                  {first.gameday_is_closed && (
                    <span className="text-[9px] uppercase font-bold tracking-widest text-text-muted bg-surface-hover px-2 py-0.5 rounded border border-border">
                      Encerrado
                    </span>
                  )}
                </div>
                <h2 className="text-text-primary text-base font-bold mt-1">
                  {formatDate(first.gameday_date || first.date)}
                </h2>
                <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5 font-medium">
                  {first.gameday_time && (
                    <span className="flex items-center gap-1">
                      🕒 {first.gameday_time.slice(0, 5)}
                    </span>
                  )}
                  {first.gameday_location && (
                    <span className="flex items-center gap-1">
                      <LocationMapModal location={first.gameday_location} className="font-medium text-text-muted hover:text-text-primary" />
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold tracking-widest text-blue bg-blue/10 px-2 py-0.5 rounded border border-blue/20 self-start">
                  Partidas Avulsas
                </span>
                <h2 className="text-text-primary text-base font-bold">
                  {formatDate(first.date)}
                </h2>
              </div>
            )}

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 bg-background px-2 py-1 rounded-md border border-border">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-neon-green" />
                <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">
                  {matches.length} {matches.length === 1 ? 'Jogo finalizado' : 'Jogos finalizados'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={`p-2 rounded-full transition-colors ${expanded ? 'bg-red/10 text-red' : 'bg-surface-hover text-text-muted group-hover:text-text-primary group-hover:bg-border'}`}>
          <ChevronDown
            size={20}
            className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Lista de Jogos do Dia */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 md:p-5 border-t border-border space-y-4 bg-background/50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
