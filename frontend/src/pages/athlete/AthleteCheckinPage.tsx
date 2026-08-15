import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Volleyball, Check, Clock, UserPlus, Search, Loader2, CalendarCheck, Wallet, Copy, Zap, X, Plus, Users, Crown, ChevronDown, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { PageLoading } from '@/components/ui/Loading';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { LocationMapModal } from '@/components/ui/LocationMapModal';
import { formatDate } from '@/lib/utils';
import { cn, getPositionClass } from '@/lib/utils';

// ─── Card expandido de check-in ────────────────────────────────────────────────
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

  const totalPresent = circuitDetail?.gameday?.total_present ?? circuit.total_present ?? 0;
  const waitlistCount = circuitDetail?.players?.filter((p: any) => p.is_waitlist).length ?? 0;

  return (
    <div className="space-y-4 mb-2">
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        {/* Top bar with map and overall */}
        <div className="flex justify-between items-center mb-4 px-1">
          {circuit.location ? (
            <LocationMapModal 
              location={circuit.location} 
              buttonText="Ver Local no Mapa" 
              className="text-[10px] bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 px-3 py-1.5 rounded-full uppercase font-bold flex items-center gap-1.5 transition-colors" 
            />
          ) : <div />}
          
          {avgOverall && (
            <div className="inline-flex items-center gap-1.5 bg-yellow-500/10 text-yellow-500 text-[10px] px-3 py-1.5 rounded-full border border-yellow-500/20 font-bold tracking-wider shadow-[0_0_10px_rgba(234,179,8,0.1)]" title="Média de Overall dos confirmados">
              <Zap size={12} className="fill-yellow-500/50" /> {avgOverall} OVERALL
            </div>
          )}
        </div>

        {myPlayer && (
          <div className="relative overflow-hidden bg-gradient-to-br from-surface-highlight/80 to-surface/40 rounded-[1.5rem] p-5 border border-white/5 shadow-xl backdrop-blur-md mb-4">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between gap-3 mb-5 relative z-10">
              <div className="flex items-center gap-3">
                <Avatar name={myPlayer.display_name} src={myPlayer.avatar_url} size="md" className="border-2 border-surface shadow-lg" />
                <div>
                  <p className="text-text-primary text-base font-bold leading-none mb-1.5">{myPlayer.display_name}</p>
                  <PositionBadge position={myPlayer.main_position} />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {amPresent ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-green-500/20 text-green-400 border border-green-500/30">
                      <Check size={12} /> Confirmado
                    </span>
                    {safePrice === 0 && (
                      <button onClick={() => cancelMutation.mutate(myPlayer.id)} disabled={cancelMutation.isPending} className="p-1.5 text-red hover:bg-red/10 rounded-lg transition-colors" title="Cancelar Presença">
                        {cancelMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                      </button>
                    )}
                  </div>
                ) : amWaitlist ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      <Clock size={12} /> Fila
                    </span>
                    <button onClick={() => cancelMutation.mutate(myPlayer.id)} disabled={cancelMutation.isPending} className="p-1.5 text-red hover:bg-red/10 rounded-lg transition-colors" title="Sair da Fila">
                      {cancelMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    </button>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-black/40 text-text-muted border border-white/5">
                    Ausente
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 relative z-10">
              {safePrice > 0 && (amPresent || amWaitlist) && (
                <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                  {circuitDetail?.gameday?.total_present > 0 ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                        <Wallet size={16} /> R$ {pricePerPlayer}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(circuit.pix_key || 'hellcifevolei@gmail.com');
                          toast.success('Chave PIX copiada! 💸');
                        }}
                        className="bg-green-500/10 hover:bg-green-500/20 text-green-400 font-bold rounded-lg px-3 py-1.5 text-xs transition-colors flex items-center gap-1.5"
                      >
                        <Copy size={12} /> Copiar PIX
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-white/40 text-[10px] py-1">
                      <Wallet size={12} /> Rateio será exibido com mais confirmados
                    </div>
                  )}
                </div>
              )}

              {!amPresent && !amWaitlist && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => checkinMutation.mutate(myPlayer.id)}
                  disabled={checkinMutation.isPending}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 text-sm font-black tracking-widest uppercase rounded-xl transition-all border ${hasCredits ? 'bg-red hover:bg-red-hover text-white border-red shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-surface-hover hover:bg-surface-highlight text-text-primary border-border hover:border-text-muted shadow-lg'}`}
                >
                  {checkinMutation.isPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : hasCredits ? (
                    <Zap size={18} className="text-white fill-white/20" />
                  ) : (
                    <CalendarCheck size={18} />
                  )}
                  {hasCredits ? 'Usar 1 Crédito' : 'Confirmar Presença'}
                </motion.button>
              )}

              {amPresent && !myAttendance?.has_paid && (
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <div className="flex-1 text-center bg-green-500/10 text-green-400 rounded-xl py-3 text-xs font-bold border border-green-500/20 flex items-center justify-center">
                    ✅ Vaga Garantida
                  </div>
                  {myAttendance?.payment_claimed ? (
                    <div className="flex-1 text-center bg-orange-500/10 text-orange-400 rounded-xl py-3 text-xs font-black tracking-wider uppercase border border-orange-500/30 flex items-center justify-center animate-pulse">
                      Em Análise
                    </div>
                  ) : (
                    <button
                      onClick={() => claimPaymentMutation.mutate(myPlayer.id)}
                      disabled={claimPaymentMutation.isPending}
                      className="flex-1 btn-primary py-3 text-xs font-black tracking-widest uppercase bg-yellow-500 text-yellow-950 hover:bg-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.3)] border-none flex items-center justify-center gap-1.5 rounded-xl"
                    >
                      {claimPaymentMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Já Paguei PIX'}
                    </button>
                  )}
                </div>
              )}

              {amPresent && myAttendance?.has_paid && (
                <div className="flex items-center justify-center gap-2 text-center bg-green-500/10 text-green-400 rounded-xl py-3 text-xs font-black tracking-widest uppercase border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                  {myAttendance?.used_credit ? <Zap size={14} className="fill-green-400/20" /> : '✅'}
                  {myAttendance?.used_credit ? 'Pago via Plano' : 'Pago e Confirmado'}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Ações de Convidados (Compacto) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-2 mb-4"
      >
        <button
          onClick={() => setShowAllGuests(true)}
          className="flex-1 bg-surface/30 hover:bg-surface/50 border border-white/5 rounded-xl py-2.5 px-2 flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          <Users size={14} className="text-blue-400" />
          <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Base de Convidados</span>
        </button>
        
        <button
          onClick={() => setShowGuestModal(true)}
          className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-xl py-2.5 px-2 flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          <UserPlus size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">Novo Convidado</span>
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

      {/* Lista de confirmados */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-surface/30 rounded-[1.5rem] p-5 border border-white/5 shadow-lg backdrop-blur-sm"
      >
        <div className="mb-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
              <Check size={16} className="text-green-400" />
            </div>
            <h2 className="font-display text-base text-text-primary tracking-widest uppercase">
              Confirmados ({presentPlayers.length})
            </h2>
          </div>
          {presentPlayers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2 bg-black/20 p-2 rounded-xl border border-white/5">
              {(['outside', 'setter', 'middle', 'opposite', 'libero', 'universal'] as const).map(pos => {
                const count = presentPlayers.filter((p: any) => p.main_position === pos).length;
                if (count === 0) return null;
                const labels: Record<string, string> = {
                  outside: 'Ponteiros', setter: 'Levantadores', middle: 'Centrais', 
                  opposite: 'Opostos', libero: 'Líberos', universal: 'Universais'
                };
                const colorClass = getPositionClass(pos as any);
                return (
                  <span key={pos} className={`text-[9px] px-2.5 py-1 rounded-md border font-black uppercase tracking-widest ${colorClass}`}>
                    {count} {labels[pos] || pos}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="space-y-1.5">
          {presentPlayers.map((p: any, i: number) => (
            <div key={p.id} className="flex items-center gap-3 py-2 px-3 bg-black/10 hover:bg-black/30 rounded-xl border border-transparent hover:border-white/5 transition-all">
              <span className="text-text-muted/30 text-[10px] w-4 text-right flex-shrink-0 font-bold">{i + 1}</span>
              <Avatar name={p.name} src={p.avatar_url} size="sm" className="w-8 h-8 border border-white/10" />
              <div className="flex flex-col flex-1 min-w-0">
                <span className={cn('text-sm truncate leading-tight', p.id === myPlayer?.id ? 'text-green-400 font-bold' : 'text-text-primary font-medium')}>
                  {p.name}
                </span>
                {p.is_guest && (
                  <span className="text-[9px] uppercase tracking-wider text-blue-400/80 truncate mt-0.5">
                    {p.invited_by ? `Conv. por ${p.invited_by}` : 'Convidado'}
                  </span>
                )}
              </div>
              <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 flex-shrink-0">
                <Check size={12} className="text-green-400" />
              </div>
            </div>
          ))}
          {presentPlayers.length === 0 && (
            <p className="text-text-muted/60 text-xs text-center py-8 bg-black/20 rounded-xl border border-dashed border-white/10">Nenhum atleta confirmado.</p>
          )}
        </div>
      </motion.div>

      {/* Fila de espera */}
      {circuitDetail?.players && circuitDetail.players.filter((p: any) => p.is_waitlist).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-surface/30 rounded-[1.5rem] p-5 border-l-4 border-l-yellow-500 border-y border-r border-white/5 shadow-lg backdrop-blur-sm mt-4"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
              <Clock size={16} className="text-yellow-400" />
            </div>
            <h2 className="font-display text-base text-text-primary tracking-widest uppercase">
              Fila de Espera ({circuitDetail.players.filter((p: any) => p.is_waitlist).length})
            </h2>
          </div>
          
          <div className="space-y-1.5">
            {circuitDetail.players
              .filter((p: any) => p.is_waitlist)
              .map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-3 py-2 px-3 bg-black/10 hover:bg-black/30 rounded-xl border border-transparent hover:border-white/5 transition-all">
                  <span className="text-text-muted/30 text-[10px] w-4 text-right flex-shrink-0 font-bold">{i + 1}</span>
                  <Avatar name={p.name} src={p.avatar_url} size="sm" className="w-8 h-8 border border-white/10" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className={cn('text-sm truncate leading-tight', p.id === myPlayer?.id ? 'text-yellow-500 font-bold' : 'text-text-primary font-medium')}>
                      {p.name}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {p.is_priority && (
                      <span className="text-[9px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md uppercase font-black tracking-wider border border-amber-500/20 flex items-center gap-1 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                        <Crown size={10} /> VIP
                      </span>
                    )}
                    {p.is_guest && (
                      <span className="text-[9px] uppercase tracking-wider text-blue-400/80 truncate mt-0.5">
                        Convidado
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </motion.div>
      )}

      {/* Modal ver todos os convidados */}
      {showAllGuests && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111] border border-border w-full max-w-md rounded-[1.25rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex flex-col p-4 sm:p-5 border-b border-border/30 bg-surface/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-white flex items-center gap-2">
                  <Users size={18} className="text-blue-400" /> Convidados da Base
                </h3>
                <button onClick={() => setShowAllGuests(false)} className="text-text-muted hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
                  <X size={20} />
                </button>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted/60" />
                <input
                  type="text"
                  value={guestSearch}
                  onChange={e => setGuestSearch(e.target.value)}
                  placeholder="Buscar pelo nome..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:border-blue-500/50 outline-none transition-all placeholder:text-text-muted/40"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-2">
              {(() => {
                const allAvailableGuests = circuitDetail?.players?.filter((p: any) => 
                  p.is_guest && !p.present && !p.is_waitlist &&
                  (guestSearch === '' || p.name.toLowerCase().includes(guestSearch.toLowerCase()))
                ) || [];
                
                return allAvailableGuests.length > 0 ? (
                  allAvailableGuests.map((guest: any) => (
                    <div key={guest.id} className="flex items-center gap-3 p-2 bg-surface/50 rounded-xl border border-border/20">
                      <Avatar name={guest.name} src={guest.avatar_url} size="sm" className="border border-white/5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-text-primary text-sm font-bold truncate">{guest.name}</p>
                        {guest.invited_by && <p className="text-text-muted text-[10px] truncate uppercase tracking-wider">Por {guest.invited_by}</p>}
                      </div>
                      <button
                        onClick={() => {
                          guestCheckinMutation.mutate(guest.id);
                          setShowAllGuests(false);
                          setGuestSearch('');
                        }}
                        disabled={guestCheckinMutation.isPending}
                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 flex items-center gap-1.5 rounded-lg transition-colors"
                      >
                        {guestCheckinMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-text-muted/60 text-xs bg-black/20 rounded-xl border border-dashed border-white/10">
                    {guestSearch ? "Nenhum convidado encontrado." : "Todos os convidados cadastrados já estão no circuito."}
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


// ─── Card colapsável de circuito (resumo na lista) ─────────────────────────────
function CircuitSummaryCard({
  circuit,
  myPlayer,
  isExpanded,
  onToggle,
}: {
  circuit: any;
  myPlayer: any;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { data: circuitDetail } = useQuery({
    queryKey: ['athlete-circuit-detail', circuit.id],
    queryFn: () => api.get(`/attendance/gamedays/${circuit.id}/checkin-info/`).then(r => r.data),
    staleTime: 10000,
  });

  const totalPresent = circuitDetail?.gameday?.total_present ?? circuit.total_present ?? 0;
  
  const myAttendance = myPlayer && circuitDetail?.players?.find((p: any) => p.id === myPlayer.id);
  const amPresent = myAttendance?.present;
  const hasPaid = myAttendance?.has_paid || myAttendance?.used_credit;
  const isWaitlist = myAttendance?.is_waitlist;

  const dateObj = new Date(`${circuit.date}T12:00:00`);
  const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const dayNum = dateObj.toLocaleDateString('pt-BR', { day: '2-digit' });
  const month = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const time = circuit.time ? ` às ${circuit.time.slice(0, 5)}` : '';
  const dateFormatted = `${dayName}., ${dayNum} ${month}${time}`;

  return (
    <div className="card overflow-hidden">
      {/* Cabeçalho clicável */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-highlight/30 transition-colors"
      >
        {/* Indicador status */}
        <div className={cn(
          'w-2 h-2 rounded-full flex-shrink-0 mt-1 self-start',
          isExpanded ? 'bg-green-400 animate-pulse' : 'bg-green-400/50'
        )} />

        {/* Infos principais */}
        <div className="flex-1 min-w-0">
          <p className="font-display text-sm text-text-primary tracking-wider leading-none truncate">
            {circuit.location || 'PELADA'}
          </p>
          <p className="text-text-muted text-[11px] mt-1 capitalize flex items-center gap-1">
            <Clock size={10} /> {dateFormatted}
          </p>
          
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {amPresent ? (
              <>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 font-bold flex items-center gap-1">
                  <Check size={10} /> Confirmado
                </span>
                {hasPaid ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold flex items-center gap-1">
                    <Check size={10} /> Pago
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red/20 text-red border border-red/30 font-bold flex items-center gap-1">
                    <X size={10} /> Não Pago
                  </span>
                )}
              </>
            ) : isWaitlist ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-bold flex items-center gap-1">
                <Clock size={10} /> Fila de Espera
              </span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-highlight text-text-muted border border-border/50 font-medium">
                Pendente
              </span>
            )}
          </div>
        </div>

        {/* Contagem + seta */}
        <div className="flex items-center gap-2 flex-shrink-0 self-start">
          <div className="text-right">
            <p className="font-display text-xl text-green-400 leading-none drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]">{totalPresent}</p>
            <p className="text-text-muted text-[9px] uppercase tracking-wider mt-0.5">
              {circuit.max_players ? `/ ${circuit.max_players}` : 'conf.'}
            </p>
          </div>
          <ChevronDown
            size={16}
            className={cn(
              'text-text-muted transition-transform duration-300 flex-shrink-0 mt-0.5',
              isExpanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Conteúdo expandido */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-border/20"
          >
            <div className="p-2">
              <CircuitCheckinCard circuit={circuit} myPlayer={myPlayer} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// ─── Página principal ───────────────────────────────────────────────────────────
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

  // Circuito expandido por padrão: o da URL ou o primeiro disponível
  const [expandedId, setExpandedId] = useState<number | null>(
    circuitId ? Number(circuitId) : null
  );

  if (isLoading || isLoadingProfile) return <PageLoading />;

  let circuitsToDisplay = openCircuits ? [...openCircuits] : [];
  
  // Garante a ordenação: datas mais próximas primeiro (crescente)
  circuitsToDisplay.sort((a: any, b: any) => {
    const datetimeA = new Date(`${a.date}T${a.time || '00:00:00'}`).getTime();
    const datetimeB = new Date(`${b.date}T${b.time || '00:00:00'}`).getTime();
    return datetimeA - datetimeB;
  });

  if (circuitId) {
    circuitsToDisplay = circuitsToDisplay.filter((c: any) => c.id === Number(circuitId));
  }

  // Se só há 1 circuito ou veio da URL, expande automaticamente
  const autoExpand = circuitsToDisplay.length === 1;

  // Expande o primeiro automaticamente se não veio da URL e só tem 1
  const effectiveExpandedId = autoExpand
    ? circuitsToDisplay[0]?.id
    : expandedId;

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
    <div className="space-y-2 mb-8">
      {/* Premium Header */}
      <div className="mb-6 relative flex flex-col gap-2">
        <div className="absolute -top-6 -left-6 w-24 h-24 bg-primary/20 blur-2xl rounded-full pointer-events-none" />
        
        <div className="flex items-end justify-between relative z-10">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl text-white tracking-widest leading-none drop-shadow-md uppercase">
              Circuitos<br /><span className="text-primary drop-shadow-[0_0_15px_rgba(217,4,41,0.5)]">Abertos</span>
            </h1>
          </div>
          
          {effectiveExpandedId && circuitsToDisplay.length > 1 && (
            <button
              onClick={() => setExpandedId(null)}
              className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors uppercase font-black tracking-widest"
            >
              <X size={12} /> Fechar
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2 relative z-10">
          <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-[9px] font-black uppercase tracking-widest">
              {circuitsToDisplay.length} {circuitsToDisplay.length === 1 ? 'Disponível' : 'Disponíveis'}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {circuitsToDisplay.map((circuit: any) => (
          <CircuitSummaryCard
            key={circuit.id}
            circuit={circuit}
            myPlayer={myPlayer}
            isExpanded={effectiveExpandedId === circuit.id}
            onToggle={() =>
              setExpandedId(prev => (prev === circuit.id ? null : circuit.id))
            }
          />
        ))}
      </div>
    </div>
  );
}
