import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, Trophy, Zap, Shield, Crosshair, Activity, Lock, Star, Sparkles } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';

export function OsCoroados({ newStars }: { newStars: any[] }) {
  if (!newStars) return null;
  
  return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="card p-6 border-yellow-500/30 overflow-hidden relative"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent pointer-events-none" />
        <h2 className="font-display text-xl text-yellow-500 tracking-wider mb-6 flex items-center gap-2">
          <Crown size={20} className="text-yellow-500" />
          OS COROADOS (ÚLTIMOS DESTAQUES)
        </h2>
        
        {newStars.length > 0 ? (
          <div className="flex flex-col gap-6">
            {(() => {
              const mvpIndex = newStars.findIndex(p => p.top_category === 'mvp');
              const mvpPlayer = mvpIndex >= 0 ? newStars[mvpIndex] : null;
              const otherPlayers = newStars.filter((_, idx) => idx !== mvpIndex);
              
              const catConfig: Record<string, { label: string, icon: any, color: string }> = {
                mvp: { label: 'MVP', icon: Trophy, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30 glow-yellow' },
                attack: { label: 'Melhor Ataque', icon: Zap, color: 'text-red bg-red/10 border-red/30 glow-red' },
                defense: { label: 'Melhor Defesa', icon: Shield, color: 'text-blue bg-blue/10 border-blue/30 glow-blue' },
                setter: { label: 'Melhor Levantador', icon: Crosshair, color: 'text-orange-500 bg-orange-500/10 border-orange-500/30 glow-orange' },
                pass: { label: 'Melhor Passe', icon: Activity, color: 'text-green-500 bg-green-500/10 border-green-500/30 glow-green' },
                block: { label: 'Melhor Bloqueio', icon: Lock, color: 'text-purple-500 bg-purple-500/10 border-purple-500/30 glow-purple' },
              };

              // MVP Card Rendering
              const renderMVP = (p0: any) => {
                const cat = p0.top_category ? catConfig[p0.top_category] : null;
                const CatIcon = cat?.icon || Star;
                const heroColor = cat ? cat.color.split(' ')[0] : 'text-yellow-500';

                return (
                  <Link
                    key={`hero-${p0.id}`}
                    to={`/players/${p0.id}`}
                    className="block bg-surface border border-border rounded-2xl overflow-hidden group hover:border-yellow-500/50 transition-all w-full"
                  >
                    <div className="h-32 w-full bg-gradient-to-r from-yellow-500/20 via-surface to-surface relative">
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-surface/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border">
                        <span className="text-xs font-black uppercase tracking-widest text-yellow-500">
                          {cat?.label || 'Destaque'}
                        </span>
                        <Sparkles size={14} className={heroColor} />
                      </div>
                    </div>
                    <div className="px-6 pb-6 relative -mt-16 flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
                      <Avatar name={p0.name} src={p0.avatar_url} size="xl" className="w-32 h-32 ring-4 ring-surface shadow-2xl" />
                      <div className="flex-1 flex flex-col md:flex-row items-center md:items-center justify-between w-full">
                        <div>
                          <h3 className="font-display text-3xl text-text-primary group-hover:text-yellow-400 transition-colors">{p0.name}</h3>
                          {cat && (
                            <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full border ${cat.color} font-bold text-xs uppercase tracking-widest`}>
                              <CatIcon size={12} />
                              Rei do Circuito
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-4 md:mt-0 bg-surface-highlight p-3 rounded-xl border border-border">
                          {p0.big_stars > 0 && (
                            <div className="flex flex-col items-center justify-center min-w-[70px]">
                              <span className="text-xl font-black text-yellow-500">{p0.big_stars}</span>
                              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Grandes</span>
                            </div>
                          )}
                          {p0.big_stars > 0 && <div className="w-px h-8 bg-border" />}
                          <div className="flex flex-col items-center justify-center min-w-[70px]">
                            <span className="text-xl font-black text-yellow-500/80">{p0.mini_stars}/15</span>
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Minis</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              };

              // Secondary Cards Rendering
              const renderSecondary = (player: any) => {
                const cat = player.top_category ? catConfig[player.top_category] : null;
                const CatIcon = cat?.icon || Star;
                const heroColor = cat ? cat.color.split(' ')[0] : 'text-yellow-500';
                
                return (
                  <Link
                    key={`coroado-${player.id}`}
                    to={`/players/${player.id}`}
                    className="flex flex-col bg-surface border border-border hover:border-text-muted/50 rounded-2xl overflow-hidden transition-all group h-full"
                  >
                    <div className={`h-16 w-full bg-gradient-to-b ${cat ? cat.color.split(' ')[1].replace('/10', '/20') : 'from-surface'} to-surface relative flex justify-center`}>
                      <div className="absolute top-2 right-2">
                        {cat && <CatIcon size={16} className={heroColor} opacity={0.5} />}
                      </div>
                    </div>
                    <div className="px-4 pb-4 relative -mt-8 flex flex-col items-center text-center gap-2 flex-1">
                      <Avatar name={player.name} src={player.avatar_url} size="md" className="w-16 h-16 ring-4 ring-surface shadow-lg" />
                      <div className="flex-1 flex flex-col items-center w-full">
                        <p className="font-bold text-sm text-text-primary group-hover:text-text-primary transition-colors line-clamp-1 w-full">{player.name}</p>
                        {cat && (
                          <div className={`mt-1 text-[9px] font-black uppercase tracking-widest ${heroColor} bg-surface-highlight px-2 py-0.5 rounded-full border border-border w-full truncate`}>
                            {cat.label}
                          </div>
                        )}
                        <div className="mt-auto pt-3 flex items-center justify-center gap-2 w-full">
                          {player.big_stars > 0 && (
                            <span className="text-[10px] font-bold text-yellow-500 flex items-center">
                              🌟 {player.big_stars}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-text-muted flex items-center">
                            ✦ {player.mini_stars}/15
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              };

              return (
                <>
                  {/* Destaque Principal (MVP) */}
                  {mvpPlayer && renderMVP(mvpPlayer)}
                  
                  {/* Outros Destaques */}
                  {otherPlayers.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                      {otherPlayers.map(renderSecondary)}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <p className="text-text-muted">Aguardando que atletas recebam estrelas para aparecerem aqui...</p>
        )}
      </motion.div>
  );
}
