import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarClock, Crown, Flame, Swords, Gift, Trophy } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { formatDate } from '@/lib/utils';
import { seasonsService } from '@/services';
import type { PastSeason, SeasonInfo, SeasonPodiumEntry } from '@/types';

const MEDALS = ['🥇', '🥈', '🥉'];

const CATEGORIES = [
  { key: 'elo', title: 'Maior Elo', icon: Crown, color: 'text-red', detail: (e: SeasonPodiumEntry) => `${Math.round(e.elo)} de Elo` },
  { key: 'fire_shark', title: 'Fire Shark', icon: Flame, color: 'text-orange-400', detail: (e: SeasonPodiumEntry) => `${e.wins}/${e.matches} vitórias` },
  { key: 'gladiator', title: 'Gladiador', icon: Swords, color: 'text-yellow-400', detail: (e: SeasonPodiumEntry) => `${e.wins} vitórias` },
] as const;

function CurrentSeason({ season }: { season: SeasonInfo }) {
  const isPreseason = season.number === 0;
  return (
    <div className="rounded-2xl border border-red/30 bg-gradient-to-br from-red/10 via-surface to-surface p-5 sm:p-6">
      <div className="flex items-center gap-2 text-red text-xs font-black uppercase tracking-widest mb-2">
        <CalendarClock size={14} /> Temporada atual
      </div>
      <h2 className="font-display text-3xl sm:text-4xl uppercase tracking-tight text-white">{season.name}</h2>
      <p className="text-text-muted text-sm mt-1">
        {isPreseason
          ? `Aquecimento com todo o histórico de jogos, até ${formatDate(season.end_date)}.`
          : `De ${formatDate(season.start_date ?? '')} a ${formatDate(season.end_date)}.`}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
        <div className="rounded-xl bg-black/30 border border-border p-3">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">
            {isPreseason ? 'Temporada 1 começa em' : 'Termina em'}
          </p>
          <p className="font-display text-2xl text-white mt-1">
            {isPreseason ? `${season.next_season_starts_in ?? 0} dias` : `${Math.max(season.days_left, 0)} dias`}
          </p>
          {isPreseason && season.next_season_start && (
            <p className="text-[11px] text-text-muted">{formatDate(season.next_season_start)}</p>
          )}
        </div>
        <div className="rounded-xl bg-black/30 border border-border p-3">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Fire Shark: mínimo atual</p>
          <p className="font-display text-2xl text-white mt-1">{season.fire_shark_min_games} jogos</p>
          <p className="text-[11px] text-text-muted">30% do que joga o atleta mediano, nunca menos de 10.</p>
        </div>
        <div className="rounded-xl bg-black/30 border border-border p-3">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Na virada</p>
          <p className="text-sm text-white mt-1 leading-snug">
            Elo, Fire Shark e Gladiador recomeçam do zero. Todo mundo volta para <strong>500</strong> de Elo.
          </p>
        </div>
      </div>
    </div>
  );
}

function Podium({ season }: { season: PastSeason }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h3 className="font-display text-2xl uppercase tracking-tight text-white flex items-center gap-2">
          <Trophy size={20} className="text-yellow-500" /> {season.name}
        </h3>
        <span className="text-xs text-text-muted">
          {season.start_date ? `${formatDate(season.start_date)} a ` : 'Até '}{formatDate(season.end_date)}
        </span>
      </div>

      {season.prize_notes && (
        <p className="text-sm text-text-secondary bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-3 py-2 mb-4 flex gap-2">
          <Gift size={16} className="text-yellow-500 flex-shrink-0 mt-0.5" /> {season.prize_notes}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CATEGORIES.map(({ key, title, icon: Icon, color, detail }) => {
          const entries = season.podium[key];
          return (
            <div key={key} className="rounded-xl bg-black/30 border border-border p-3">
              <p className={`text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-1.5 ${color}`}>
                <Icon size={14} /> {title}
              </p>
              {entries.length === 0 ? (
                <p className="text-xs text-text-muted">Ninguém atingiu o mínimo de jogos.</p>
              ) : (
                <ol className="space-y-2">
                  {entries.map((e) => (
                    <li key={e.player_id} className="flex items-center gap-2.5">
                      <span className="w-5 text-center">{MEDALS[e.position - 1] ?? `${e.position}º`}</span>
                      <Avatar name={e.name} src={e.avatar_url ?? undefined} size="sm" />
                      <span className="text-sm text-white flex-1 truncate">{e.name}</span>
                      <span className="text-[11px] text-text-muted tabular-nums">{detail(e)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function SeasonsPage() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['seasons'], queryFn: seasonsService.get });

  if (isLoading) return <PageLoading />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="page-title flex items-center gap-3">
          <CalendarClock className="text-red" size={30} /> TEMPORADAS
        </h1>
        <p className="page-subtitle">A ranqueada recomeça a cada semestre. Aqui ficam os campeões de cada temporada.</p>
      </div>

      <CurrentSeason season={data.current} />

      <div className="space-y-4">
        <h2 className="font-display text-2xl uppercase tracking-tight text-white">Campeões</h2>
        {data.past.length === 0 ? (
          <p className="text-sm text-text-muted rounded-2xl border border-dashed border-border p-6 text-center">
            Nenhuma temporada encerrada ainda. Os destaques de 👑 Elo, 🦈 Fire Shark e ⚔️ Gladiador aparecem aqui no fim de cada temporada.
          </p>
        ) : (
          data.past.map((season) => <Podium key={season.number} season={season} />)
        )}
      </div>
    </div>
  );
}
