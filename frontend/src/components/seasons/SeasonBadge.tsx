import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import type { SeasonInfo } from '@/types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Selo da temporada da ranqueada com a contagem regressiva. */
export function SeasonBadge({ season, to }: { season?: SeasonInfo; to: string }) {
  if (!season) return null;

  const isPreseason = season.number === 0;
  const label = isPreseason
    ? season.next_season_starts_in !== undefined && season.next_season_starts_in > 0
      ? `Temporada 1 começa em ${plural(season.next_season_starts_in, 'dia', 'dias')}`
      : 'Temporada 1 começa em breve'
    : season.days_left > 0
      ? `Termina em ${plural(season.days_left, 'dia', 'dias')}`
      : 'Último dia da temporada';

  return (
    <Link
      to={to}
      className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-2xl border border-red/30 bg-red/10 hover:bg-red/15 px-3 py-1.5 transition-colors w-fit max-w-full"
    >
      <CalendarClock size={14} className="text-red flex-shrink-0" />
      <span className="text-[11px] font-black uppercase tracking-widest text-white whitespace-nowrap">{season.name}</span>
      <span className="text-[11px] text-white/60 whitespace-nowrap">· {label}</span>
    </Link>
  );
}
