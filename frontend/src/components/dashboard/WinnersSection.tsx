import { useState } from 'react';
import { motion } from 'framer-motion';
import { Award } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';

const POSITION_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'libero', label: 'Líbero' },
  { value: 'setter', label: 'Levantador' },
  { value: 'outside', label: 'Ponteiro' },
  { value: 'middle', label: 'Central' },
  { value: 'opposite', label: 'Oposto' },
  { value: 'universal', label: 'Universal' },
];

export function WinnersSection({ winners }: { winners: any[] }) {
  const [posFilter, setPosFilter] = useState('');

  const filtered = posFilter
    ? winners.filter(p => p.position === posFilter)
    : winners;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="relative bg-surface/30 backdrop-blur-md border border-white/5 rounded-2xl p-6 overflow-hidden group hover:border-white/10 transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.03)]"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-red/5 blur-[50px] rounded-full pointer-events-none -z-10 group-hover:bg-red/10 transition-all" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <h2 className="font-display text-xl text-text-primary tracking-wider flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red/10 flex items-center justify-center border border-red/20 shadow-[0_0_15px_rgba(217,4,41,0.2)]">
            <Award size={20} className="text-red" />
          </div>
          MAIORES VENCEDORES
        </h2>
        {/* Filtros de posição */}
        <div className="flex flex-wrap gap-1.5">
          {POSITION_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setPosFilter(f.value)}
              className={`text-[11px] font-bold px-3 py-1 rounded-full transition-all border ${
                posFilter === f.value
                  ? 'bg-red text-white border-red shadow-[0_0_8px_rgba(217,4,41,0.4)]'
                  : 'bg-surface text-text-muted border-border hover:border-red/40 hover:text-text-secondary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-text-muted text-center py-4">Nenhum vencedor nessa posição ainda.</p>
        )}
        {filtered.map((player, idx) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04 }}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-colors group"
          >
            {/* Rank */}
            <div className={`
              w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
              ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                idx === 1 ? 'bg-zinc-400/20 text-zinc-300' :
                idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                'bg-surface text-text-muted'}
            `}>
              {idx + 1}
            </div>
            <Avatar name={player.name} src={player.avatar_url} size="sm" />
            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2 flex-1">
                <p className="text-text-primary font-medium text-sm truncate">
                  {player.nickname || player.name}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-0.5 sm:mt-0">
                <PositionBadge position={player.position} />
                {player.big_stars > 0 && (
                  <div className="flex items-center text-yellow-400">
                    {[...Array(Math.min(player.big_stars, 3))].map((_, i) => (
                      <span key={i} className="text-sm">🌟</span>
                    ))}
                    {player.big_stars > 3 && <span className="text-xs text-yellow-400 font-bold ml-0.5">+{player.big_stars - 3}</span>}
                  </div>
                )}
                {player.mini_stars > 0 && player.big_stars === 0 && (
                  <span className="text-[10px] text-yellow-300 font-bold">{player.mini_stars}✦</span>
                )}
              </div>
            </div>
            <div className="text-right flex flex-col items-end flex-shrink-0">
              <span className="text-red font-bold text-lg leading-none">{player.wins}</span>
              <span className="text-[10px] text-text-muted uppercase">Vitórias</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
