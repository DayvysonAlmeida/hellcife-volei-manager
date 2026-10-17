import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CalendarCheck, Loader2, Wallet, Search, Flame, Zap, Crown, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { PageLoading } from '@/components/ui/Loading';
import { formatDate, formatBRL } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Avatar } from '@/components/ui/Avatar';
import { LocationMapModal } from '@/components/ui/LocationMapModal';
import { CopyPixButton, ReservationCountdown } from '@/components/attendance/ReservationInfo';
import * as Dialog from '@radix-ui/react-dialog';

interface ReservationResult {
  playerName: string;
  amountDue: number;
  reservedUntil: string | null;
}

export function CheckinPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'guests'>('members');
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: number; name: string } | null>(null);
  // Atleta com conta no app confirma pelo próprio login
  const [loginPrompt, setLoginPrompt] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState<ReservationResult | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['public-checkin', id],
    queryFn: () => api.get(`/attendance/gamedays/${id}/checkin-info/`).then(r => r.data),
    enabled: !!id,
  });

  const checkinMutation = useMutation({
    mutationFn: (playerId: number) => 
      api.post(`/attendance/gamedays/${id}/public-checkin/`, { player_id: playerId }).then(r => r.data),
    onSuccess: (res, playerId) => {
      if (res.present) {
        toast.success('Presença confirmada!', { icon: '✅' });
      } else if (res.is_reserved) {
        const player = data?.players?.find((p: any) => p.id === playerId);
        setReservation({
          playerName: player?.name || 'Atleta',
          amountDue: Number(res.amount_due ?? 0),
          reservedUntil: res.reserved_until ?? null,
        });
      } else if (res.is_waitlist) {
        toast.success(res.detail || 'Você entrou na Fila de Espera!', { icon: '⏳', style: { border: '1px solid #eab308' } });
      } else {
        toast.success('Presença cancelada.', { icon: '❌' });
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Erro ao fazer check-in.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['public-checkin', id] });
    }
  });

  if (isLoading) return <PageLoading />;

  if (!data || !data.gameday) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-8 text-center max-w-sm w-full">
          <CalendarCheck size={48} className="text-red mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-text-primary mb-2">Pelada não encontrada</h2>
          <p className="text-text-muted">Verifique se o link está correto.</p>
        </div>
      </div>
    );
  }

  const { gameday, players } = data;
  const filteredPlayers = players.filter((p: any) => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.invited_by && p.invited_by.toLowerCase().includes(search.toLowerCase()))
  );

  const presentPlayers = filteredPlayers.filter((p: any) => p.present);
  const waitlistPlayers = filteredPlayers.filter((p: any) => !p.present && p.is_waitlist).sort((a: any, b: any) => {
    if (a.is_priority !== b.is_priority) return a.is_priority ? -1 : 1;
    if (a.is_guest !== b.is_guest) return a.is_guest ? 1 : -1;
    if (a.waitlist_joined_at && b.waitlist_joined_at) {
      return new Date(a.waitlist_joined_at).getTime() - new Date(b.waitlist_joined_at).getTime();
    }
    return 0;
  });
  const reservedPlayers = filteredPlayers.filter((p: any) => p.is_reserved);
  const absentPlayers = filteredPlayers.filter((p: any) => !p.present && !p.is_waitlist && !p.is_reserved);
  const absentMembers = absentPlayers.filter((p: any) => !p.is_guest);
  const absentGuests = absentPlayers.filter((p: any) => p.is_guest);
  const displayedAbsent = activeTab === 'members' ? absentMembers : absentGuests;

  // Valor por pessoa vem do backend (rateio ou taxa do evento)
  const price = Number(gameday.price_per_person ?? 0);
  const needsPayment = !!gameday.requires_prepayment && price > 0;
  const pixKey = gameday.pix_key || 'hellcifevolei@gmail.com';

  return (
    <div className="min-h-screen pb-10 bg-[#050508] animate-fade-in text-white selection:bg-red/30">
      {/* ── Header E-Sports Premium c/ Raios ── */}
      <div className="relative border-b border-white/10 p-4 pt-6 sm:p-6 sm:pt-8 sticky top-0 z-20 shadow-[0_4px_30px_rgba(0,0,0,0.5)] backdrop-blur-3xl bg-[#050508]/80 overflow-hidden group/header">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-red/20 blur-[80px] rounded-full mix-blend-screen animate-[pulse_3s_ease-in-out_infinite]" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-600/20 blur-[90px] rounded-full mix-blend-screen animate-[pulse_4s_ease-in-out_infinite]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          
          <svg className="absolute inset-0 w-full h-full opacity-30 group-hover/header:opacity-50 transition-opacity duration-700 scale-110" preserveAspectRatio="none" viewBox="0 0 1000 300" fill="none">
            <path d="M-50,50 L200,100 L150,150 L400,20 L350,120 L600,0 L500,200 L800,50 L750,250 L1050,-50" stroke="url(#paint0_linear)" strokeWidth="2" filter="url(#glow)"/>
            <path d="M-50,250 L200,150 L150,200 L400,50 L350,180 L600,250 L500,100 L800,200 L750,50 L1050,300" stroke="url(#paint1_linear)" strokeWidth="1" filter="url(#glow)"/>
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <linearGradient id="paint0_linear" x1="0" y1="0" x2="1000" y2="300" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ef4444" />
                <stop offset="0.5" stopColor="#a855f7" />
                <stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="paint1_linear" x1="1000" y1="0" x2="0" y2="300" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3b82f6" />
                <stop offset="0.5" stopColor="#ef4444" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 mb-2">
            <div className="relative group cursor-pointer shrink-0">
              <div className="absolute inset-0 bg-red blur-lg opacity-40 group-hover:opacity-70 transition-opacity rounded-full"></div>
              <img src="/escudo-hellcife.webp" alt="Hellcife Vôlei" className="relative w-16 h-16 sm:w-24 sm:h-24 object-contain drop-shadow-2xl hover:scale-105 transition-transform" />
            </div>
            <div className="flex flex-col items-center sm:items-start">
              <h1 className="font-display text-3xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 uppercase tracking-widest drop-shadow-[0_2px_20px_rgba(255,255,255,0.3)] leading-none">
                Check-in <span className="bg-clip-text text-transparent bg-gradient-to-r from-red to-orange-500">Público</span>
              </h1>
              <h2 className="text-sm sm:text-xl font-bold text-white/90 tracking-wide mt-1">{formatDate(gameday.date)}</h2>
            </div>
          </div>
          
          {gameday.location && (
            <div className="flex justify-center mt-2 mb-1">
              <LocationMapModal 
                location={gameday.location} 
                buttonText="Ver no Mapa" 
                className="text-[10px] sm:text-xs bg-red/10 hover:bg-red/20 text-red-400 border border-red/30 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full uppercase font-bold transition-colors backdrop-blur-md" 
              />
            </div>
          )}
          {(gameday.time || gameday.time_end) && (
            <p className="text-white/60 text-sm font-medium uppercase tracking-[0.2em] mt-2">
              {gameday.time ? gameday.time.slice(0, 5) : ''} {gameday.time_end ? `às ${gameday.time_end.slice(0, 5)}` : ''}
            </p>
          )}
          
          <div className="mt-2 sm:mt-4 flex flex-col items-center justify-center gap-2">
            <span className="bg-red/10 text-red px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold shadow-[0_0_10px_rgba(217,4,41,0.2)]">
              {gameday.total_present} / {gameday.max_players || '∞'} confirmados
            </span>

            {price > 0 && (
              <div className="bg-card-gradient border border-green-500/30 text-green-500 p-2 sm:p-4 rounded-xl w-full flex flex-col items-center justify-center gap-2 shadow-card mt-1">
                <div className="flex items-center gap-2 font-bold text-base sm:text-lg">
                  <Wallet size={18} />
                  {gameday.pricing_type === 'fixed' ? 'Taxa' : 'Rateio'}: {formatBRL(price)}
                </div>
                {needsPayment && (
                  <p className="text-[11px] sm:text-xs text-green-500/80 text-center">
                    Sua vaga fica reservada e é confirmada quando o pagamento for confirmado
                    {gameday.reservation_hold_minutes ? ` (prazo de ${gameday.reservation_hold_minutes >= 60 ? `${gameday.reservation_hold_minutes / 60}h` : `${gameday.reservation_hold_minutes}min`})` : ''}.
                  </p>
                )}
                <CopyPixButton pixKey={pixKey} className="w-full py-2 text-xs sm:text-sm border border-green-500/40" />
              </div>
            )}
          </div>

          <div className="mt-3 relative group/search max-w-2xl mx-auto">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search size={20} className="text-white/40 group-focus-within:text-red-400 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Busque seu nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border-2 border-white/10 rounded-2xl pl-11 pr-3 py-3 text-white placeholder-white/30 text-base font-medium focus:outline-none focus:border-red-500/50 focus:bg-white/10 transition-all shadow-[0_0_30px_rgba(0,0,0,0.5)]"
            />
          </div>

          {/* Botões Flutuantes de Filtro */}
          {absentPlayers.length > 0 && (
            <div className="mt-3 flex justify-center animate-fade-in-up">
              <div className="inline-flex bg-[#111]/80 backdrop-blur-2xl border border-white/10 p-1.5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                <button
                  onClick={() => setActiveTab('members')}
                  className={`px-6 py-2.5 text-xs sm:text-sm uppercase tracking-wider font-black rounded-full transition-all duration-300 ${
                    activeTab === 'members'
                      ? 'bg-red text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-105'
                      : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  Membros ({absentMembers.length})
                </button>
                <button
                  onClick={() => setActiveTab('guests')}
                  className={`px-6 py-2.5 text-xs sm:text-sm uppercase tracking-wider font-black rounded-full transition-all duration-300 ${
                    activeTab === 'guests'
                      ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-105'
                      : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  Convidados ({absentGuests.length})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-4 mt-2 animate-slide-in">
        {filteredPlayers.length === 0 ? (
          <p className="text-center text-text-muted py-8 text-lg font-medium">Nenhum jogador encontrado com "{search}".</p>
        ) : (
          <div className="space-y-8">
            {presentPlayers.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 ml-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                  Confirmados ({presentPlayers.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {presentPlayers.map((player: any) => (
                    <div
                      key={player.id}
                      className="w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all bg-card-gradient border-red/40 shadow-[0_0_12px_rgba(217,4,41,0.15)] opacity-95"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={player.name} src={player.avatar_url} size="md" className="ring-2 ring-red/50" />
                        <div className="flex flex-col items-start text-left">
                          <span className="font-bold text-base text-red tracking-wide">
                            {player.name}
                          </span>
                          {player.used_credit && (
                            <span className="text-[10px] bg-red/10 text-red px-1.5 py-0.5 rounded uppercase font-bold mt-0.5 border border-red/20 flex items-center gap-1 w-fit">
                              <Zap size={10} className="fill-red/20" /> Plano
                            </span>
                          )}
                          {player.is_guest && (
                            <span className="text-[10px] bg-blue/10 text-blue px-1.5 py-0.5 rounded uppercase font-bold mt-0.5 w-fit">
                              Convidado {player.invited_by ? `por: ${player.invited_by}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-red shadow-neon-red">
                        <Check size={20} className="text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reservedPlayers.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-orange-400 uppercase tracking-widest mb-4 ml-2 mt-8 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  Aguardando pagamento ({reservedPlayers.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reservedPlayers.map((player: any) => (
                    <div
                      key={player.id}
                      className="w-full flex items-center justify-between p-3 rounded-xl border-2 bg-card-gradient border-orange-500/30"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={player.name} src={player.avatar_url} size="md" className="ring-2 ring-orange-500/40" />
                        <div className="flex flex-col items-start text-left min-w-0">
                          <span className="font-bold text-base text-orange-300 tracking-wide truncate">{player.name}</span>
                          {player.is_guest && (
                            <span className="text-[10px] bg-blue/10 text-blue px-1.5 py-0.5 rounded uppercase font-bold mt-0.5 w-fit">
                              Convidado {player.invited_by ? `por: ${player.invited_by}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] font-bold uppercase text-right">
                        {player.payment_claimed
                          ? <span className="text-amber-400">Em análise</span>
                          : <ReservationCountdown until={player.reserved_until} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {waitlistPlayers.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-widest mb-4 ml-2 mt-8 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                  Fila de Espera ({waitlistPlayers.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {waitlistPlayers.map((player: any, idx: number) => (
                    <div
                      key={player.id}
                      className="w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all bg-card-gradient border-yellow-500/40 shadow-[0_0_12px_rgba(234,179,8,0.15)] opacity-95"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 text-center font-black text-yellow-500 text-lg">
                          {idx + 1}º
                        </div>
                        <Avatar name={player.name} src={player.avatar_url} size="md" className="ring-2 ring-yellow-500/50" />
                        <div className="flex flex-col items-start text-left">
                          <span className="font-bold text-base text-yellow-500 tracking-wide">
                            {player.name}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {player.is_priority && (
                              <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded uppercase font-bold border border-amber-500/20 flex items-center gap-1">
                                <Crown size={10} /> VIP
                              </span>
                            )}
                            {player.used_credit && (
                              <span className="text-[10px] bg-red/10 text-red px-1.5 py-0.5 rounded uppercase font-bold border border-red/20 flex items-center gap-1">
                                <Zap size={10} className="fill-red/20" /> Plano
                              </span>
                            )}
                          </div>
                          {player.is_guest && (
                            <span className="text-[10px] bg-blue/10 text-blue px-1.5 py-0.5 rounded uppercase font-bold mt-0.5 w-fit">
                              Convidado {player.invited_by ? `por: ${player.invited_by}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-yellow-500/80 uppercase">
                        Aguardando
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {absentPlayers.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-4 ml-2 mt-8">
                  Pendentes para Check-in
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedAbsent.length === 0 ? (
                    <p className="text-center text-white/40 py-8 bg-[#111]/50 rounded-2xl border border-white/5 col-span-full">
                      {activeTab === 'members' ? 'Nenhum membro pendente.' : 'Nenhum convidado pendente.'}
                    </p>
                  ) : (
                    displayedAbsent.map((player: any) => (
                      <button
                        key={player.id}
                        onClick={() => player.has_account && !isAuthenticated
                          ? setLoginPrompt(player.name)
                          : setSelectedPlayer({ id: player.id, name: player.name })}
                        disabled={checkinMutation.isPending}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border border-border/50 transition-all bg-card-gradient shadow-card group hover:shadow-neon ${activeTab === 'guests' ? 'hover:border-blue/50 hover:shadow-neon-blue' : 'hover:border-red/50 hover:shadow-neon-red'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={player.name} src={player.avatar_url} size="md" className={`ring-1 ring-border opacity-70 group-hover:opacity-100 transition-all ${activeTab === 'guests' ? 'group-hover:ring-blue/50' : 'group-hover:ring-red/50'}`} />
                          <div className="flex flex-col items-start text-left">
                            <span className={`font-medium text-base text-text-primary transition-colors ${activeTab === 'guests' ? 'group-hover:text-blue' : 'group-hover:text-red'}`}>
                              {player.name}
                            </span>
                            {player.used_credit && (
                              <span className="text-[10px] bg-red/10 text-red px-1.5 py-0.5 rounded uppercase font-bold mt-0.5 border border-red/20 flex items-center gap-1 w-fit">
                                <Zap size={10} className="fill-red/20" /> Plano
                              </span>
                            )}
                            {player.is_guest && (
                              <span className="text-[10px] bg-blue/10 text-blue px-1.5 py-0.5 rounded uppercase font-bold mt-0.5 w-fit">
                                Convidado {player.invited_by ? `por: ${player.invited_by}` : ''}
                              </span>
                            )}
                            {player.has_account && !isAuthenticated && (
                              <span className="text-[10px] text-text-muted mt-0.5 flex items-center gap-1">
                                <Smartphone size={10} /> Confirme pelo app
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-surface border-2 border-border-subtle transition-colors ${activeTab === 'guests' ? 'group-hover:border-blue/40' : 'group-hover:border-red/40'}`}>
                          {checkinMutation.isPending && checkinMutation.variables === player.id ? (
                            <Loader2 size={18} className="text-text-muted animate-spin" />
                          ) : null}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog.Root open={!!reservation} onOpenChange={(open) => !open && setReservation(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92%] max-w-sm bg-surface border border-orange-500/30 p-6 rounded-2xl shadow-2xl text-center">
            <Dialog.Title className="font-display text-2xl tracking-wider text-text-primary">Vaga reservada! ⏳</Dialog.Title>
            <Dialog.Description className="text-text-secondary text-sm mt-2">
              <strong className="text-text-primary">{reservation?.playerName}</strong>, faça o PIX de{' '}
              <strong className="text-green-400">{formatBRL(reservation?.amountDue)}</strong> para confirmar a vaga.
            </Dialog.Description>
            {reservation?.reservedUntil && (
              <p className="mt-3 text-sm font-bold"><ReservationCountdown until={reservation.reservedUntil} /></p>
            )}
            <CopyPixButton pixKey={pixKey} className="w-full mt-4 py-3 text-sm border border-green-500/40" />
            <p className="text-[11px] text-text-muted mt-4">
              Depois de pagar, avise pelo app em <Link to="/login" className="text-red font-bold hover:underline">Entrar</Link>{' '}
              (Check-in → "Já paguei") ou mostre o comprovante para a organização.
            </p>
            <Dialog.Close asChild>
              <button className="btn-secondary w-full mt-4 py-2 text-sm font-bold">Fechar</button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        isOpen={!!selectedPlayer}
        onOpenChange={(open) => !open && setSelectedPlayer(null)}
        title={needsPayment ? 'Reservar Vaga' : 'Confirmar Presença'}
        description={
          !selectedPlayer ? '' : needsPayment
            ? `Reservar a vaga de ${selectedPlayer.name}? O valor é ${formatBRL(price)} via PIX, e a vaga só é confirmada depois do pagamento.`
            : `Tem certeza que deseja confirmar a presença de ${selectedPlayer.name} nesta pelada?`
        }
        onConfirm={() => selectedPlayer && checkinMutation.mutate(selectedPlayer.id)}
        confirmText={needsPayment ? 'Reservar' : 'Confirmar Presença'}
        cancelText="Cancelar"
        isDestructive={false}
      />

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
