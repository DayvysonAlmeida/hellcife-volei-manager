import { useState, useEffect } from 'react';
import type { Player, Badge } from '@/types';
import { BadgeIcon } from './BadgeIcon';
import { Star, Trophy } from 'lucide-react';
import api from '@/lib/api';

interface TrophyRoomProps {
  player: Player;
  /** Admin: mostra o aviso para cadastrar conquistas quando o catálogo está vazio. O atleta não vê a seção vazia. */
  showEmptyHint?: boolean;
}

export function TrophyRoom({ player, showEmptyHint = false }: TrophyRoomProps) {
  const [allBadges, setAllBadges] = useState<Badge[]>([]);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const response = await api.get('/players/badges/');
        // Dependendo de como a API paginar, os dados podem estar em response.data ou response.data.results
        setAllBadges(response.data.results || response.data);
      } catch (error) {
        console.error("Erro ao carregar catálogo de badges", error);
      }
    };
    fetchBadges();
  }, []);

  const playerBadgeIds = player.badges?.map(pb => pb.badge.id) || [];

  return (
    <div className="card p-6 md:p-8 mt-6">
      <h3 className="font-display text-2xl mb-6 flex items-center gap-3">
        <Trophy className="text-yellow-400" size={28} />
        Sala de Troféus
      </h3>

      {/* Seção 1: Progresso da Grande Estrela */}
      <div className="bg-surface/50 rounded-xl p-5 border border-border mb-8">
        <h4 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-4">Progresso para próxima Estrela Grande</h4>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-4 bg-background rounded-full overflow-hidden border border-border">
              <div 
                className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all duration-1000"
                style={{ width: `${Math.min(100, (player.mini_stars / 15) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs font-bold">
              <span className="text-text-muted">0</span>
              <span className="text-yellow-400">{player.mini_stars} / 15 Mini-estrelas</span>
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-full bg-surface border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/20 relative">
             <Star className="fill-yellow-400 text-yellow-500 relative z-10" size={32} />
             <div className="absolute inset-0 bg-yellow-400/20 blur-md rounded-full" />
             <span className="text-xs font-bold mt-1 text-text-primary relative z-10">{player.big_stars}</span>
          </div>
        </div>
        
        {/* Sumário das Mini Estrelas */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-6">
           <div className="text-center p-2 rounded-lg bg-surface border border-border/50"><div className="text-xl font-bold text-yellow-400">{player.mvp_stars}</div><div className="text-[10px] uppercase text-text-muted font-bold">MVP</div></div>
           <div className="text-center p-2 rounded-lg bg-surface border border-border/50"><div className="text-xl font-bold text-red">{player.attack_stars}</div><div className="text-[10px] uppercase text-text-muted font-bold">Ataque</div></div>
           <div className="text-center p-2 rounded-lg bg-surface border border-border/50"><div className="text-xl font-bold text-blue-400">{player.defense_stars}</div><div className="text-[10px] uppercase text-text-muted font-bold">Defesa</div></div>
           <div className="text-center p-2 rounded-lg bg-surface border border-border/50"><div className="text-xl font-bold text-green-400">{player.setter_stars}</div><div className="text-[10px] uppercase text-text-muted font-bold">Levant.</div></div>
           <div className="text-center p-2 rounded-lg bg-surface border border-border/50"><div className="text-xl font-bold text-purple-400">{player.pass_stars}</div><div className="text-[10px] uppercase text-text-muted font-bold">Passe</div></div>
           <div className="text-center p-2 rounded-lg bg-surface border border-border/50"><div className="text-xl font-bold text-orange-400">{player.block_stars}</div><div className="text-[10px] uppercase text-text-muted font-bold">Bloqueio</div></div>
        </div>
      </div>

      {/* Seção 2: Badges / Conquistas (some para o atleta enquanto o catálogo estiver vazio) */}
      {(allBadges.length > 0 || showEmptyHint) && (<>
      <h4 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-4">Conquistas de Carreira</h4>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {allBadges.length > 0 ? allBadges.map(badge => {
          const isUnlocked = playerBadgeIds.includes(badge.id);
          return (
            <div key={badge.id} className="flex flex-col items-center text-center group cursor-help">
              <BadgeIcon badge={badge} locked={!isUnlocked} />
              <span className={`text-xs font-bold mt-2 truncate w-full px-1 ${!isUnlocked ? 'text-text-muted' : 'text-text-primary'}`}>
                {badge.name}
              </span>
            </div>
          );
        }) : (
           <div className="col-span-full py-8 text-center text-text-muted text-sm border border-dashed border-border rounded-xl">
             Nenhuma conquista cadastrada ainda. Crie as conquistas no Django Admin, em Jogadores → Badges.
           </div>
        )}
      </div>
      </>)}

    </div>
  );
}
