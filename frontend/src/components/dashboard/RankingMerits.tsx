import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';

export function RankingMerits({ topStars }: { topStars: any[] }) {
  if (!topStars || topStars.length === 0) return null;
  return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card p-6 border-yellow-500/20"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <Star size={24} className="text-yellow-400 fill-yellow-400" />
            <div>
              <h2 className="font-display text-xl text-yellow-400 tracking-wider">RANKING DE MÉRITOS (ESTRELAS)</h2>
              <p className="text-sm text-text-muted">Top 10 membros com mais estrelas — grandes estrelas são mérito máximo</p>
            </div>
          </div>
          <Link to="/stars-system" className="btn-secondary text-xs px-4 py-2 flex items-center justify-center gap-2 whitespace-nowrap bg-surface hover:bg-surface-hover">
            <Star size={14} className="text-yellow-400" />
            Ver Sistema Completo
          </Link>
        </div>

        <div className="flex flex-col gap-4">
          {/* 1º Lugar Gigante */}
          {topStars[0] && (() => {
            const p1 = topStars[0];
            const hasBig = p1.big_stars > 0;
            return (
              <Link
                to={`/players/${p1.id}`}
                className="bg-gradient-to-r from-yellow-500/20 via-surface to-surface border border-yellow-500/40 rounded-2xl p-5 flex items-center gap-6 group hover:shadow-[0_0_30px_rgba(234,179,8,0.2)] transition-all"
              >
                <div className="relative">
                  <div className="absolute -top-3 -left-3 w-8 h-8 bg-yellow-500 text-black font-black flex items-center justify-center rounded-full shadow-lg z-10 text-sm">
                    1
                  </div>
                  <Avatar name={p1.name} src={p1.avatar_url} size="xl" className="ring-4 ring-yellow-400/60 shadow-[0_0_20px_rgba(250,204,21,0.5)]" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-display text-2xl text-yellow-400 tracking-wide group-hover:text-yellow-300 transition-colors">{p1.name}</h3>
                    {hasBig && (
                      <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded-full border border-yellow-500/30">
                        {Array.from({ length: Math.min(p1.big_stars, 3) }).map((_, i) => (
                          <span key={i} className="text-sm">🌟</span>
                        ))}
                        {p1.big_stars > 3 && <span className="text-xs text-yellow-400 font-bold ml-1">+{p1.big_stars - 3}</span>}
                      </div>
                    )}
                  </div>
                  
                  {/* Barras Horizontais do 1º colocado */}
                  <div className="grid grid-cols-3 gap-2 mt-3 w-full">
                     <div className="flex flex-col">
                       <span className="text-[9px] text-yellow-400 font-bold uppercase mb-1 flex justify-between">MVP <span>{p1.mvp_stars}</span></span>
                       <div className="h-1 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-yellow-400 rounded-full" style={{width: `${(p1.mvp_stars/5)*100}%`}}></div></div>
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[9px] text-red font-bold uppercase mb-1 flex justify-between">ATQ <span>{p1.attack_stars}</span></span>
                       <div className="h-1 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-red rounded-full" style={{width: `${(p1.attack_stars/5)*100}%`}}></div></div>
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[9px] text-blue font-bold uppercase mb-1 flex justify-between">DEF <span>{p1.defense_stars}</span></span>
                       <div className="h-1 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-blue rounded-full" style={{width: `${(p1.defense_stars/5)*100}%`}}></div></div>
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[9px] text-orange-500 font-bold uppercase mb-1 flex justify-between">LEV <span>{p1.setter_stars}</span></span>
                       <div className="h-1 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full" style={{width: `${(p1.setter_stars/5)*100}%`}}></div></div>
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[9px] text-green-500 font-bold uppercase mb-1 flex justify-between">PAS <span>{p1.pass_stars}</span></span>
                       <div className="h-1 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{width: `${(p1.pass_stars/5)*100}%`}}></div></div>
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[9px] text-purple-500 font-bold uppercase mb-1 flex justify-between">BLO <span>{p1.block_stars}</span></span>
                       <div className="h-1 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{width: `${(p1.block_stars/5)*100}%`}}></div></div>
                     </div>
                  </div>
                </div>
                
                <div className="hidden sm:flex flex-col items-center justify-center bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
                  <span className="text-[10px] text-yellow-500/80 font-bold uppercase tracking-wider mb-1">Total Mini</span>
                  <span className="font-display text-4xl text-yellow-500 leading-none">{p1.mini_stars}</span>
                  <span className="text-xs text-yellow-500/60 font-bold">/15</span>
                </div>
              </Link>
            );
          })()}

          {/* Restante: Grid em escada */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {topStars.slice(1).map((player, sliceIdx) => {
              const idx = sliceIdx + 1; // índice real
              const hasBigStar = player.big_stars > 0;
              
              return (
                <Link
                  key={player.id}
                  to={`/players/${player.id}`}
                  className={`
                    relative rounded-xl p-3 flex items-center text-left transition-all duration-300 group
                    ${hasBigStar
                      ? 'bg-gradient-to-b from-yellow-500/10 to-surface border border-yellow-500/30 hover:border-yellow-400/60'
                      : 'bg-surface border border-border hover:border-yellow-400/30'}
                  `}
                >
                  <div className={`absolute -top-2 -left-2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-md z-10 ${
                    idx === 1 ? 'bg-zinc-300 text-black' :
                    idx === 2 ? 'bg-orange-400 text-black' :
                    'bg-surface-highlight text-text-muted border border-border'
                  }`}>
                    {idx + 1}
                  </div>

                  <Avatar name={player.name} src={player.avatar_url} size="sm" className="mr-3" />
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-xs truncate ${hasBigStar ? 'text-yellow-400' : 'text-text-primary'}`}>{player.name}</h3>
                    <div className="flex flex-wrap items-center gap-x-2 mt-0.5 text-[9px] font-bold">
                      {hasBigStar && (
                        <span className="text-[10px] text-yellow-500 mr-1">🌟 {player.big_stars}</span>
                      )}
                      {player.mvp_stars > 0 && <span className="text-yellow-400">MVP {player.mvp_stars}</span>}
                      {player.attack_stars > 0 && <span className="text-red">ATQ {player.attack_stars}</span>}
                      {player.defense_stars > 0 && <span className="text-blue">DEF {player.defense_stars}</span>}
                      {player.setter_stars > 0 && <span className="text-orange-500">LEV {player.setter_stars}</span>}
                      {player.pass_stars > 0 && <span className="text-green-500">PAS {player.pass_stars}</span>}
                      {player.block_stars > 0 && <span className="text-purple-500">BLO {player.block_stars}</span>}
                      {player.mini_stars === 0 && !hasBigStar && <span className="text-text-muted">Sem minis</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>


      </motion.div>
  );
}
