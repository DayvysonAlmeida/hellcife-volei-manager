import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarClock, MapPin } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface OpenCircuit {
  id: number;
  date: string;
  time: string | null;
  time_end: string | null;
  location: string | null;
  description: string | null;
  max_players: number | null;
  total_present: number;
}

interface MyAttendance {
  id: number;
  present: boolean;
  is_waitlist: boolean;
  is_reserved: boolean;
  reserved_until: string | null;
  has_paid: boolean;
  payment_claimed: boolean;
  amount_due: string | number | null;
}

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

// "2026-10-18" no fuso local (new Date("2026-10-18") cairia no dia anterior no Brasil)
function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

/** Situação do atleta no circuito, no texto que ele reconhece. */
function myStatus(me: MyAttendance | undefined): { text: string; tone: 'good' | 'warn' | 'idle'; confirmed: boolean } {
  if (!me?.present) return { text: 'Você ainda não confirmou presença.', tone: 'idle', confirmed: false };
  if (me.is_waitlist) return { text: 'Você está na lista de espera.', tone: 'warn', confirmed: true };
  if (me.is_reserved && !me.has_paid) {
    const until = me.reserved_until ? new Date(me.reserved_until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
    return { text: until ? `Vaga reservada até ${until}. Pague para garantir.` : 'Vaga reservada. Pague para garantir.', tone: 'warn', confirmed: true };
  }
  if (!me.has_paid && !me.payment_claimed && Number(me.amount_due || 0) > 0) {
    return { text: 'Presença confirmada. Pagamento pendente.', tone: 'warn', confirmed: true };
  }
  return { text: 'Presença confirmada.', tone: 'good', confirmed: true };
}

export function NextCircuitCard({ playerId, inactive }: { playerId?: number; inactive?: boolean }) {
  const { data: circuits, isLoading } = useQuery({
    queryKey: ['athlete-open-circuits'],
    queryFn: () =>
      api.get('/attendance/gamedays/?is_closed=false&is_published=true&active_only=true&ordering=date')
        .then((r) => (r.data?.results ?? r.data ?? []) as OpenCircuit[]),
  });
  const next = circuits?.[0];

  const { data: detail } = useQuery({
    queryKey: ['athlete-circuit-detail', next?.id],
    queryFn: () => api.get(`/attendance/gamedays/${next!.id}/checkin-info/`).then((r) => r.data),
    enabled: !!next?.id && !!playerId,
  });

  if (isLoading) return null;

  if (!next) {
    return (
      <section className="rounded-[24px] border border-border/40 bg-surface/70 p-4 flex items-center gap-3">
        <CalendarClock size={20} className="text-text-muted flex-shrink-0" />
        <p className="text-sm text-text-muted">Nenhum circuito aberto agora. Quando o admin publicar o próximo, ele aparece aqui.</p>
      </section>
    );
  }

  const date = parseDate(next.date);
  const me: MyAttendance | undefined = detail?.players?.find((p: { id: number }) => p.id === playerId);
  const status = myStatus(me);
  const time = [hhmm(next.time), hhmm(next.time_end)].filter(Boolean).join(' – ');
  const filled = next.max_players ? Math.min(100, (next.total_present / next.max_players) * 100) : null;

  return (
    <section className="rounded-[24px] border border-secondary/50 bg-surface/80 p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">Próximo circuito</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary-hover">Aberto</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-16 flex-shrink-0 rounded-xl border border-secondary/40 bg-surface-highlight/60 py-1.5 text-center">
          <div className="font-display text-3xl leading-none text-text-primary">{date.getDate()}</div>
          <div className="text-[9px] font-black tracking-[0.14em] text-text-muted">{MONTHS[date.getMonth()]} · {WEEKDAYS[date.getDay()]}</div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <p className="font-bold text-text-primary truncate">{next.description || 'Circuito'}</p>
          {(time || next.location) && (
            <p className="text-xs text-text-muted flex items-center gap-1 min-w-0">
              {time && <span className="flex-shrink-0 font-semibold text-text-primary">{time}</span>}
              {time && next.location && <span aria-hidden>·</span>}
              {next.location && <><MapPin size={12} className="flex-shrink-0" /><span className="truncate">{next.location}</span></>}
            </p>
          )}
          <p className="text-xs text-text-muted">
            {next.max_players ? `${next.total_present} de ${next.max_players} vagas preenchidas` : `${next.total_present} confirmados`}
          </p>
          {filled != null && (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-secondary-hover" style={{ width: `${filled}%` }} />
            </div>
          )}
        </div>
      </div>

      {inactive ? (
        <p className="text-xs text-text-muted">Seu cadastro está inativo. Fale com um admin para voltar a confirmar presença.</p>
      ) : (
        <>
          <p className={cn('text-xs font-semibold',
            status.tone === 'good' && 'text-green-400',
            status.tone === 'warn' && 'text-amber-400',
            status.tone === 'idle' && 'text-text-muted',
          )}>
            {status.text}
          </p>
          <Link
            to="/athlete/checkin"
            className={cn(
              'block rounded-xl py-3 text-center text-xs font-black uppercase tracking-[0.14em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red/60',
              status.confirmed
                ? 'border border-border/50 text-text-primary hover:bg-white/5'
                : 'bg-red text-white hover:bg-primary-hover'
            )}
          >
            {status.confirmed ? 'Ver circuito' : 'Confirmar presença'}
          </Link>
        </>
      )}
    </section>
  );
}
