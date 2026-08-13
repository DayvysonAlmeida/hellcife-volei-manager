import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Volleyball, Check, Clock, UserPlus, Search, Loader2, CalendarCheck, Wallet, Copy, Zap, X, Plus, Users, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { PageLoading } from '@/components/ui/Loading';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { LocationMapModal } from '@/components/ui/LocationMapModal';
import { formatDate } from '@/lib/utils';
import { cn, getPositionClass } from '@/lib/utils';

function CircuitCheckinCard({ circuit, myPlayer }: { circuit: any, myPlayer: any }) {
  const qc = useQueryClient();
  const [guestSearch, setGuestSearch] = useState('');
  const [showAllGuests, setShowAllGuests] = useState(false);

  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPosition, setGuestPosition] = useState('Outro');
  const [useFreeGuest, setUseFreeGuest] = useState(false);

  const { data: circuitDetail } = useQuery({
    queryKey: ['athlete-circuit-detail', circuit.id],
    queryFn: () => api.get(`/attendance/gamedays/${circuit.id}/checkin-info/`).then(r => r.data),
    refetchInterval: 10000,
  });

  const { data: sub } = useQuery({
    queryKey: ['my_subscription'],
    queryFn: async () => {
      try {
        const res = await api.get('/subscriptions/user-subscriptions/my_subscription/');
        return res.data;
      } catch (err: any) {
        if (err.response?.status === 404) return null;
        throw err;
      }
    },
    retry: false,
  });

  const currentCycle = sub?.current_cycle;
  const plan = sub?.plan;
  const hasCredits = sub?.status === 'active' && currentCycle && Number(currentCycle.credits_balance) >= 1;
  const freeGuestsUsed = currentCycle ? currentCycle.free_guests_used : 0;
  const freeGuestsTotal = plan ? plan.free_guests : 0;
  const guestsAvailable = freeGuestsTotal - freeGuestsUsed >= 0 ? freeGuestsTotal - freeGuestsUsed : 0;

  const checkinMutation = useMutation({
    mutationFn: (playerId: number) =>
      api.post(`/attendance/gamedays/${circuit.id}/public-checkin/`, { player_id: playerId }).then(r => r.data),
    onSuccess: (res) => {
      if (res.present) {
        toast.success('Presença confirmada! Nos vemos na quadra! 🏐', { duration: 4000 });
      } else if (res.is_waitlist) {
        toast('Você entrou na Fila de Espera!', { icon: '⏳' });
      }
      qc.invalidateQueries({ queryKey: ['athlete-circuit-detail', circuit.id] });
      qc.invalidateQueries({ queryKey: ['athlete-open-circuits'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Erro ao confirmar presença.');
    },
  });

  const addGuestMutation = useMutation({
    mutationFn: (data: any) =>
      api.post(`/attendance/gamedays/${circuit.id}/public-add-guest/`, data).then(r => r.data),
    onSuccess: (res) => {
      toast.success(res.detail || 'Convidado adicionado!');
      setShowGuestModal(false);
      setGuestName('');
      setGuestPosition('Outro');
      setUseFreeGuest(false);
      qc.invalidateQueries({ queryKey: ['athlete-circuit-detail', circuit.id] });
      qc.invalidateQueries({ queryKey: ['my_subscription'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Erro ao adicionar convidado.');
    },
  });

  const guestCheckinMutation = useMutation({
    mutationFn: (guestId: number) =>
      api.post(`/attendance/gamedays/${circuit.id}/public-checkin/`, { player_id: guestId }).then(r => r.data),
    onSuccess: (res, guestId) => {
      const guest = circuitDetail?.players?.find((p: any) => p.id === guestId);
      toast.success(`${guest?.name || 'Convidado'} adicionado à lista! ${res.is_waitlist ? '(Fila de espera)' : '✅'}`, { duration: 4000 });
      qc.invalidateQueries({ queryKey: ['athlete-circuit-detail', circuit.id] });
      setGuestSearch('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Erro ao adicionar convidado.');
    },
  });

  const claimPaymentMutation = useMutation({
    mutationFn: (playerId: number) =>
      api.post(`/attendance/gamedays/${circuit.id}/claim-payment/`, { player_id: playerId }).then(r => r.data),
    onSuccess: () => {
      toast.success('Aviso enviado! O administrador irá confirmar em breve. 💰');
      qc.invalidateQueries({ queryKey: ['athlete-circuit-detail', circuit.id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Erro ao avisar pagamento.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (playerId: number) =>
      api.post(`/attendance/gamedays/${circuit.id}/cancel-checkin/`, { player_id: playerId }).then(r => r.data),
    onSuccess: () => {
      toast.success('Presença cancelada com sucesso.');
      qc.invalidateQueries({ queryKey: ['athlete-circuit-detail', circuit.id] });
      qc.invalidateQueries({ queryKey: ['athlete-open-circuits'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Erro ao cancelar presença.');
    },
  });

  const myAttendance = myPlayer && circuitDetail?.players?.find((p: any) => p.id === myPlayer.id);
  const amPresent = myAttendance?.present;
  const amWaitlist = myAttendance?.is_waitlist;

  const safePrice = circuit.court_price ? Number(String(circuit.court_price).replace(',', '.')) : 0;
  const pricePerPlayer = safePrice > 0 && circuitDetail?.gameday?.total_present > 0
    ? (safePrice / circuitDetail.gameday.total_present).toFixed(2)
    : null;

  const presentPlayers = circuitDetail?.players?.filter((p: any) => p.present) || [];
  const validOveralls = presentPlayers.filter((p: any) => p.latest_overall > 0);
  const avgOverall = validOveralls.length > 0
    ? (validOveralls.reduce((sum: number, p: any) => sum + p.latest_overall, 0) / validOveralls.length).toFixed(1)
    : null;

  return (
    <div className="space-y-4 mb-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden card p-4 sm:p-6 border-l-4 border-l-green-500 shadow-lg"
      >
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-red/5 blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border/30 pb-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-[10px] font-bold uppercase tracking-wider">Aberto</span>
            </div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="font-display text-xl text-text-primary tracking-wider leading-none">
                {circuit.location || 'PELADA'}
              </h1>
              {circuit.location && (
                <LocationMapModal 
                  location={circuit.location} 
                  buttonText="Ver no Mapa" 
                  className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded uppercase font-bold" 
                />
              )}
            </div>
            <p className="text-text-muted text-xs font-medium">{formatDate(circuit.date)}</p>
            {(circuit.time || circuit.time_end) && (
              <p className="text-text-muted text-[10px] flex items-center gap-1 mt-0.5">
                <Clock size={11} />
                {circuit.time}{circuit.time_end && ` – ${circuit.time_end}`}
              </p>
            )}
          </div>
          <div className="w-full sm:w-auto text-center sm:text-right flex-shrink-0 bg-surface-highlight/30 px-4 py-2 sm:px-3 sm:py-1.5 rounded-xl border border-border/50 flex flex-row sm:flex-col items-center justify-between sm:items-end gap-2 sm:gap-0">
            <div className="flex flex-col items-start sm:items-end">
              <p className="font-display text-2xl text-text-primary leading-none">{circuitDetail?.gameday?.total_present ?? circuit.total_present ?? 0}</p>
              <p className="text-text-muted text-[9px] sm:text-[10px] uppercase tracking-wider mt-0.5">Confirmados</p>
              {circuit.max_players && (
                <p className="text-text-muted/60 text-[9px]">/ {circuit.max_players} vagas</p>
              )}
            </div>
            {avgOverall && (
              <div className="inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-500 text-[10px] px-2 py-1 sm:px-1.5 sm:py-0.5 rounded border border-yellow-500/20 font-bold tracking-wider" title="Média de Overall dos confirmados">
                <Zap size={10} className="fill-yellow-500/50" /> {avgOverall}
              </div>
            )}
          </div>
        </div>

        {safePrice > 0 && (amPresent || amWaitlist) && (
          <div className="mb-3">
            {circuitDetail?.gameday?.total_present > 0 ? (
              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-2.5 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-green-400 font-bold text-xs">
                  <Wallet size={14} /> Rateio: R$ {pricePerPlayer}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(circuit.pix_key || 'hellcifevolei@gmail.com');
                    toast.success('Chave PIX copiada! 💸');
                  }}
                  className="w-full bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 text-green-400 font-bold rounded flex items-center justify-center gap-2 py-1.5 text-xs transition-colors"
                >
                  <Copy size={13} /> Copiar PIX ({circuit.pix_key || 'hellcifevolei@gmail.com'})
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-green-400/70 text-[10px] bg-green-500/5 border border-green-500/10 rounded p-2">
                <Wallet size={12} /> Rateio exibido quando houver confirmados
              </div>
            )}
          </div>
        )}

        {myPlayer && (
          <div className="bg-surface-highlight/40 rounded-xl p-3 border border-border/30 mt-3">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Avatar name={myPlayer.display_name} src={myPlayer.avatar_url} size="sm" />
                <div>
                  <p className="text-text-primary text-sm font-medium leading-none">{myPlayer.display_name}</p>
                  <div className="mt-1">
                    <PositionBadge position={myPlayer.main_position} />
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {amPresent ? (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                      <Check size={12} /> Conf.
                    </span>
                    {safePrice === 0 && (
                      <button onClick={() => cancelMutation.mutate(myPlayer.id)} disabled={cancelMutation.isPending} className="p-1 text-red hover:bg-red/10 rounded" title="Cancelar Presença">
                        {cancelMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                      </button>
                    )}
                  </div>
                ) : amWaitlist ? (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      <Clock size={12} /> Fila
                    </span>
                    <button onClick={() => cancelMutation.mutate(myPlayer.id)} disabled={cancelMutation.isPending} className="p-1 text-red hover:bg-red/10 rounded" title="Sair da Fila">
                      {cancelMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                    </button>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-black/20 text-text-muted border border-border">
                    Ausente
                  </span>
                )}
              </div>
            </div>

            {!amPresent && !amWaitlist && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => checkinMutation.mutate(myPlayer.id)}
                disabled={checkinMutation.isPending}
                className={`w-full flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl transition-all border ${hasCredits ? 'bg-red hover:bg-red-hover text-white border-red shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-surface-hover hover:bg-surface-highlight text-text-primary border-border/50 hover:border-text-muted'}`}
              >
                {checkinMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : hasCredits ? (
                  <Zap size={16} className="text-white fill-white/20" />
                ) : (
                  <CalendarCheck size={16} />
                )}
                {hasCredits ? 'Confirmar (Usar 1 Crédito)' : 'Confirmar Presença'}
              </motion.button>
            )}

            {amPresent && !myAttendance?.has_paid && (
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <div className="flex-1 text-center bg-green-500/10 text-green-400 rounded py-2.5 sm:py-2 text-xs font-medium border border-green-500/20 flex items-center justify-center">
                  ✅ Presença garantida!
                </div>
                {myAttendance?.payment_claimed ? (
                  <div className="flex-1 text-center bg-orange-500/10 text-orange-400 rounded py-2.5 sm:py-2 text-xs font-bold border border-orange-500/30 flex items-center justify-center animate-pulse">
                    ⏳ Em Análise
                  </div>
                ) : (
                  <button
                    onClick={() => claimPaymentMutation.mutate(myPlayer.id)}
                    disabled={claimPaymentMutation.isPending}
                    className="flex-1 btn-primary py-2.5 sm:py-2 text-xs font-bold bg-yellow-500 text-yellow-950 hover:bg-yellow-400 border-none flex items-center justify-center gap-1"
                  >
                    {claimPaymentMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : '💰 Já Paguei o PIX'}
                  </button>
                )}
              </div>
            )}

            {amPresent && myAttendance?.has_paid && (
              <div className="flex items-center justify-center gap-2 text-center bg-green-500/20 text-green-400 rounded py-2 text-xs font-bold border border-green-500/40 mt-2">
                {myAttendance?.used_credit ? <Zap size={14} className="fill-green-400/20" /> : '✅'}
                {myAttendance?.used_credit ? 'Pago via Plano!' : 'Pago e Confirmado!'}
              </div>
            )}

            {amWaitlist && (
              <div className="text-center bg-yellow-500/10 text-yellow-400 rounded py-2 text-xs font-medium border border-yellow-500/20 mt-2">
                ⏳ Fila de espera
              </div>
            )}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card p-4"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue/10 flex items-center justify-center text-blue-400">
            <UserPlus size={16} />
          </div>
          <div>
            <h2 className="font-display text-base text-text-primary tracking-wider leading-none">CONVIDADOS</h2>
            <p className="text-text-muted text-[10px] mt-0.5">Buscar convidados na lista</p>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={guestSearch}
              onChange={e => setGuestSearch(e.target.value)}
              placeholder="Buscar..."
              className="input w-full pl-8 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={() => setShowAllGuests(true)}
            className="btn-outline px-3 py-1.5 text-[10px] sm:text-xs whitespace-nowrap flex items-center gap-1 border-border/30 hover:bg-surface-highlight rounded-lg"
            title="Ver todos os convidados"
          >
            <Users size={14} /> Ver Todos
          </button>
        </div>

        {guestSearch.trim().length >= 2 ? (
          <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
            {circuitDetail?.players?.filter((p: any) =>
              p.is_guest && !p.present && !p.is_waitlist &&
              (guestSearch === '' || p.name.toLowerCase().includes(guestSearch.toLowerCase()))
            ).map((guest: any) => (
              <motion.div
                key={guest.id}
                className="flex items-center gap-2 p-2 bg-surface-highlight/50 rounded-lg border border-border/30"
              >
                <Avatar name={guest.name} src={guest.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-xs font-bold truncate">{guest.name}</p>
                  {guest.invited_by && (
                    <p className="text-text-muted text-[9px] truncate">Por {guest.invited_by}</p>
                  )}
                </div>
                <button
                  onClick={() => guestCheckinMutation.mutate(guest.id)}
                  disabled={guestCheckinMutation.isPending}
                  className="btn-primary text-[10px] px-2.5 py-1 flex items-center gap-1 rounded"
                >
                  {guestCheckinMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />} Adicionar
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-text-muted text-[10px] sm:text-xs bg-surface/30 rounded-lg border border-border/20 flex flex-col items-center gap-2">
            <Search size={16} className="opacity-50" />
            <p>Digite o nome para buscar os convidados.</p>
          </div>
        )}
        
        <button
          onClick={() => setShowGuestModal(true)}
          className="w-full mt-4 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl border border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-all"
        >
          <Users size={16} />
          Adicionar Convidado
        </button>
      </motion.div>

      {/* Guest Modal */}
      <AnimatePresence>
        {showGuestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border-2 border-border shadow-[0_0_40px_rgba(217,4,41,0.2)] rounded-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/40">
                <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Users className="text-blue-400" size={18} />
                  Novo Convidado
                </h2>
                <button onClick={() => setShowGuestModal(false)} className="text-white/50 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-black text-white/60 uppercase tracking-widest mb-1.5 ml-1">Nome do Convidado</label>
                  <input 
                    type="text" 
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 outline-none transition-all"
                    placeholder="Nome e Sobrenome"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-black text-white/60 uppercase tracking-widest mb-1.5 ml-1">Posição Principal</label>
                  <select 
                    value={guestPosition}
                    onChange={(e) => setGuestPosition(e.target.value)}
                    className="w-full bg-[#111] border-2 border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 outline-none transition-all"
                  >
                    <option value="Outro">Selecione...</option>
                    <option value="Ponteiro">Ponteiro</option>
                    <option value="Central">Central</option>
                    <option value="Oposto">Oposto</option>
                    <option value="Levantador">Levantador</option>
                    <option value="Líbero">Líbero</option>
                  </select>
                </div>
                
                {guestsAvailable > 0 && (
                  <label className="flex items-center gap-3 bg-blue-500/10 border-2 border-blue-500/30 p-3 rounded-xl cursor-pointer hover:bg-blue-500/20 transition-colors mt-2">
                    <input 
                      type="checkbox" 
                      checked={useFreeGuest}
                      onChange={(e) => setUseFreeGuest(e.target.checked)}
                      className="w-5 h-5 accent-blue-500 rounded bg-transparent"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-white text-sm">Usar Cota Grátis</span>
                      <span className="text-[10px] text-blue-400 uppercase tracking-widest">Você tem {guestsAvailable} sobrando</span>
                    </div>
                  </label>
                )}
                
                {!useFreeGuest && (
                  <div className="text-[10px] text-white/50 text-center uppercase tracking-widest mt-2 border border-white/10 p-2 rounded-lg bg-black/20">
                    O convidado pagará o rateio normal do circuito.
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-white/10 bg-black/40">
                <button 
                  onClick={() => addGuestMutation.mutate({ player_id: myPlayer.id, name: guestName, main_position: guestPosition, use_free_guest: useFreeGuest })}
                  disabled={!guestName || addGuestMutation.isPending}
                  className="w-full btn-primary bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2 py-3 text-sm tracking-widest disabled:opacity-50"
                >
                  {addGuestMutation.isPending ? <Loader2 className="animate-spin" /> : <Users size={18} />}
                  Adicionar à Fila de Espera
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card p-4"
      >
        <div className="mb-3 border-b border-border/30 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Check size={16} className="text-green-400" />
            <h2 className="font-display text-base text-text-primary tracking-wider">
              CONFIRMADOS ({presentPlayers.length})
            </h2>
          </div>
          {presentPlayers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(['outside', 'setter', 'middle', 'opposite', 'libero', 'universal'] as const).map(pos => {
                const count = presentPlayers.filter((p: any) => p.main_position === pos).length;
                if (count === 0) return null;
                const labels: Record<string, string> = {
                  outside: 'Ponteiros', setter: 'Levantadores', middle: 'Centrais', 
                  opposite: 'Opostos', libero: 'Líberos', universal: 'Universais'
                };
                const colorClass = getPositionClass(pos as any);
                return (
                  <span key={pos} className={`text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${colorClass}`}>
                    {count} {labels[pos] || pos}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="space-y-1">
          {presentPlayers.map((p: any, i: number) => (
            <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-border/10 last:border-0 hover:bg-surface-highlight/30 px-1 rounded transition-colors">
              <span className="text-text-muted/40 text-[10px] w-4 text-right flex-shrink-0 font-bold">{i + 1}</span>
              <Avatar name={p.name} src={p.avatar_url} size="sm" className="w-6 h-6 text-[10px]" />
              <span className={cn('text-xs flex-1 truncate', p.id === myPlayer?.id ? 'text-red font-bold' : 'text-text-primary font-medium')}>
                {p.name}
              </span>
              {p.is_guest && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue/10 text-blue-400 border border-blue/20 truncate max-w-[100px]">
                  {p.invited_by ? `Conv. por ${p.invited_by}` : 'Convidado'}
                </span>
              )}
              <Check size={12} className="text-green-400 flex-shrink-0 ml-auto" />
            </div>
          ))}
          {presentPlayers.length === 0 && (
            <p className="text-text-muted text-xs text-center py-4 bg-black/10 rounded-lg">Nenhum confirmado ainda.</p>
          )}
        </div>
      </motion.div>

      {circuitDetail?.players && circuitDetail.players.filter((p: any) => p.is_waitlist).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-4 border-l-4 border-l-yellow-500"
        >
          <div className="flex items-center gap-2 mb-3 border-b border-border/30 pb-2">
            <Clock size={16} className="text-yellow-400" />
            <h2 className="font-display text-base text-text-primary tracking-wider">
              FILA DE ESPERA ({circuitDetail.players.filter((p: any) => p.is_waitlist).length})
            </h2>
          </div>
          <div className="space-y-1">
            {circuitDetail.players
              .filter((p: any) => p.is_waitlist)
              .map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-border/10 last:border-0 hover:bg-surface-highlight/30 px-1 rounded transition-colors">
                  <span className="text-text-muted/40 text-[10px] w-4 text-right flex-shrink-0 font-bold">{i + 1}</span>
                  <Avatar name={p.name} src={p.avatar_url} size="sm" className="w-6 h-6 text-[10px]" />
                  <span className={cn('text-xs flex-1 truncate', p.id === myPlayer?.id ? 'text-yellow-500 font-bold' : 'text-text-primary font-medium')}>
                    {p.name}
                  </span>
                  <div className="flex flex-col items-end gap-1">
                    {p.is_priority && (
                      <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded uppercase font-bold border border-amber-500/20 flex items-center gap-1">
                        <Crown size={10} /> VIP
                      </span>
                    )}
                    {p.is_guest && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue/10 text-blue-400 border border-blue/20 truncate max-w-[100px]">
                        {p.invited_by ? `Conv. por ${p.invited_by}` : 'Convidado'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </motion.div>
      )}

      {showAllGuests && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111] border border-border w-full max-w-md rounded-[1.25rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/30 bg-surface/30">
              <h3 className="font-display font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-blue-400" /> Convidados da Base
              </h3>
              <button onClick={() => setShowAllGuests(false)} className="text-text-muted hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-2">
              {(() => {
                const allAvailableGuests = circuitDetail?.players?.filter((p: any) => p.is_guest && !p.present && !p.is_waitlist) || [];
                return allAvailableGuests.length > 0 ? (
                  allAvailableGuests.map((guest: any) => (
                    <div key={guest.id} className="flex items-center gap-3 p-2 bg-surface/50 rounded-lg border border-border/20">
                      <Avatar name={guest.name} src={guest.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-text-primary text-sm font-bold truncate">{guest.name}</p>
                        {guest.invited_by && <p className="text-text-muted text-[10px] truncate">Por {guest.invited_by}</p>}
                      </div>
                      <button
                        onClick={() => {
                          guestCheckinMutation.mutate(guest.id);
                          setShowAllGuests(false);
                          setGuestSearch('');
                        }}
                        disabled={guestCheckinMutation.isPending}
                        className="btn-primary text-xs px-3 py-1 flex items-center gap-1 rounded"
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-text-muted text-sm">
                    Todos os convidados cadastrados já estão no circuito.
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AthleteCheckinPage() {
  const [searchParams] = useSearchParams();
  const circuitId = searchParams.get('circuitId');

  const { data: myPlayer, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['athlete-me'],
    queryFn: () => api.get('/players/me/').then(r => r.data),
  });

  const { data: openCircuits, isLoading } = useQuery({
    queryKey: ['athlete-open-circuits'],
    queryFn: async () => {
      const res = await api.get(`/attendance/gamedays/?is_closed=false&is_published=true&ordering=date`);
      return res.data.results || res.data;
    },
  });

  if (isLoading || isLoadingProfile) return <PageLoading />;

  let circuitsToDisplay = openCircuits || [];
  if (circuitId) {
    circuitsToDisplay = circuitsToDisplay.filter((c: any) => c.id === Number(circuitId));
  }

  if (!circuitsToDisplay || circuitsToDisplay.length === 0) {
    return (
      <div className="space-y-6">
        <div className="card p-12 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <Volleyball size={64} className="text-text-muted/20 mx-auto mb-4" />
          </motion.div>
          <h2 className="font-display text-2xl text-text-primary tracking-wider mb-2">SEM CIRCUITO ABERTO</h2>
          <p className="text-text-muted text-sm">Não há nenhum circuito aberto no momento.</p>
          <p className="text-text-muted/60 text-xs mt-1">Fique ligado no grupo para as próximas datas!</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {circuitsToDisplay.map((circuit: any) => (
        <CircuitCheckinCard key={circuit.id} circuit={circuit} myPlayer={myPlayer} />
      ))}
    </div>
  );
}
