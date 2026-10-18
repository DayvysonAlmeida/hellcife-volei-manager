import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck, CalendarDays, Check, Clock, Crown, Hourglass, Loader2, Lock, LogIn, MapPin, Search, Smartphone, Wallet, X, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as Dialog from '@radix-ui/react-dialog';
import api from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { PageLoading } from '@/components/ui/Loading';
import { cn, formatBRL } from '@/lib/utils';
import { reservationTimeLeft } from '@/lib/reservation';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { LocationMapModal } from '@/components/ui/LocationMapModal';
import { CopyPixButton, ReservationCountdown } from '@/components/attendance/ReservationInfo';
import { POSITION_LABELS, type Position } from '@/types';

interface PublicPlayer {
  id: number;
  name: string;
  present: boolean;
  is_waitlist: boolean;
  waitlist_joined_at: string | null;
  payment_claimed: boolean;
  used_credit: boolean;
  is_priority: boolean;
  is_reserved: boolean;
  reserved_until: string | null;
  main_position: string;
  is_guest: boolean;
  invited_by: string | null;
  has_account: boolean;
  avatar_url: string | null;
}

interface PublicGameday {
  id: number;
  date: string;
  location: string | null;
  description: string | null;
  total_present: number;
  max_players: number;
  pix_key: string | null;
  pricing_type: 'split' | 'fixed';
  price_per_person: string | number | null;
  requires_prepayment: boolean;
  reservation_hold_minutes: number | null;
  total_reserved: number;
  time: string | null;
  time_end: string | null;
  is_closed: boolean;
}

interface ReservationResult {
  playerName: string;
  amountDue: number;
  reservedUntil: string | null;
}

type Tab = 'confirm' | 'list';
type CheckinMode = 'confirm' | 'reserve' | 'waitlist';

const MODE_LABEL: Record<CheckinMode, string> = {
  confirm: 'Confirmar presença',
  reserve: 'Reservar vaga',
  waitlist: 'Entrar na fila',
};

const ROW_ACTION: Record<CheckinMode, string> = {
  confirm: 'Confirmar',
  reserve: 'Reservar',
  waitlist: 'Fila',
};

/** "SÁB • 18 OUT 2026", sem passar por fuso horário (a data vem como AAAA-MM-DD). */
function circuitDateLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${weekday} • ${String(d).padStart(2, '0')} ${month} ${y}`.toUpperCase();
}

function holdLabel(minutes: number) {
  return minutes >= 60 ? `${minutes / 60}h` : `${minutes} min`;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function matchesSearch(player: PublicPlayer, term: string) {
  const t = term.trim().toLowerCase();
  return !t || player.name.toLowerCase().includes(t) || (player.invited_by ?? '').toLowerCase().includes(t);
}

/** Mesma ordem do "promover da fila": VIP, depois membros, depois quem chegou antes. */
function byWaitlistOrder(a: PublicPlayer, b: PublicPlayer) {
  if (a.is_priority !== b.is_priority) return a.is_priority ? -1 : 1;
  if (a.is_guest !== b.is_guest) return a.is_guest ? 1 : -1;
  if (a.waitlist_joined_at && b.waitlist_joined_at) {
    return new Date(a.waitlist_joined_at).getTime() - new Date(b.waitlist_joined_at).getTime();
  }
  return 0;
}

export function CheckinPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('confirm');
  const [group, setGroup] = useState<'members' | 'guests'>('members');
  const [selectedPlayer, setSelectedPlayer] = useState<PublicPlayer | null>(null);
  // Atleta com conta no app confirma pelo próprio login
  const [loginPrompt, setLoginPrompt] = useState<string | null>(null);
  const [reservation, setReservation] = useState<ReservationResult | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ gameday: PublicGameday; players: PublicPlayer[] }>({
    queryKey: ['public-checkin', id],
    queryFn: () => api.get(`/attendance/gamedays/${id}/checkin-info/`).then(r => r.data),
    enabled: !!id,
  });

  /** Depois de confirmar, mostra o atleta na lista. */
  const showInList = (playerId: number) => {
    setSearch('');
    setTab('list');
    setHighlightId(playerId);
  };

  const checkinMutation = useMutation({
    mutationFn: (playerId: number) =>
      api.post(`/attendance/gamedays/${id}/public-checkin/`, { player_id: playerId }).then(r => r.data),
    onSuccess: (res, playerId) => {
      if (res.present) {
        toast.success('Presença confirmada! Bom jogo 🏐');
      } else if (res.is_reserved) {
        const player = data?.players.find(p => p.id === playerId);
        setReservation({
          playerName: player?.name || 'Atleta',
          amountDue: Number(res.amount_due ?? 0),
          reservedUntil: res.reserved_until ?? null,
        });
      } else if (res.is_waitlist) {
        toast.success(res.detail || 'Você entrou na fila de espera!', { icon: '⏳' });
      }
      showInList(playerId);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Não foi possível confirmar. Tente de novo.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['public-checkin', id] });
    },
  });

  // Rola até o atleta recém-confirmado e tira o destaque depois de alguns segundos
  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(`player-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setHighlightId(null), 6000);
    return () => clearTimeout(timer);
  }, [highlightId, data]);

  if (isLoading) return <PageLoading />;

  if (!data?.gameday) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="card p-8 text-center max-w-sm w-full">
          <CalendarCheck size={48} className="text-red mx-auto mb-4 opacity-50" />
          <h1 className="text-xl font-bold text-text-primary mb-2">Circuito não encontrado</h1>
          <p className="text-text-muted">Verifique se o link está correto.</p>
        </div>
      </div>
    );
  }

  const { gameday, players } = data;
  const isClosed = gameday.is_closed;

  // Valor por pessoa vem do backend (rateio ou taxa do evento)
  const price = Number(gameday.price_per_person ?? 0);
  const needsPayment = gameday.requires_prepayment && price > 0;
  const hold = gameday.reservation_hold_minutes;
  const pixKey = gameday.pix_key || 'hellcifevolei@gmail.com';

  // Contagens sempre sobre a lista inteira (a busca só filtra o que aparece)
  const maxPlayers = gameday.max_players || 0;
  const occupied = gameday.total_present + gameday.total_reserved;
  const freeSpots = maxPlayers ? Math.max(maxPlayers - occupied, 0) : null;
  const isFull = freeSpots === 0;
  const waitlistTotal = players.filter(p => p.is_waitlist && !p.present).length;

  const visible = players.filter(p => matchesSearch(p, search));
  const confirmed = visible.filter(p => p.present);
  const reserved = visible.filter(p => p.is_reserved);
  const waitlist = visible.filter(p => !p.present && p.is_waitlist).sort(byWaitlistOrder);
  const pending = visible.filter(p => !p.present && !p.is_waitlist && !p.is_reserved);
  const pendingMembers = pending.filter(p => !p.is_guest);
  const pendingGuests = pending.filter(p => p.is_guest);
  const listCount = confirmed.length + reserved.length + waitlist.length;

  const searching = search.trim() !== '';
  const hasGuests = players.some(p => p.is_guest && !p.present && !p.is_waitlist && !p.is_reserved);
  const shownPending = searching || !hasGuests ? pending : group === 'members' ? pendingMembers : pendingGuests;

  const modeFor = (p: PublicPlayer): CheckinMode =>
    p.is_guest || isFull ? 'waitlist' : needsPayment ? 'reserve' : 'confirm';

  const onPendingClick = (p: PublicPlayer) => {
    if (p.has_account && !isAuthenticated) setLoginPrompt(p.name);
    else setSelectedPlayer(p);
  };

  const title = gameday.location || gameday.description || 'Circuito';
  const timeLabel = gameday.time
    ? `${gameday.time.slice(0, 5)}${gameday.time_end ? ` às ${gameday.time_end.slice(0, 5)}` : ''}`
    : null;

  const spotsChip = isClosed
    ? { text: 'Encerrado', tone: 'border-border bg-surface-highlight text-text-muted' }
    : freeSpots === null
    ? { text: 'Sem limite', tone: 'border-blue-400/30 bg-blue/20 text-blue-300' }
    : isFull
    ? { text: 'Lista cheia', tone: 'border-red/40 bg-red/15 text-red-400' }
    : freeSpots <= 3
    ? { text: freeSpots === 1 ? 'Última vaga!' : `Últimas ${freeSpots} vagas!`, tone: 'border-amber-400/40 bg-amber-400/10 text-amber-300' }
    : { text: plural(freeSpots, 'vaga livre', 'vagas livres'), tone: 'border-blue-400/30 bg-blue/20 text-blue-300' };

  const spotsSummary = [
    plural(gameday.total_present, 'confirmado', 'confirmados'),
    gameday.total_reserved > 0 && `${gameday.total_reserved} aguardando pagamento`,
    waitlistTotal > 0 && `${waitlistTotal} na fila`,
  ].filter(Boolean).join(' · ');

  const selectedMode = selectedPlayer ? modeFor(selectedPlayer) : 'confirm';
  const modeNote: Record<CheckinMode, string> = {
    confirm: price > 0 ? `O valor de ${formatBRL(price)} é pago pelo PIX do grupo.` : 'Sua presença entra na lista na hora.',
    reserve: hold
      ? `Sua vaga fica reservada por ${holdLabel(hold)}. Ela só é confirmada depois que o pagamento for confirmado.`
      : 'Sua vaga fica reservada até o pagamento ser confirmado.',
    waitlist: selectedPlayer?.is_guest
      ? 'Convidados entram na fila de espera. Os membros têm prioridade na lista.'
      : needsPayment
      ? 'A lista está cheia. Se abrir uma vaga, ela fica reservada pra você pagar.'
      : 'A lista está cheia. Você entra na fila e sobe se abrir uma vaga.',
  };

  return (
    <div className="min-h-screen bg-background text-text-primary pb-12">
      {/* ── Cabeçalho do circuito (rola junto com a página) ── */}
      <header className="relative overflow-hidden border-b border-border/30">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-red/15 via-red/[0.03] to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 pt-5 pb-6 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/escudo-hellcife.webp" alt="" className="w-10 h-10 object-contain shrink-0" />
              <div className="leading-tight min-w-0">
                <p className="font-display text-lg tracking-wider">
                  <span className="text-red">HELLCIFE</span> <span className="text-blue-400">VÔLEI</span>
                </p>
                <p className="text-[11px] uppercase tracking-[0.15em] text-text-muted truncate">Lista de presença</p>
              </div>
            </div>
            {!isAuthenticated && (
              <Link
                to="/login"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3.5 py-2 text-xs font-bold text-text-secondary hover:text-text-primary hover:border-border transition-colors"
              >
                <LogIn size={14} /> Entrar
              </Link>
            )}
          </div>

          <h1 className="mt-5 font-display text-4xl sm:text-5xl tracking-wide uppercase leading-none break-words">{title}</h1>
          {gameday.description && gameday.location && (
            <p className="mt-2 text-sm text-text-secondary">{gameday.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
            <span className="inline-flex items-center gap-1.5 font-semibold tracking-wide">
              <CalendarDays size={16} className="text-red" /> {circuitDateLabel(gameday.date)}
            </span>
            {timeLabel && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={16} className="text-red" /> {timeLabel}
              </span>
            )}
            {gameday.location && (
              <LocationMapModal location={gameday.location} buttonText="Ver no mapa" className="text-sm font-semibold" />
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <section aria-label="Vagas" className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">Vagas</p>
                  <p className="mt-1 font-display leading-none">
                    <span className={cn('text-4xl sm:text-5xl', isFull && !isClosed ? 'text-red' : 'text-text-primary')}>{occupied}</span>
                    {maxPlayers > 0 && <span className="text-2xl text-text-muted">/{maxPlayers}</span>}
                  </p>
                </div>
                <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide', spotsChip.tone)}>
                  {spotsChip.text}
                </span>
              </div>
              {maxPlayers > 0 && (
                <div
                  role="progressbar"
                  aria-label="Vagas ocupadas"
                  aria-valuemin={0}
                  aria-valuemax={maxPlayers}
                  aria-valuenow={Math.min(occupied, maxPlayers)}
                  className="mt-3 h-2 rounded-full bg-surface-highlight overflow-hidden"
                >
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-500',
                      isFull ? 'bg-red' : freeSpots !== null && freeSpots <= 3 ? 'bg-amber-400' : 'bg-blue-500'
                    )}
                    style={{ width: `${Math.min((occupied / maxPlayers) * 100, 100)}%` }}
                  />
                </div>
              )}
              <p className="mt-3 text-xs text-text-secondary">{spotsSummary}</p>
            </section>

            {price > 0 && (
              <section aria-label="Pagamento" className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">
                      {gameday.pricing_type === 'fixed' ? 'Taxa do evento' : 'Rateio da quadra'}
                    </p>
                    <p className="mt-1 leading-none">
                      <span className="font-display text-4xl text-green-400">{formatBRL(price)}</span>
                      <span className="ml-1.5 text-xs text-text-muted">por pessoa</span>
                    </p>
                  </div>
                  <CopyPixButton pixKey={pixKey} className="shrink-0 px-4 py-2.5 text-sm border border-green-500/30" />
                </div>
                <p className="mt-3 text-xs text-text-secondary">
                  {needsPayment
                    ? `A vaga é confirmada depois que o pagamento for confirmado${hold ? ` (prazo de ${holdLabel(hold)} para pagar)` : ''}.`
                    : 'Pague pelo PIX do grupo.'}
                </p>
              </section>
            )}
          </div>

          {isClosed && (
            <div role="status" className="mt-3 flex items-start gap-3 rounded-xl border border-red/30 bg-red/10 p-4">
              <Lock size={18} className="mt-0.5 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-bold">Inscrições encerradas</p>
                <p className="mt-0.5 text-xs text-text-secondary">A organização fechou a lista deste circuito.</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Busca e abas (única parte fixa ao rolar) ── */}
      <div className="sticky top-0 z-20 border-b border-border/30 bg-background/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:px-6 space-y-3">
          <label className="relative block">
            <span className="sr-only">Buscar atleta</span>
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              enterKeyHint="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Busque seu nome..."
              className="input w-full pl-11 pr-11 py-3 text-base"
            />
            {searching && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-text-muted hover:text-text-primary"
              >
                <X size={16} />
              </button>
            )}
          </label>

          {!isClosed && (
            <div role="tablist" aria-label="Seções" className="grid grid-cols-2 gap-1 rounded-xl border border-border/40 bg-surface p-1 lg:hidden">
              <TabButton active={tab === 'confirm'} onClick={() => setTab('confirm')} count={pending.length}>
                Confirmar presença
              </TabButton>
              <TabButton active={tab === 'list'} onClick={() => setTab('list')} count={listCount}>
                Lista
              </TabButton>
            </div>
          )}
        </div>
      </div>

      <main className={cn('max-w-5xl mx-auto px-4 pt-4 sm:px-6', !isClosed && 'lg:grid lg:grid-cols-2 lg:gap-8')}>
        {!isClosed && (
          <section aria-labelledby="pending-heading" className={cn(tab === 'confirm' ? 'block' : 'hidden', 'lg:block')}>
            <h2 id="pending-heading" className="sr-only lg:not-sr-only lg:block lg:mb-3 font-display text-xl tracking-wider">
              Confirmar presença
            </h2>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-text-secondary">Toque no seu nome para confirmar.</p>
              {hasGuests && !searching && (
                <div className="inline-flex rounded-lg border border-border/40 bg-surface p-0.5 text-xs font-bold">
                  {([['members', 'Membros', pendingMembers.length], ['guests', 'Convidados', pendingGuests.length]] as const).map(([value, label, n]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={group === value}
                      onClick={() => setGroup(value)}
                      className={cn(
                        'rounded-md px-3 py-1.5 transition-colors',
                        group === value ? 'bg-surface-highlight text-text-primary' : 'text-text-muted hover:text-text-primary'
                      )}
                    >
                      {label} ({n})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {shownPending.length > 0 ? (
              <ul className="space-y-2">
                {shownPending.map(player => {
                  const needsLogin = player.has_account && !isAuthenticated;
                  const busy = checkinMutation.isPending && checkinMutation.variables === player.id;
                  return (
                    <li key={player.id}>
                      <button
                        type="button"
                        onClick={() => onPendingClick(player)}
                        disabled={checkinMutation.isPending}
                        className="group w-full flex items-center gap-3 rounded-xl border border-border/30 bg-surface/70 p-3 text-left transition-colors hover:border-red/50 hover:bg-surface-highlight/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/60 disabled:opacity-60"
                      >
                        <Avatar name={player.name} src={player.avatar_url ?? undefined} size="md" className="shrink-0" />
                        <PlayerInfo
                          player={player}
                          extra={needsLogin && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                              <Smartphone size={12} /> Tem conta no app
                            </span>
                          )}
                        />
                        <span
                          className={cn(
                            'ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition-colors',
                            needsLogin
                              ? 'border border-border text-text-secondary group-hover:text-text-primary'
                              : 'bg-red text-white group-hover:bg-red-dark'
                          )}
                        >
                          {busy ? <Loader2 size={14} className="animate-spin" /> : needsLogin ? <LogIn size={14} /> : <Check size={14} />}
                          {needsLogin ? 'Entrar' : ROW_ACTION[modeFor(player)]}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyBox>
                {searching
                  ? `Ninguém com "${search.trim()}" aguardando confirmação.`
                  : players.some(p => !p.present && !p.is_waitlist && !p.is_reserved)
                  ? group === 'members' ? 'Nenhum membro pendente.' : 'Nenhum convidado pendente.'
                  : 'Todo mundo já confirmou! 🏐'}
              </EmptyBox>
            )}

            {searching && shownPending.length === 0 && listCount > 0 && (
              <CrossHint onClick={() => setTab('list')} action="Ver na lista">
                {listCount === 1 ? <><strong>{[...confirmed, ...reserved, ...waitlist][0].name}</strong> já está na lista.</> : `${listCount} nomes encontrados na lista.`}
              </CrossHint>
            )}
          </section>
        )}

        <section aria-labelledby="list-heading" className={cn(tab === 'list' || isClosed ? 'block' : 'hidden', 'lg:block')}>
          <h2 id="list-heading" className="sr-only lg:not-sr-only lg:block lg:mb-3 font-display text-xl tracking-wider">
            Lista
          </h2>

          {listCount === 0 ? (
            <>
              <EmptyBox>
                {searching ? `Ninguém com "${search.trim()}" na lista.` : 'Ninguém confirmou ainda.'}
                {!searching && !isClosed && (
                  <button type="button" onClick={() => setTab('confirm')} className="lg:hidden mt-3 block mx-auto text-sm font-bold text-red hover:underline">
                    Seja o primeiro a confirmar
                  </button>
                )}
              </EmptyBox>
              {searching && pending.length > 0 && !isClosed && (
                <CrossHint onClick={() => setTab('confirm')} action="Confirmar presença">
                  {pending.length === 1 ? <><strong>{pending[0].name}</strong> ainda não confirmou.</> : `${pending.length} nomes ainda não confirmaram.`}
                </CrossHint>
              )}
            </>
          ) : (
            <div className="space-y-6">
              {confirmed.length > 0 && (
                <ListSection title="Confirmados" count={confirmed.length} dotClass="bg-green-500" titleClass="text-green-400">
                  {confirmed.map(player => (
                    <ListRow key={player.id} player={player} highlight={player.id === highlightId}>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-500/15 text-green-400" title="Confirmado">
                        <Check size={16} strokeWidth={3} />
                        <span className="sr-only">Confirmado</span>
                      </span>
                    </ListRow>
                  ))}
                </ListSection>
              )}

              {reserved.length > 0 && (
                <ListSection title="Aguardando pagamento" count={reserved.length} dotClass="bg-amber-400" titleClass="text-amber-300">
                  {reserved.map(player => (
                    <ListRow key={player.id} player={player} highlight={player.id === highlightId}>
                      {player.payment_claimed ? (
                        <span className="text-amber-300">Em análise</span>
                      ) : reservationTimeLeft(player.reserved_until) ? (
                        <ReservationCountdown until={player.reserved_until} />
                      ) : (
                        <span className="text-amber-300">Aguardando</span>
                      )}
                    </ListRow>
                  ))}
                </ListSection>
              )}

              {waitlist.length > 0 && (
                <ListSection title="Fila de espera" count={waitlist.length} dotClass="bg-yellow-400" titleClass="text-yellow-300">
                  {waitlist.map((player, idx) => (
                    <ListRow
                      key={player.id}
                      player={player}
                      highlight={player.id === highlightId}
                      leading={<span className="w-7 shrink-0 text-center font-display text-xl text-yellow-300">{idx + 1}º</span>}
                    >
                      <span className="text-text-muted">Na fila</span>
                    </ListRow>
                  ))}
                </ListSection>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="mt-12 text-center text-[11px] uppercase tracking-[0.25em] text-text-muted">Hellcife Vôlei</footer>

      {/* ── Confirmação antes do check-in ── */}
      <Dialog.Root open={!!selectedPlayer} onOpenChange={(open) => !open && setSelectedPlayer(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="font-display text-2xl tracking-wider">{MODE_LABEL[selectedMode]}</Dialog.Title>
              <Dialog.Close
                className="-m-1 rounded-md p-1 text-text-muted hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red/60"
                aria-label="Fechar"
              >
                <X size={20} />
              </Dialog.Close>
            </div>
            {selectedPlayer && (
              <div className="mt-4 flex items-center gap-3">
                <Avatar name={selectedPlayer.name} src={selectedPlayer.avatar_url ?? undefined} size="lg" className="shrink-0" />
                <p className="text-lg font-bold leading-tight break-words">{selectedPlayer.name}</p>
              </div>
            )}
            <dl className="mt-4 space-y-2 rounded-xl border border-border/30 bg-background/60 p-3 text-sm">
              <DetailRow icon={<CalendarDays size={15} />}>{circuitDateLabel(gameday.date)}{timeLabel && ` · ${timeLabel}`}</DetailRow>
              {gameday.location && <DetailRow icon={<MapPin size={15} />}>{gameday.location}</DetailRow>}
              {price > 0 && <DetailRow icon={<Wallet size={15} />}>{formatBRL(price)} por pessoa</DetailRow>}
            </dl>
            <Dialog.Description className="mt-3 text-sm text-text-secondary">{modeNote[selectedMode]}</Dialog.Description>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button type="button" className="btn-secondary px-4 py-2.5 text-sm">Cancelar</button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => {
                  if (selectedPlayer) checkinMutation.mutate(selectedPlayer.id);
                  setSelectedPlayer(null);
                }}
                className="btn-primary px-4 py-2.5 text-sm"
              >
                {MODE_LABEL[selectedMode]}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ── Vaga reservada: instruções de pagamento ── */}
      <Dialog.Root open={!!reservation} onOpenChange={(open) => !open && setReservation(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-amber-400/30 bg-surface p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
              <Hourglass size={22} />
            </div>
            <Dialog.Title className="mt-3 font-display text-2xl tracking-wider">Vaga reservada</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-text-secondary">
              <strong className="text-text-primary">{reservation?.playerName}</strong>, faça o PIX para confirmar a vaga.
            </Dialog.Description>
            <p className="mt-4 font-display text-5xl leading-none text-green-400">{formatBRL(reservation?.amountDue)}</p>
            {reservation?.reservedUntil && (
              <p className="mt-2 text-sm font-bold"><ReservationCountdown until={reservation.reservedUntil} /></p>
            )}
            <CopyPixButton pixKey={pixKey} className="mt-5 w-full py-3 text-sm border border-green-500/40" />
            <p className="mt-4 text-xs text-text-muted">
              Depois de pagar, avise pelo app em <Link to="/login" className="font-bold text-red hover:underline">Entrar</Link>{' '}
              (Check-in → "Já paguei") ou mostre o comprovante para a organização.
            </p>
            <Dialog.Close asChild>
              <button type="button" className="btn-secondary mt-4 w-full py-2.5 text-sm">Fechar</button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        isOpen={!!loginPrompt}
        onOpenChange={(open) => !open && setLoginPrompt(null)}
        title="Confirme pelo app"
        description={`${loginPrompt ?? ''} tem conta no app. Entre com o seu login para confirmar a presença.`}
        onConfirm={() => navigate('/login')}
        confirmText="Entrar"
        cancelText="Voltar"
        isDestructive={false}
      />
    </div>
  );
}

function TabButton({ active, onClick, count, children }: { active: boolean; onClick: () => void; count: number; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2 py-2.5 text-[13px] font-bold transition-colors',
        active ? 'bg-red text-white shadow-neon-red' : 'text-text-muted hover:text-text-primary'
      )}
    >
      {children}
      <span className={cn('rounded-full px-1.5 py-0.5 text-[11px] leading-none', active ? 'bg-white/20' : 'bg-surface-highlight')}>{count}</span>
    </button>
  );
}

function PlayerInfo({ player, extra }: { player: PublicPlayer; extra?: ReactNode }) {
  const position = player.main_position in POSITION_LABELS ? (player.main_position as Position) : null;
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-[15px] font-semibold leading-tight">{player.name}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {position && <PositionBadge position={position} />}
        {player.is_guest && (
          <span className="rounded-full border border-blue-400/30 bg-blue/20 px-2 py-0.5 text-[11px] font-bold text-blue-300">Convidado</span>
        )}
        {player.is_priority && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400">
            <Crown size={11} /> VIP
          </span>
        )}
        {player.used_credit && (
          <span className="inline-flex items-center gap-1 rounded-full border border-red/30 bg-red/10 px-2 py-0.5 text-[11px] font-bold text-red-400">
            <Zap size={11} /> Plano
          </span>
        )}
        {extra}
      </div>
    </div>
  );
}

function ListSection({ title, count, dotClass, titleClass, children }: {
  title: string; count: number; dotClass: string; titleClass: string; children: ReactNode;
}) {
  return (
    <div>
      <h3 className={cn('mb-2 ml-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em]', titleClass)}>
        <span className={cn('h-2 w-2 rounded-full', dotClass)} />
        {title} • {count}
      </h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function ListRow({ player, highlight, leading, children }: {
  player: PublicPlayer; highlight: boolean; leading?: ReactNode; children: ReactNode;
}) {
  return (
    <li
      id={`player-${player.id}`}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3 transition-colors duration-500',
        highlight ? 'border-green-500/60 bg-green-500/10 ring-2 ring-green-500/30' : 'border-border/30 bg-surface/70'
      )}
    >
      {leading}
      <Avatar name={player.name} src={player.avatar_url ?? undefined} size="md" className="shrink-0" />
      <PlayerInfo player={player} />
      <div className="ml-auto shrink-0 text-right text-xs font-bold">{children}</div>
    </li>
  );
}

function DetailRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-text-secondary">
      <dt className="mt-0.5 shrink-0 text-red">{icon}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function EmptyBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/30 bg-surface/50 px-4 py-8 text-center text-sm text-text-muted">{children}</div>
  );
}

function CrossHint({ onClick, action, children }: { onClick: () => void; action: string; children: ReactNode }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-blue-400/30 bg-blue/10 p-3 text-sm text-text-secondary lg:hidden">
      <p className="min-w-0">{children}</p>
      <button type="button" onClick={onClick} className="shrink-0 text-xs font-bold uppercase tracking-wide text-blue-300 hover:text-blue-200">
        {action}
      </button>
    </div>
  );
}
