import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trophy, Star, Crown, Shield, Zap, Eye, Heart, Award } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { hallOfFameService } from '@/services';
import type { HallOfFameEntry, HallOfFameCategory } from '@/types';

const CATEGORY_ICONS: Record<HallOfFameCategory, React.ReactNode> = {
  best_attacker: <Zap size={20} />,
  best_defender: <Shield size={20} />,
  best_server: <Star size={20} />,
  best_setter: <Crown size={20} />,
  best_libero: <Eye size={20} />,
  revelation: <Star size={20} />,
  most_present: <Heart size={20} />,
  mvp: <Trophy size={20} />,
  best_blocker: <Shield size={20} />,
  best_opposite: <Award size={20} />,
};

const CATEGORY_COLORS: Record<HallOfFameCategory, string> = {
  mvp: '#D90429',
  best_attacker: '#2563EB',
  best_defender: '#16A34A',
  best_server: '#CA8A04',
  best_setter: '#7C3AED',
  best_libero: '#0891B2',
  revelation: '#EA580C',
  most_present: '#DB2777',
  best_blocker: '#4B5563',
  best_opposite: '#DC2626',
};

export function HallOfFamePage() {
  const currentYear = new Date().getFullYear();

  const { data, isLoading } = useQuery({
    queryKey: ['hall-of-fame'],
    queryFn: () => hallOfFameService.list(),
  });

  if (isLoading) return <PageLoading />;

  const entriesByYear = (data || []).reduce<Record<number, HallOfFameEntry[]>>((acc, entry) => {
    if (!acc[entry.year]) acc[entry.year] = [];
    acc[entry.year].push(entry);
    return acc;
  }, {});

  const years = Object.keys(entriesByYear).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="space-y-8">
      {/* Header with hero */}
      <div className="relative overflow-hidden card p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-900/20 via-card to-red/5" />
        <div className="relative text-center">
          <Trophy size={48} className="text-yellow-400 mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 20px rgba(202,138,4,0.5))' }} />
          <h1 className="font-display text-5xl text-text-primary tracking-widest mb-2">HALL DA FAMA</h1>
          <p className="text-text-muted">Os melhores atletas do HellCife Vôlei ao longo dos anos</p>
        </div>
      </div>

      {years.length === 0 ? (
        <EmptyState message="Nenhuma premiação registrada ainda. Aguarde a primeira temporada!" icon="🏆" />
      ) : (
        years.map((year) => (
          <div key={year} className="space-y-4">
            <div className="flex items-center gap-4">
              <h2 className="font-display text-2xl text-yellow-400 tracking-wider">{year}</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-yellow-800/50 to-transparent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {entriesByYear[Number(year)].map((entry, idx) => (
                <HallOfFameCard key={entry.id} entry={entry} idx={idx} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function HallOfFameCard({ entry, idx }: { entry: HallOfFameEntry; idx: number }) {
  const color = CATEGORY_COLORS[entry.category] || '#D90429';
  const icon = CATEGORY_ICONS[entry.category];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: idx * 0.08, type: 'spring' }}
      className="card overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
    >
      {/* Top color accent */}
      <div className="h-1" style={{ backgroundColor: color }} />

      <div className="p-5">
        {/* Category */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {icon}
          </div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
            {entry.category_display}
          </p>
        </div>

        {/* Player */}
        <div className="flex items-center gap-3">
          <Avatar name={entry.player_name} src={entry.player_avatar} size="md" />
          <div className="min-w-0">
            <p className="text-text-primary font-bold text-sm truncate">{entry.player_name}</p>
            {entry.player_position && (
              <PositionBadge position={entry.player_position} />
            )}
          </div>
        </div>

        {/* Description */}
        {entry.description && (
          <p className="text-text-muted text-xs mt-3 leading-relaxed line-clamp-2">{entry.description}</p>
        )}

        {/* Awarded by */}
        {entry.awarded_by_name && (
          <p className="text-text-muted text-[10px] mt-2 border-t border-border pt-2">
            Premiado por {entry.awarded_by_name}
          </p>
        )}
      </div>
    </motion.div>
  );
}
