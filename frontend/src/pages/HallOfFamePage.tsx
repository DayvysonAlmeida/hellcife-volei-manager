import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trophy, Star, Medal, Crown, Search, Users, Award, Shield, Flame, Target } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { hallOfFameService } from '@/services';
import type { HallOfFameEntry } from '@/types';

const CATEGORY_LABELS: Record<string, string> = {
  best_attacker: 'Melhor Atacante',
  best_defender: 'Melhor Defensor',
  best_server: 'Melhor Sacador',
  best_setter: 'Melhor Levantador',
  best_libero: 'Melhor Líbero',
  best_blocker: 'Melhor Blocador',
  best_opposite: 'Melhor Oposto',
  revelation: 'Revelação',
  most_present: 'Mais Presente',
  mvp: 'MVP da Temporada',
};

const CATEGORY_ICONS: Record<string, any> = {
  best_attacker: Trophy,
  best_defender: Shield,
  best_server: Flame,
  best_setter: Award,
  best_libero: Target,
  best_blocker: Shield,
  best_opposite: Trophy,
  revelation: Star,
  most_present: Users,
  mvp: Crown,
};

export function HallOfFamePage() {
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const { data: entriesRaw, isLoading, error, refetch } = useQuery<HallOfFameEntry[]>({
    queryKey: ['hall-of-fame'],
    queryFn: () => hallOfFameService.list(),
    staleTime: 1000 * 60 * 5,
  });

  const entries: HallOfFameEntry[] = entriesRaw ?? [];

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState onRetry={refetch} />;

  const filtered = entries.filter((e) => {
    if (yearFilter && e.year !== yearFilter) return false;
    if (categoryFilter && e.category !== categoryFilter) return false;
    return true;
  });

  const years = [...new Set(entries.map((e) => e.year))].sort((a, b) => b - a);
  const categories = [...new Set(entries.map((e) => e.category))];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Award className="text-yellow-500" size={32} />
            HALL DA FAMA
          </h1>
          <p className="page-subtitle">Premiações oficiais e históricas do time</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary hover:bg-surface transition-all"
          >
            <Search size={14} /> Recarregar
          </button>
        </div>
      </motion.div>

      {/* Filtros */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap gap-3 mb-2"
      >
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-text-muted uppercase tracking-widest">
            Ano
          </label>
          <select
            value={yearFilter ?? ''}
            onChange={(e) => setYearFilter(e.target.value ? Number(e.target.value) : null)}
            className="text-xs bg-surface border border-border rounded-lg px-2 py-1.5 text-text-primary focus:outline-none focus:border-red/50"
          >
            <option value="">Todos</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-text-muted uppercase tracking-widest">
            Categoria
          </label>
          <select
            value={categoryFilter ?? ''}
            onChange={(e) => setCategoryFilter(e.target.value || null)}
            className="text-xs bg-surface border border-border rounded-lg px-2 py-1.5 text-text-primary focus:outline-none focus:border-red/50"
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Vazio */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-text-muted">
          <Medal size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">Nenhuma premiação encontrada.</p>
        </div>
      )}

      {/* Lista por ano */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {years.map((y) => {
          const yearEntries = filtered.filter((e) => e.year === y);
          if (yearEntries.length === 0) return null;
          return (
            <motion.div
              key={y}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative bg-surface/30 backdrop-blur-md border border-white/5 rounded-2xl p-6 overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                  <Crown className="text-yellow-500" size={20} />
                </div>
                <div>
                  <h3 className="font-display text-xl text-text-primary">{y}</h3>
                  <p className="text-xs text-text-muted">{yearEntries.length} premiação(ões)</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {yearEntries.map((entry) => {
                  const Icon = CATEGORY_ICONS[entry.category] || Award;
                  return (
                    <div key={entry.id} className="bg-background/50 rounded-xl p-4 flex items-center gap-4 border border-border hover:bg-surface transition-colors group">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-500/10 border border-yellow-500/20 flex-shrink-0">
                        <Icon className="text-yellow-500" size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-text-primary font-bold truncate">{entry.player_name}</h4>
                        <p className="text-sm text-yellow-500 font-medium truncate">
                          {CATEGORY_LABELS[entry.category] || entry.category}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                          <Avatar name={entry.player_name} src={entry.player_avatar} size="sm" />
                          <span>{entry.player_position}</span>
                          {entry.player_shirt && <span>· #{entry.player_shirt}</span>}
                        </div>
                        {entry.description && (
                          <p className="text-xs text-text-secondary mt-2 italic line-clamp-2">
                            {entry.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-text-muted/50 text-xs uppercase tracking-widest">
        Hellcife Vôlei Manager · Hall da Fama
      </div>
    </div>
  );
}
