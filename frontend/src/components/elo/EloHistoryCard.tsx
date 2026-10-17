import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface EloHistoryMatch {
  match_id: number;
  date: string;
  result: 'win' | 'loss' | 'draw';
  score: number | null;
  opponent_score: number | null;
  delta: number;
  elo: number;
}

interface EloHistory {
  season: string;
  start: number;
  current: number;
  matches: EloHistoryMatch[];
}

const RESULT = {
  win: { label: 'Vitória', className: 'text-green-600 dark:text-green-400 bg-green-500/10' },
  loss: { label: 'Derrota', className: 'text-red-600 dark:text-red-400 bg-red-500/10' },
  draw: { label: 'Empate', className: 'text-text-muted bg-white/5' },
};

const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

/** Evolução do Elo na temporada, partida a partida, e o +/- das últimas partidas. */
export function EloHistoryCard({ playerId, color = '#a855f7' }: { playerId: number; color?: string }) {
  const { data } = useQuery<EloHistory>({
    queryKey: ['elo-history', playerId],
    queryFn: () => api.get(`/players/${playerId}/elo-history/`).then((r) => r.data),
  });

  if (!data) return null;

  const points = [{ n: 0, elo: data.start, date: null as string | null }, ...data.matches.map((m, i) => ({ n: i + 1, elo: m.elo, date: m.date }))];
  const values = points.map((p) => p.elo);
  const lo = Math.floor((Math.min(...values) - 20) / 50) * 50;
  const hi = Math.ceil((Math.max(...values) + 20) / 50) * 50;
  // Marcas redondas no eixo: de 50 em 50 (ou de 100 em 100 quando a faixa é grande)
  const step = hi - lo > 250 ? 100 : 50;
  const ticks = Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const last = data.matches.slice(-5).reverse();

  return (
    <section className="rounded-[28px] border border-border/30 bg-surface/70 p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-display text-lg text-text-primary tracking-wider">EVOLUÇÃO DO ELO · {data.season.toUpperCase()}</h2>
        <span className="text-xs font-bold tabular-nums text-text-muted">{data.start} → <span className="text-text-primary">{Math.round(data.current)}</span></span>
      </div>

      {data.matches.length === 0 ? (
        <p className="text-sm text-text-muted py-4">Suas partidas da temporada vão aparecer aqui. Todo mundo começa com {data.start}.</p>
      ) : (
        <>
          <div className="h-44 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="elo-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgb(var(--color-text-muted) / 0.15)" strokeDasharray="3 4" />
                <XAxis dataKey="n" hide />
                <YAxis domain={[lo, hi]} ticks={ticks} interval={0} allowDecimals={false} width={38} tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <ReferenceLine y={data.start} stroke="rgb(var(--color-text-muted) / 0.35)" />
                <Tooltip
                  cursor={{ stroke: 'rgb(var(--color-text-muted) / 0.4)' }}
                  contentStyle={{ background: 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border) / 0.5)', borderRadius: 10, fontSize: 12 }}
                  labelFormatter={(n) => (Number(n) === 0 ? 'Início da temporada' : `Partida ${n}`)}
                  formatter={(v) => [Math.round(Number(v)), 'Elo']}
                />
                <Area type="monotone" dataKey="elo" stroke={color} strokeWidth={2} fill="url(#elo-area)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">Últimas partidas</span>
            {last.map((m) => (
              <div key={m.match_id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                <span className={cn('rounded-md py-0.5 text-center text-[10px] font-black uppercase tracking-wider', RESULT[m.result].className)}>{RESULT[m.result].label}</span>
                <span className="text-text-muted truncate">
                  {shortDate(m.date)}{m.score != null && m.opponent_score != null ? ` · ${m.score} × ${m.opponent_score}` : ''}
                </span>
                <span className={cn('font-display text-lg tabular-nums leading-none',
                  m.delta > 0 ? 'text-green-600 dark:text-green-400' : m.delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-text-muted')}>
                  {m.delta > 0 ? `+${Math.round(m.delta)}` : m.delta < 0 ? `−${Math.abs(Math.round(m.delta))}` : '0'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
