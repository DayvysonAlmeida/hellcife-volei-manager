import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarClock, Crown, Flame, Swords, Gift, Trophy, Pencil, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar } from '@/components/ui/Avatar';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { formatDate } from '@/lib/utils';
import { isAdmin } from '@/lib/roles';
import { seasonsService } from '@/services';
import { useAuth } from '@/store/AuthContext';
import type { PastSeason, SeasonInfo, SeasonPodiumEntry } from '@/types';

const MEDALS = ['🥇', '🥈', '🥉'];
const PRIZE_MAX = 1000;

const CATEGORIES = [
  { key: 'elo', title: 'Maior Elo', icon: Crown, color: 'text-red', detail: (e: SeasonPodiumEntry) => `${Math.round(e.elo)} de Elo` },
  { key: 'fire_shark', title: 'Fire Shark', icon: Flame, color: 'text-orange-500', detail: (e: SeasonPodiumEntry) => `${Math.round(e.fire_score ?? 0)} pts` },
  { key: 'gladiator', title: 'Gladiador', icon: Swords, color: 'text-yellow-600 dark:text-yellow-400', detail: (e: SeasonPodiumEntry) => `${e.wins} vitórias` },
] as const;

/** Premiação da temporada: todos veem o texto; admin e moderador editam aqui mesmo. */
function PrizeBlock({ number, text, canEdit, emptyHint }: { number: number; text?: string; canEdit: boolean; emptyHint?: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text ?? '');
  const fieldId = `premiacao-temporada-${number}`;

  const save = useMutation({
    mutationFn: () => seasonsService.updatePrize(number, draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seasons'] });
      setEditing(false);
      toast.success('Premiação salva.');
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Não foi possível salvar a premiação. Tente de novo.'),
  });

  if (editing) {
    return (
      <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-3 flex flex-col gap-2">
        <label htmlFor={fieldId} className="text-[10px] font-black uppercase tracking-widest text-yellow-700 dark:text-yellow-400">Premiação da temporada</label>
        <textarea
          id={fieldId}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, PRIZE_MAX))}
          rows={3}
          placeholder="Ex.: Camisa oficial para o 1º do Fire Shark e troféu para o Gladiador."
          className="input w-full text-sm"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-text-muted tabular-nums">{draft.length}/{PRIZE_MAX}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setDraft(text ?? ''); setEditing(false); }} className="btn-ghost text-xs px-3 py-1.5">Cancelar</button>
            <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1.5">
              {save.isPending && <Loader2 size={12} className="animate-spin" />} Salvar premiação
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!text && !canEdit) {
    return emptyHint ? <p className="text-xs text-text-muted flex items-center gap-2"><Gift size={14} className="text-yellow-500" />{emptyHint}</p> : null;
  }

  return (
    <div className="flex items-start gap-2 rounded-xl border border-yellow-500/25 bg-yellow-500/5 px-3 py-2">
      <Gift size={16} className="text-yellow-500 flex-shrink-0 mt-0.5" />
      <p className={`text-sm flex-1 whitespace-pre-line ${text ? 'text-text-secondary' : 'text-text-muted italic'}`}>
        {text || 'Nenhuma premiação cadastrada ainda.'}
      </p>
      {canEdit && (
        <button
          type="button"
          onClick={() => { setDraft(text ?? ''); setEditing(true); }}
          className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg border border-border/50 px-2 py-1 text-[11px] font-bold text-text-muted hover:text-text-primary transition-colors"
        >
          <Pencil size={12} /> Editar premiação
        </button>
      )}
    </div>
  );
}

function CurrentSeason({ season, canEdit }: { season: SeasonInfo; canEdit: boolean }) {
  const isPreseason = season.number === 0;
  return (
    <div className="rounded-2xl border border-red/30 bg-gradient-to-br from-red/10 via-surface to-surface p-5 sm:p-6 flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 text-red text-xs font-black uppercase tracking-widest mb-2">
          <CalendarClock size={14} /> Temporada atual
        </div>
        <h2 className="font-display text-3xl sm:text-4xl uppercase tracking-tight text-text-primary">{season.name}</h2>
        <p className="text-text-muted text-sm mt-1">
          {isPreseason
            ? `Aquecimento com todo o histórico de jogos, até ${formatDate(season.end_date)}.`
            : `De ${formatDate(season.start_date ?? '')} a ${formatDate(season.end_date)}.`}
        </p>
      </div>

      <PrizeBlock number={season.number} text={season.prize_notes} canEdit={canEdit} emptyHint="A premiação desta temporada ainda vai ser anunciada." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-surface-highlight/40 border border-border/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">
            {isPreseason ? 'Temporada 1 começa em' : 'Termina em'}
          </p>
          <p className="font-display text-2xl text-text-primary mt-1">
            {isPreseason ? `${season.next_season_starts_in ?? 0} dias` : `${Math.max(season.days_left, 0)} dias`}
          </p>
          {isPreseason && season.next_season_start && (
            <p className="text-[11px] text-text-muted">{formatDate(season.next_season_start)}</p>
          )}
        </div>
        <div className="rounded-xl bg-surface-highlight/40 border border-border/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Fire Shark: como pontua</p>
          <p className="font-display text-2xl text-text-primary mt-1">
            V {season.fire_shark_points?.win ?? 3} · D {season.fire_shark_points?.loss ?? 1} · Circuito {season.fire_shark_points?.circuit ?? 10}
          </p>
          <p className="text-[11px] text-text-muted">Vitória, derrota e cada circuito com check-in. Tudo soma, nada desconta.</p>
        </div>
        <div className="rounded-xl bg-surface-highlight/40 border border-border/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Na virada</p>
          <p className="text-sm text-text-primary mt-1 leading-snug">
            Elo, Fire Shark e Gladiador recomeçam do zero. Todo mundo volta para <strong>500</strong> de Elo.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Fechamento: o resultado fica provisório até a organização conferir e validar. */
function ValidationBar({ season }: { season: PastSeason }) {
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: (step: 'recalculate' | 'validate') => seasonsService.seasonResults(season.number, step),
    onSuccess: (_, step) => {
      qc.invalidateQueries({ queryKey: ['seasons'] });
      toast.success(step === 'validate' ? 'Classificação final validada. O pódio já aparece para os atletas.' : 'Classificação recalculada com os dados de agora.');
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Não foi possível concluir. Tente de novo.'),
  });

  if (season.validated) {
    return (
      <p className="text-xs text-green-500 flex items-center gap-1.5">
        <ShieldCheck size={14} /> Classificação final validada{season.validated_at ? ` em ${formatDate(season.validated_at)}` : ''}.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-3 flex flex-col sm:flex-row sm:items-center gap-2">
      <p className="text-xs text-text-secondary flex-1">
        <strong className="text-yellow-700 dark:text-yellow-400">Resultado provisório.</strong> Confira o pódio abaixo. Se corrigir alguma partida ou
        check-in, recalcule antes de validar. Os atletas só veem o pódio depois da validação.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => run.mutate('recalculate')} disabled={run.isPending} className="btn-ghost text-xs px-3 py-1.5 inline-flex items-center gap-1.5">
          <RefreshCw size={12} className={run.isPending && run.variables === 'recalculate' ? 'animate-spin' : ''} /> Recalcular
        </button>
        <button type="button" onClick={() => run.mutate('validate')} disabled={run.isPending} className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1.5">
          {run.isPending && run.variables === 'validate' ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} Validar classificação final
        </button>
      </div>
    </div>
  );
}

function Podium({ season, canEdit }: { season: PastSeason; canEdit: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/40 bg-surface p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-2xl uppercase tracking-tight text-text-primary flex items-center gap-2">
          <Trophy size={20} className="text-yellow-500" /> {season.name}
        </h3>
        <span className="text-xs text-text-muted">
          {season.start_date ? `${formatDate(season.start_date)} a ` : 'Até '}{formatDate(season.end_date)}
        </span>
      </div>

      <PrizeBlock number={season.number} text={season.prize_notes} canEdit={canEdit} />

      {canEdit && <ValidationBar season={season} />}

      {!canEdit && !season.validated ? (
        <p className="text-sm text-text-muted rounded-xl border border-dashed border-border p-4 text-center">
          A organização está conferindo a classificação final. O pódio aparece aqui assim que for validado.
        </p>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CATEGORIES.map(({ key, title, icon: Icon, color, detail }) => {
          const entries = season.podium[key];
          return (
            <div key={key} className="rounded-xl bg-surface-highlight/40 border border-border/40 p-3">
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
                      <span className="text-sm text-text-primary flex-1 truncate">{e.name}</span>
                      <span className="text-[11px] text-text-muted tabular-nums">{detail(e)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
      )}
    </motion.div>
  );
}

export function SeasonsPage() {
  const { user } = useAuth();
  const canEdit = isAdmin(user); // fechar a temporada e a premiação: só o admin
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

      <CurrentSeason season={data.current} canEdit={canEdit} />

      <div className="space-y-4">
        <h2 className="font-display text-2xl uppercase tracking-tight text-text-primary">Campeões</h2>
        {data.past.length === 0 ? (
          <p className="text-sm text-text-muted rounded-2xl border border-dashed border-border p-6 text-center">
            Nenhuma temporada encerrada ainda. Os destaques de 👑 Elo, 🦈 Fire Shark e ⚔️ Gladiador aparecem aqui no fim de cada temporada.
          </p>
        ) : (
          data.past.map((season) => <Podium key={season.number} season={season} canEdit={canEdit} />)
        )}
      </div>
    </div>
  );
}
