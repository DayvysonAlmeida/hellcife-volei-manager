import { motion } from 'framer-motion';
import { ChevronLeft, Info, Trophy, TrendingUp, Shield, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PlayerCard } from '@/components/players/PlayerCard';
import type { Player } from '@/types';
import { useAuth } from '@/store/AuthContext';

const ELO_TIERS = [
  {
    tier: 'rookie',
    name: 'Iniciante',
    points: 'Até 499 Elo',
    desc: 'Atletas que estão começando sua jornada no vôlei ou recém-chegados ao sistema. O foco aqui é aprender e se divertir!',
    color: 'text-gray-400',
    bg: 'bg-gray-400/10',
    border: 'border-gray-400/20'
  },
  {
    tier: 'bronze',
    name: 'Bronze',
    points: '500 - 999 Elo',
    desc: 'Jogadores que já conhecem o básico, mas ainda estão refinando os fundamentos e posicionamento em quadra.',
    color: 'text-[#CD7C2F]',
    bg: 'bg-[#CD7C2F]/10',
    border: 'border-[#CD7C2F]/20'
  },
  {
    tier: 'silver',
    name: 'Prata',
    points: '1000 - 1499 Elo',
    desc: 'O nível intermediário. Possuem constância no jogo, erram menos e já começam a definir partidas com boas jogadas.',
    color: 'text-slate-300',
    bg: 'bg-slate-300/10',
    border: 'border-slate-300/20'
  },
  {
    tier: 'gold',
    name: 'Ouro',
    points: '1500 - 1999 Elo',
    desc: 'Atletas de alto nível amador. Dominam os fundamentos e têm grande visão e leitura de jogo tática.',
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20'
  },
  {
    tier: 'diamond',
    name: 'Diamante',
    points: '2000 - 2499 Elo',
    desc: 'A elite técnica e tática. Fazem a diferença em qualquer equipe, têm alto preparo e raramente erram.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    border: 'border-cyan-400/20'
  },
  {
    tier: 'elite',
    name: 'Elite',
    points: '2500+ Elo',
    desc: 'O topo da cadeia. Os melhores jogadores do circuito que ditam o ritmo, chamam a responsabilidade e definem campeonatos.',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20'
  },
  {
    tier: 'challenger',
    name: 'Desafiante',
    points: '3000+ Elo',
    desc: 'O patamar dos Deuses do circuito. Os poucos atletas que alcançam a perfeição técnica e o domínio absoluto de jogo.',
    color: 'text-red',
    bg: 'bg-[#D90429]/10',
    border: 'border-red/20'
  }
] as const;

// Gera um "Mock" de player para exibir no card
const createMockPlayer = (tier: string, name: string): Player => {
  const baseElo = tier === 'rookie' ? 300 : tier === 'bronze' ? 750 : tier === 'silver' ? 1250 : tier === 'gold' ? 1750 : tier === 'diamond' ? 2250 : tier === 'elite' ? 2750 : 3200;
  const overall = tier === 'rookie' ? 4.5 : tier === 'bronze' ? 5.5 : tier === 'silver' ? 6.5 : tier === 'gold' ? 7.5 : tier === 'diamond' ? 8.5 : tier === 'elite' ? 9.5 : 9.9;
  const winRate = tier === 'rookie' ? 40 : tier === 'bronze' ? 45 : tier === 'silver' ? 50 : tier === 'gold' ? 55 : tier === 'diamond' ? 60 : tier === 'elite' ? 70 : 85;

  return {
    id: Math.random(),
    name: `${name} Player`,
    display_name: `${name} Player`,
    nickname: name,
    avatar: '',
    avatar_url: '',
    status: 'active',
    player_position: 'Ponteiro',
    overall_rating: overall,
    elo: baseElo,
    elo_tier: tier as any,
    total_games: 50,
    win_rate: winRate,
    mvp_stars: tier === 'challenger' ? 10 : tier === 'elite' || tier === 'diamond' ? 5 : tier === 'gold' ? 2 : 0,
    attack_stars: tier === 'challenger' ? 20 : tier === 'elite' ? 10 : tier === 'diamond' ? 5 : 2,
    defense_stars: tier === 'challenger' ? 15 : tier === 'elite' ? 8 : tier === 'diamond' ? 4 : 1,
    setter_stars: 0,
    block_stars: tier === 'challenger' ? 8 : tier === 'elite' ? 4 : 0,
    serve_stars: tier === 'challenger' ? 12 : tier === 'elite' ? 6 : tier === 'gold' ? 2 : 0,
    consecutive_absences: 0,
    created_at: new Date().toISOString(),
  } as any;
};

export function EloSystemPage() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20">
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="mb-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-text-muted hover:text-white transition-colors w-fit gap-1 text-xs font-bold uppercase tracking-widest bg-surface/50 hover:bg-surface px-2 py-1 rounded-lg border border-border mb-6"
        >
          <ChevronLeft size={16} /> Voltar
        </button>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red/20 to-transparent border border-red/30 flex items-center justify-center text-red">
                <TrendingUp size={20} strokeWidth={2.5} />
              </div>
              <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tighter text-white leading-none drop-shadow-md">
                Sistema de <span className="text-transparent bg-clip-text bg-gradient-to-r from-red to-orange-500">Elo</span>
              </h1>
            </div>
            <p className="text-text-muted mt-2 max-w-2xl text-sm sm:text-base leading-relaxed">
              Entenda como funciona o sistema de progressão do Hellcife Vôlei. Ganhe pontos ao vencer partidas, perca pontos ao ser derrotado e suba de nível (Tier) para provar seu valor em quadra!
            </p>
          </div>
        </div>
      </div>

      {/* ── EXPLAINER CARDS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-5 rounded-2xl">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 border border-blue-500/20">
            <Activity size={16} />
          </div>
          <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-2">Como ganho pontos?</h3>
          <p className="text-white/50 text-xs leading-relaxed">
            Seu Elo é atualizado após cada circuito/partida que você joga. Vitórias contra times mais fortes rendem mais pontos do que vitórias contra times mais fracos.
          </p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-5 rounded-2xl">
          <div className="w-8 h-8 rounded-full bg-red/10 text-red flex items-center justify-center mb-3 border border-red/20">
            <Shield size={16} />
          </div>
          <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-2">Como perco pontos?</h3>
          <p className="text-white/50 text-xs leading-relaxed">
            A mesma regra se aplica: derrotas tiram pontos do seu Elo. Se seu time era o favorito (maior Elo médio), a penalidade de pontos na derrota será maior!
          </p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-5 rounded-2xl">
          <div className="w-8 h-8 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center mb-3 border border-yellow-500/20">
            <Trophy size={16} />
          </div>
          <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-2">Qual a vantagem do Elo?</h3>
          <p className="text-white/50 text-xs leading-relaxed">
            O Elo garante um ranqueamento justo (Ranking) e influencia no balanceamento na hora de realizar os sorteios automáticos das equipes na beira da quadra.
          </p>
        </div>
      </div>

      {/* ── TIERS SHOWCASE ─────────────────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-tighter text-white">
            As Faixas de <span className="text-red">Nível</span>
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-[#222] to-transparent" />
        </div>

        <div className="flex xl:grid xl:grid-cols-2 overflow-x-auto xl:overflow-visible snap-x snap-mandatory xl:snap-none gap-4 sm:gap-6 pb-8 pt-4 -mx-4 px-4 xl:mx-0 xl:px-0 scroll-smooth [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          {ELO_TIERS.map((tierInfo, index) => {
            const mockPlayer = createMockPlayer(tierInfo.tier, tierInfo.name);
            
            return (
              <motion.div 
                key={tierInfo.tier}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="snap-center shrink-0 w-[85vw] md:w-[600px] xl:w-auto bg-[#0a0a0a] border border-[#222] rounded-3xl p-5 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start"
              >
                {/* Texto e Explicação */}
                <div className="flex-1 text-center sm:text-left flex flex-col items-center sm:items-start">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${tierInfo.bg} ${tierInfo.border} border mb-4`}>
                    <span className={`text-xs font-black uppercase tracking-[0.2em] ${tierInfo.color}`}>
                      {tierInfo.points}
                    </span>
                  </div>
                  
                  <h3 className={`font-display text-4xl uppercase tracking-tight mb-2 ${tierInfo.color} drop-shadow-md`}>
                    {tierInfo.name}
                  </h3>
                  
                  <p className="text-white/60 text-sm leading-relaxed max-w-sm">
                    {tierInfo.desc}
                  </p>
                </div>

                {/* Exemplo do Card */}
                <div className="w-full sm:w-[280px] flex-shrink-0 relative group">
                  {/* Glowing background behind card for Elite/Diamond/Challenger */}
                  {(tierInfo.tier === 'elite' || tierInfo.tier === 'diamond' || tierInfo.tier === 'challenger') && (
                    <div className={`absolute -inset-4 ${tierInfo.bg} blur-2xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-500`} />
                  )}
                  <div className="relative pointer-events-none">
                    <PlayerCard 
                      player={mockPlayer} 
                      idx={index} 
                      canEdit={false} 
                      onDelete={() => {}} 
                    />
                  </div>
                  <div className="mt-4 text-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center justify-center gap-1">
                      <Info size={10} /> Exemplo de Card
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
