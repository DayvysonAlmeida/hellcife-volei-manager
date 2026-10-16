import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, BellRing, ChevronLeft, ChevronRight, Landmark, MapPin, Table2, BarChart3, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { circuitFinanceService } from '@/services';
import { useTheme } from '@/store/ThemeContext';
import { cn, formatBRL } from '@/lib/utils';
import type { FinanceOverview } from '@/types';

// Paleta validada (scripts/validate_palette.js do skill dataviz) contra as superfícies do app:
// escuro #0d0f14 e claro #ffffff — todas as checagens passam nos dois temas.
const SERIES = {
  dark: { received: '#3987e5', costs: '#d95926' },
  light: { received: '#2a78d6', costs: '#eb6834' },
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

function monthLabel(key: string, style: 'long' | 'short' = 'long') {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  if (style === 'short') {
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('. de ', '/').replace('.', '');
  }
  const name = d.toLocaleDateString('pt-BR', { month: 'long' });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
}

function StatTile({ icon: Icon, label, value, hint, tone = 'neutral' }: {
  icon: typeof Wallet; label: string; value: string; hint?: string; tone?: 'neutral' | 'good' | 'bad' | 'warn';
}) {
  const toneClass = { neutral: 'text-text-primary', good: 'text-green-400', bad: 'text-red', warn: 'text-orange-400' }[tone];
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-text-muted text-[11px] font-bold uppercase tracking-wider mb-2">
        <Icon size={14} /> {label}
      </div>
      <p className={cn('text-2xl sm:text-3xl font-black', toneClass)}>{value}</p>
      {hint && <p className="text-xs text-text-secondary mt-1">{hint}</p>}
    </div>
  );
}

function SeriesTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const [received, costs] = [payload.find((p) => p.name === 'Recebido'), payload.find((p) => p.name === 'Custo das quadras')];
  const balance = (received?.value ?? 0) - (costs?.value ?? 0);
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-text-primary mb-1 capitalize">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-text-secondary">
          <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
          {p.name}: <span className="text-text-primary font-bold">{formatBRL(p.value)}</span>
        </p>
      ))}
      <p className="mt-1 pt-1 border-t border-border text-text-secondary">
        Saldo: <span className={cn('font-bold', balance >= 0 ? 'text-green-400' : 'text-red')}>{formatBRL(balance)}</span>
      </p>
    </div>
  );
}

function MonthlyChart({ series }: { series: FinanceOverview['series'] }) {
  const { theme } = useTheme();
  const colors = SERIES[theme === 'light' ? 'light' : 'dark'];
  const [asTable, setAsTable] = useState(false);
  const data = series.map((s) => ({
    month: monthLabel(s.month, 'short'),
    Recebido: Number(s.received),
    'Custo das quadras': Number(s.court_costs),
  }));

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-text-primary uppercase tracking-wider text-sm">Recebido × custo das quadras</h3>
          <p className="text-xs text-text-muted">Últimos 12 meses</p>
        </div>
        <button
          onClick={() => setAsTable((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-primary border border-border rounded-lg px-2.5 py-1.5"
        >
          {asTable ? <BarChart3 size={14} /> : <Table2 size={14} />} {asTable ? 'Gráfico' : 'Tabela'}
        </button>
      </div>

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-text-muted text-xs uppercase tracking-wider">
              <tr><th className="text-left py-2">Mês</th><th className="text-right">Recebido</th><th className="text-right">Quadras</th><th className="text-right">Saldo</th></tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.map((d) => {
                const bal = d.Recebido - d['Custo das quadras'];
                return (
                  <tr key={d.month} className="text-text-secondary">
                    <td className="py-2 capitalize">{d.month}</td>
                    <td className="text-right">{formatBRL(d.Recebido)}</td>
                    <td className="text-right">{formatBRL(d['Custo das quadras'])}</td>
                    <td className={cn('text-right font-bold', bal >= 0 ? 'text-green-400' : 'text-red')}>{formatBRL(bal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--color-border) / 0.25)" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 11 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 11 }}
                tickFormatter={(v: number) => `R$ ${v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : v}`}
              />
              <Tooltip content={<SeriesTooltip />} cursor={{ fill: 'rgb(var(--color-text-muted) / 0.08)' }} />
              <Legend
                itemSorter={null}
                iconType="square"
                iconSize={10}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => <span className="text-text-secondary">{value}</span>}
              />
              <Bar dataKey="Recebido" fill={colors.received} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="Custo das quadras" fill={colors.costs} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function FinanceDashboardPage() {
  const currentMonth = monthKey(new Date());
  const [month, setMonth] = useState(currentMonth);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['circuit-finance', 'overview', month],
    queryFn: () => circuitFinanceService.overview(month),
  });

  const balance = Number(data?.balance ?? 0);
  const maxLocation = Math.max(1, ...(data?.by_location.map((l) => Number(l.collected)) ?? [0]));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Activity className="text-red" /> Painel Financeiro
          </h1>
          <p className="text-text-secondary text-sm">Dinheiro que entrou de verdade, custo das quadras e o que falta receber.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="p-2 rounded-lg border border-border text-text-muted hover:text-text-primary" aria-label="Mês anterior">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[150px] text-center text-sm font-bold text-text-primary">{monthLabel(month)}</span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={month >= currentMonth}
            className="p-2 rounded-lg border border-border text-text-muted hover:text-text-primary disabled:opacity-30"
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <PageLoading />
      ) : error || !data ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <>
          {data.pending_claims > 0 && (
            <Link
              to="/finance/circuits"
              className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 hover:bg-amber-500/15"
            >
              <BellRing size={18} className="shrink-0" />
              <span className="flex-1">
                <strong>{data.pending_claims}</strong> atleta{data.pending_claims === 1 ? '' : 's'} avisou que pagou e aguarda conferência.
              </span>
              <ChevronRight size={16} />
            </Link>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile
              icon={TrendingUp}
              label="Recebido no mês"
              value={formatBRL(data.received)}
              hint={`Circuitos ${formatBRL(data.circuits_received)} · Créditos ${formatBRL(data.extras_received)}`}
            />
            <StatTile icon={TrendingDown} label="Custo das quadras" value={formatBRL(data.court_costs)} hint={`${data.circuits.length} circuito${data.circuits.length === 1 ? '' : 's'} no mês`} />
            <StatTile icon={Wallet} label="Saldo do mês" value={formatBRL(balance)} hint="Recebido − custo das quadras" tone={balance >= 0 ? 'good' : 'bad'} />
            <StatTile icon={Landmark} label="A receber" value={formatBRL(data.outstanding)} hint="Dos circuitos deste mês" tone={Number(data.outstanding) > 0 ? 'warn' : 'neutral'} />
          </div>

          <MonthlyChart series={data.series} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Circuitos do mês */}
            <div className="card p-4 sm:p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-text-primary uppercase tracking-wider text-sm">Circuitos do mês</h3>
                <Link to="/finance/circuits" className="text-xs font-bold text-red hover:underline">Cobranças →</Link>
              </div>
              {data.circuits.length === 0 ? (
                <p className="text-sm text-text-muted py-6 text-center">Nenhum circuito neste mês.</p>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead className="text-text-muted text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="text-left py-2 pl-4 sm:pl-0">Circuito</th>
                        <th className="text-right">Pagos</th>
                        <th className="text-right">Arrecadado</th>
                        <th className="text-right">A receber</th>
                        <th className="text-right pr-4 sm:pr-0">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {data.circuits.map((c) => {
                        const bal = Number(c.balance);
                        return (
                          <tr key={c.id} className="text-text-secondary">
                            <td className="py-2.5 pl-4 sm:pl-0">
                              <p className="text-text-primary font-medium">
                                {new Date(`${c.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {c.location || 'Sem local'}
                              </p>
                              <p className="text-[11px] text-text-muted">
                                {c.pricing_type === 'fixed' ? 'Evento' : 'Rateio'} · {formatBRL(c.price_per_person)}/atleta
                              </p>
                            </td>
                            <td className="text-right">{c.paid}/{c.confirmed + c.reserved}</td>
                            <td className="text-right text-text-primary">{formatBRL(c.collected)}</td>
                            <td className={cn('text-right', Number(c.outstanding) > 0 && 'text-orange-400')}>{formatBRL(c.outstanding)}</td>
                            <td className={cn('text-right font-bold pr-4 sm:pr-0', bal >= 0 ? 'text-green-400' : 'text-red')}>{formatBRL(bal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* Por local */}
              <div className="card p-4 sm:p-6">
                <h3 className="font-bold text-text-primary uppercase tracking-wider text-sm mb-4 flex items-center gap-2">
                  <MapPin size={14} className="text-text-muted" /> Receita por local
                </h3>
                {data.by_location.length === 0 ? (
                  <p className="text-sm text-text-muted">Sem dados neste mês.</p>
                ) : (
                  <div className="space-y-3">
                    {data.by_location.map((loc) => (
                      <div key={loc.label}>
                        <div className="flex justify-between gap-2 text-xs mb-1">
                          <span className="text-text-secondary truncate">{loc.label}</span>
                          <span className="text-text-primary font-bold whitespace-nowrap">{formatBRL(loc.collected)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                          <div className="h-full rounded-full bg-text-secondary/70" style={{ width: `${(Number(loc.collected) / maxLocation) * 100}%` }} />
                        </div>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {loc.circuits} circuito{loc.circuits === 1 ? '' : 's'} · quadra {formatBRL(loc.court_cost)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Planos */}
              <div className="card p-4 sm:p-6">
                <h3 className="font-bold text-text-primary uppercase tracking-wider text-sm mb-2">Planos</h3>
                <p className="text-sm text-text-secondary">
                  <strong className="text-text-primary">{data.plans.active_subscriptions}</strong> assinatura{data.plans.active_subscriptions === 1 ? '' : 's'} ativa{data.plans.active_subscriptions === 1 ? '' : 's'}
                </p>
                <p className="text-xs text-text-muted mt-1">Mensalidade estimada: {formatBRL(data.plans.mrr_estimate)}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
