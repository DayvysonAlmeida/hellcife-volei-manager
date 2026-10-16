import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BellRing, ChevronLeft, CircleDollarSign, Clock, Wallet } from 'lucide-react';

import { Avatar } from '@/components/ui/Avatar';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { PaymentConfirmModal, type PaymentTarget } from '@/components/attendance/PaymentConfirmModal';
import { circuitFinanceService } from '@/services';
import { cn, formatBRL } from '@/lib/utils';
import type { FinanceAttendanceRow } from '@/types';

const DAY_OPTIONS = [30, 60, 90, 180];

function circuitLabel(row: FinanceAttendanceRow) {
  const date = new Date(`${row.gameday_date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return `${date} · ${row.gameday_location || 'Sem local'}`;
}

function toTarget(row: FinanceAttendanceRow): PaymentTarget {
  return {
    gamedayId: row.gameday_id,
    playerId: row.player_id,
    playerName: row.player_name,
    amountDue: row.amount_due,
    claimed: row.payment_claimed,
    isReserved: row.is_reserved,
  };
}

function RowStatus({ row }: { row: FinanceAttendanceRow }) {
  if (row.payment_claimed) return <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Avisou que pagou</span>;
  if (row.is_reserved) {
    return (
      <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 inline-flex items-center gap-1">
        <Clock size={10} /> Reservado
      </span>
    );
  }
  return <span className="text-[10px] font-black uppercase tracking-wider text-red">Pendente</span>;
}

export function CircuitFinancePage() {
  const [tab, setTab] = useState<'claims' | 'debtors'>('claims');
  const [days, setDays] = useState(60);
  const [target, setTarget] = useState<PaymentTarget | null>(null);

  const claimsQuery = useQuery({
    queryKey: ['circuit-finance', 'claims'],
    queryFn: circuitFinanceService.claims,
  });
  const debtorsQuery = useQuery({
    queryKey: ['circuit-finance', 'debtors', days],
    queryFn: () => circuitFinanceService.debtors(days),
  });

  // Devedores agrupados por atleta, maior dívida primeiro
  const debtorGroups = useMemo(() => {
    const groups = new Map<number, { name: string; avatar: string | null; isGuest: boolean; total: number; rows: FinanceAttendanceRow[] }>();
    for (const row of debtorsQuery.data ?? []) {
      const g = groups.get(row.player_id) ?? { name: row.player_name, avatar: row.player_avatar, isGuest: row.player_is_guest, total: 0, rows: [] };
      g.total += Number(row.amount_due);
      g.rows.push(row);
      groups.set(row.player_id, g);
    }
    return [...groups.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [debtorsQuery.data]);

  const claims = claimsQuery.data ?? [];
  const claimsTotal = claims.reduce((sum, r) => sum + Number(r.amount_due), 0);
  const debtTotal = debtorGroups.reduce((sum, [, g]) => sum + g.total, 0);

  const active = tab === 'claims' ? claimsQuery : debtorsQuery;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link to="/finance" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary mb-2">
          <ChevronLeft size={14} /> Painel financeiro
        </Link>
        <h1 className="page-title flex items-center gap-3">
          <Wallet className="text-red" /> Cobranças dos Circuitos
        </h1>
        <p className="text-text-secondary text-sm">Confira os avisos de pagamento e acompanhe quem ainda está devendo.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {([
          ['claims', BellRing, 'Avisaram que pagaram', claims.length, claimsTotal, 'text-amber-400'],
          ['debtors', CircleDollarSign, `Devendo (${days} dias)`, debtorGroups.length, debtTotal, 'text-red'],
        ] as const).map(([key, Icon, label, count, total, color]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'card p-4 text-left transition-colors border',
              tab === key ? 'border-red/50 bg-red/5' : 'border-border hover:border-text-muted'
            )}
          >
            <div className="flex items-center gap-2 text-text-muted text-[11px] font-bold uppercase tracking-wider">
              <Icon size={14} className={color} /> {label}
            </div>
            <p className="text-2xl font-black text-text-primary mt-1">{count}</p>
            <p className="text-xs text-text-secondary">{formatBRL(total)}</p>
          </button>
        ))}
      </div>

      {tab === 'debtors' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-muted">Circuitos dos últimos</span>
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-bold border transition-colors',
                days === d ? 'bg-red text-white border-red' : 'border-border text-text-muted hover:text-text-primary'
              )}
            >
              {d} dias
            </button>
          ))}
        </div>
      )}

      {active.isLoading ? (
        <PageLoading />
      ) : active.error ? (
        <ErrorState onRetry={active.refetch} />
      ) : tab === 'claims' ? (
        claims.length === 0 ? (
          <p className="card p-8 text-center text-text-muted text-sm">Nenhum aviso de pagamento para conferir. 🎉</p>
        ) : (
          <div className="card divide-y divide-border/60">
            {claims.map((row) => (
              <div key={row.attendance_id} className="flex items-center gap-3 p-3 sm:p-4">
                <Avatar name={row.player_name} src={row.player_avatar || undefined} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary truncate">{row.player_name}</p>
                  <p className="text-xs text-text-muted truncate">{circuitLabel(row)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-text-primary">{formatBRL(row.amount_due)}</p>
                  <RowStatus row={row} />
                </div>
                <button onClick={() => setTarget(toTarget(row))} className="btn-primary text-xs px-3 py-2">
                  Conferir
                </button>
              </div>
            ))}
          </div>
        )
      ) : debtorGroups.length === 0 ? (
        <p className="card p-8 text-center text-text-muted text-sm">Ninguém devendo nos últimos {days} dias. 🎉</p>
      ) : (
        <div className="space-y-3">
          {debtorGroups.map(([playerId, g]) => (
            <div key={playerId} className="card p-3 sm:p-4">
              <div className="flex items-center gap-3 mb-2">
                <Avatar name={g.name} src={g.avatar || undefined} size="sm" />
                <p className="flex-1 min-w-0 text-sm font-bold text-text-primary truncate">
                  {g.name}
                  {g.isGuest && <span className="ml-2 text-[9px] uppercase tracking-widest text-blue-400">Conv.</span>}
                </p>
                <p className="text-sm font-black text-red">{formatBRL(g.total)}</p>
              </div>
              <div className="space-y-1.5 pl-11">
                {g.rows.map((row) => (
                  <div key={row.attendance_id} className="flex items-center gap-3 text-xs">
                    <span className="flex-1 min-w-0 truncate text-text-secondary">{circuitLabel(row)}</span>
                    <RowStatus row={row} />
                    <span className="w-20 text-right font-bold text-text-primary">{formatBRL(row.amount_due)}</span>
                    <button
                      onClick={() => setTarget(toTarget(row))}
                      className="px-2.5 py-1 rounded-lg border border-green-500/40 text-green-400 hover:bg-green-500/10 font-bold"
                    >
                      Recebi
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <PaymentConfirmModal target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
