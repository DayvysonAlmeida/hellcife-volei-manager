import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Flame, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { seasonsService } from '@/services';
import type { FireSharkPreviewRow } from '@/types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const pts = (n: number) => n.toFixed(1);
const validTarget = (value: string) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 500;

/** O que falta para o atleta disputar o título. */
function missingText(r: FireSharkPreviewRow) {
  const { games, circuits, months } = r.missing;
  const parts = [
    games > 0 && plural(games, 'partida', 'partidas'),
    circuits > 0 && plural(circuits, 'circuito', 'circuitos'),
    months > 0 && plural(months, 'mês', 'meses'),
  ].filter(Boolean);
  return `${parts.length === 1 && games + circuits + months === 1 ? 'Falta' : 'Faltam'} ${parts.join(', ')}`;
}

/** Quanto o atleta sobe ou desce da posição de hoje para a da fórmula nova. */
function Move({ row }: { row: FireSharkPreviewRow }) {
  if (row.position == null) return row.current_position ? <span className="text-red font-bold">sai</span> : <span className="text-text-muted">—</span>;
  if (row.current_position == null) return <span className="text-green-500 font-bold">entra</span>;
  const delta = row.current_position - row.position;
  if (delta === 0) return <span className="text-text-muted">=</span>;
  return (
    <span className={cn('inline-flex items-center font-bold', delta > 0 ? 'text-green-500' : 'text-red')}>
      {delta > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{Math.abs(delta)}
    </span>
  );
}

function TargetInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[10px] font-black uppercase tracking-widest text-text-muted">{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={500}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('input w-28 tabular-nums', !validTarget(value) && 'border-red')}
        aria-invalid={!validTarget(value)}
      />
    </div>
  );
}

/**
 * Prévia do Fire Shark com a fórmula nova (temporadas com premiação), usando os dados reais da temporada.
 * Serve para a equipe conferir e calibrar as metas antes de valer; o ranking dos atletas não muda por aqui.
 */
export function FireSharkPreview() {
  const [gamesInput, setGamesInput] = useState('60');
  const [circuitsInput, setCircuitsInput] = useState('16');
  const [targets, setTargets] = useState({ games: 60, circuits: 16 });
  const inputsValid = validTarget(gamesInput) && validTarget(circuitsInput);

  // Busca as metas novas quando a pessoa para de digitar
  useEffect(() => {
    if (!inputsValid) return;
    const timer = setTimeout(() => setTargets({ games: Number(gamesInput), circuits: Number(circuitsInput) }), 400);
    return () => clearTimeout(timer);
  }, [gamesInput, circuitsInput, inputsValid]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['fire-shark-preview', targets.games, targets.circuits],
    queryFn: () => seasonsService.fireSharkPreview(targets.games, targets.circuits),
    placeholderData: keepPreviousData,
  });

  const moves = useMemo(() => {
    const rows = data?.rows ?? [];
    const both = rows
      .filter((r) => r.position != null && r.current_position != null)
      .map((r) => ({ r, delta: (r.current_position ?? 0) - (r.position ?? 0) }));
    return {
      up: both.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3),
      down: both.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3),
      enter: rows.filter((r) => r.position != null && r.current_position == null),
      leave: rows.filter((r) => r.position == null && r.current_position != null),
    };
  }, [data]);

  const contenders = data?.rows.filter((r) => r.position != null).length ?? 0;
  const pending = (data?.rows.length ?? 0) - contenders;
  const f = data?.formula;

  return (
    <section className="rounded-2xl border border-orange-500/30 bg-surface p-4 sm:p-5 flex flex-col gap-4" aria-labelledby="fire-preview-title">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="fire-preview-title" className="font-display text-2xl uppercase tracking-tight text-text-primary flex items-center gap-2">
            <Flame size={20} className="text-orange-500" /> Prévia do novo Fire Shark
          </h2>
          <span className="text-[10px] font-black uppercase tracking-widest rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-300 px-2 py-0.5">
            Só admin
          </span>
        </div>
        <p className="text-sm text-text-muted">
          {f?.title ? (
            <>
              Vale a partir da Temporada 1: até <b className="text-text-primary">{f.points.win_rate}</b> pontos de desempenho,{' '}
              <b className="text-text-primary">{f.points.presence}</b> de presença e <b className="text-text-primary">{f.points.games}</b> de regularidade.
              Disputa o título quem tem {f.title.games} partidas, {f.title.circuits} circuitos e {f.title.months} meses.{' '}
            </>
          ) : 'Fórmula nova com os dados reais da temporada. '}
          Aqui vocês conferem com os dados de agora e calibram as metas; o ranking dos atletas não muda por esta tela.
        </p>
      </div>

      {/* Metas: com quantas partidas e quantos circuitos se chega aos pontos máximos */}
      <div className="flex flex-wrap items-end gap-3">
        <TargetInput id="fire-preview-games" label="Meta de partidas" value={gamesInput} onChange={setGamesInput} />
        <TargetInput id="fire-preview-circuits" label="Meta de circuitos" value={circuitsInput} onChange={setCircuitsInput} />
        {isFetching && <Loader2 size={16} className="animate-spin text-text-muted mb-2" aria-label="Atualizando" />}
      </div>
      <p className="text-xs text-text-muted -mt-2">
        {inputsValid ? (
          data && (
            <>
              Nesta temporada, na mediana, cada atleta jogou <b className="text-text-primary">{data.matches.median}</b> partidas (metade entre {data.matches.p25} e{' '}
              {data.matches.p75}) e foi a <b className="text-text-primary">{data.circuits.median}</b> circuitos (metade entre {data.circuits.p25} e {data.circuits.p75}),
              de {data.season_days} dias de circuito que contam. Quem chega à meta fica com os pontos máximos daquela parte.
            </>
          )
        ) : (
          <span className="text-red">As metas precisam ser números de 1 a 500.</span>
        )}
      </p>

      {isLoading ? (
        <p className="text-sm text-text-muted py-6 text-center">Calculando com os dados da temporada…</p>
      ) : isError || !data ? (
        <p className="text-sm text-text-muted py-6 text-center">
          Não foi possível carregar a prévia. <button type="button" onClick={() => refetch()} className="underline font-bold text-text-primary">Tentar de novo</button>
        </p>
      ) : (
        <>
          {/* Resumo: quem disputa o título, notas e quem mais muda */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-surface-highlight/40 border border-border/40 p-3">
              <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Disputam o título</p>
              <p className="font-display text-2xl text-text-primary mt-1 tabular-nums">{contenders} <span className="text-sm font-sans text-text-muted">· {pending} ainda não</span></p>
              <p className="text-[11px] text-text-muted">Todos aparecem no ranking desde o início.</p>
            </div>
            <div className="rounded-xl bg-surface-highlight/40 border border-border/40 p-3">
              <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Notas de quem disputa</p>
              <p className="font-display text-2xl text-text-primary mt-1 tabular-nums">
                {data.scores.min != null ? `${pts(data.scores.min)} a ${pts(data.scores.max ?? 0)}` : '—'}
              </p>
              <p className="text-[11px] text-text-muted tabular-nums flex flex-wrap gap-x-2">
                {data.scores.median != null && <span className="whitespace-nowrap">Mediana {pts(data.scores.median)}</span>}
                {data.scores.bands.filter((b) => b.count).map((b) => (
                  <span key={b.from} className="whitespace-nowrap">{b.from === 90 ? '90+' : `${b.from}–${b.from + 9}`}: {b.count}</span>
                ))}
              </p>
            </div>
            <div className="rounded-xl bg-surface-highlight/40 border border-border/40 p-3 text-[11px] text-text-muted flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-widest font-bold">Comparado com o ranking de hoje</p>
              <p><b className="text-green-500">Sobem:</b> {moves.up.length ? moves.up.map((m) => `${m.r.name} +${m.delta}`).join(', ') : 'ninguém'}</p>
              <p><b className="text-red">Descem:</b> {moves.down.length ? moves.down.map((m) => `${m.r.name} −${-m.delta}`).join(', ') : 'ninguém'}</p>
              {moves.enter.length > 0 && <p><b className="text-text-primary">Entram:</b> {moves.enter.map((r) => r.name).join(', ')}</p>}
              {moves.leave.length > 0 && <p><b className="text-text-primary">Saem do título:</b> {moves.leave.map((r) => r.name).join(', ')}</p>}
            </div>
          </div>

          {/* Todos os atletas com partidas na temporada */}
          <div className="overflow-x-auto custom-scrollbar rounded-xl border border-border/40">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-surface-hover text-text-secondary text-xs">
                <tr>
                  <th scope="col" className="py-2.5 px-3 font-bold">Título</th>
                  <th scope="col" className="py-2.5 px-3 font-bold">Hoje</th>
                  <th scope="col" className="py-2.5 px-3 font-bold">Atleta</th>
                  <th scope="col" className="py-2.5 px-3 font-bold text-right">Nota</th>
                  <th scope="col" className="py-2.5 px-3 font-bold text-right">Desempenho /{f?.points.win_rate}</th>
                  <th scope="col" className="py-2.5 px-3 font-bold text-right">Presença /{f?.points.presence}</th>
                  <th scope="col" className="py-2.5 px-3 font-bold text-right">Regularidade /{f?.points.games}</th>
                  <th scope="col" className="py-2.5 px-3 font-bold text-right">V/J</th>
                  <th scope="col" className="py-2.5 px-3 font-bold text-right">Circuitos</th>
                  <th scope="col" className="py-2.5 px-3 font-bold text-right">Meses</th>
                  <th scope="col" className="py-2.5 px-3 font-bold">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 tabular-nums">
                {data.rows.map((r) => (
                  <tr key={r.id} className={cn('hover:bg-surface-hover/30 transition-colors', r.position == null && 'opacity-60')}>
                    <td className="py-2 px-3 font-display text-lg text-text-primary">{r.position ?? '—'}</td>
                    <td className="py-2 px-3 text-xs">
                      <span className="text-text-muted mr-1.5">{r.current_position ?? '—'}</span>
                      <Move row={r} />
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={r.name} src={r.avatar_url ?? undefined} size="sm" />
                        <span className="font-bold text-text-primary">{r.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-display text-lg text-orange-600 dark:text-orange-400">{pts(r.score)}</td>
                    <td className="py-2 px-3 text-right">{pts(r.points.win_rate)}</td>
                    <td className="py-2 px-3 text-right">{pts(r.points.presence)}</td>
                    <td className="py-2 px-3 text-right">{pts(r.points.games)}</td>
                    <td className="py-2 px-3 text-right text-text-secondary">{r.wins}/{r.total_matches} <span className="text-text-muted">({r.win_rate}%)</span></td>
                    <td className="py-2 px-3 text-right text-text-secondary">{r.attended_days}</td>
                    <td className="py-2 px-3 text-right text-text-secondary">{r.active_months}</td>
                    <td className="py-2 px-3 text-xs text-text-muted">{r.position == null ? missingText(r) : 'Disputa o título'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
