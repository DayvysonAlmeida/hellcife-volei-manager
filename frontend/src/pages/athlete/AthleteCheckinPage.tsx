import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Volleyball, Check, Clock, UserCheck, UserPlus, Search, Loader2, CalendarCheck, Wallet, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { PageLoading } from '@/components/ui/Loading';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

function CircuitCheckinCard({ circuit, myPlayer }: { circuit: any, myPlayer: any }) {
  const qc = useQueryClient();
  const [guestSearch, setGuestSearch] = useState('');

  const { data: circuitDetail } = useQuery({
    queryKey: ['athlete-circuit-detail', circuit.id],
    queryFn: () => api.get(`/attendance/gamedays/${circuit.id}/checkin-info/`).then(r => r.data),
    refetchInterval: 10000, // atualiza auto a cada 10s
  });

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

  const availableGuests = circuitDetail?.players?.filter((p: any) =>
    p.is_guest && !p.present && !p.is_waitlist &&
    (guestSearch === '' || p.name.toLowerCase().includes(guestSearch.toLowerCase()))
  ) || [];

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

  const myAttendance = myPlayer && circuitDetail?.players?.find((p: any) => p.id === myPlayer.id);
  const amPresent = myAttendance?.present;
  const amWaitlist = myAttendance?.is_waitlist;

  const safePrice = circuit.court_price ? Number(String(circuit.court_price).replace(',', '.')) : 0;
  const pricePerPlayer = safePrice > 0 && circuitDetail?.gameday?.total_present > 0
    ? (safePrice / circuitDetail.gameday.total_present).toFixed(2)
    : null;

  return (
    <div className="space-y-6 mb-10">
      {/* ── Info do Circuito ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden card p-6 border-l-4 border-l-green-500"
      >
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-red/5 blur-2xl pointer-events-none" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-medium uppercase tracking-wider">Circuito Aberto</span>
            </div>
            <h1 className="font-display text-2xl text-text-primary tracking-wider">
              {circuit.location || 'PELADA'}
            </h1>
            <p className="text-text-muted text-sm mt-1">{formatDate(circuit.date)}</p>
            {(circuit.time || circuit.time_end) && (
              <p className="text-text-muted text-sm flex items-center gap-1 mt-0.5">
                <Clock size={13} />
                {circuit.time}{circuit.time_end && ` – ${circuit.time_end}`}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-display text-3xl text-text-primary">{circuitDetail?.gameday?.total_present ?? circuit.total_present ?? 0}</p>
            <p className="text-text-muted text-xs uppercase tracking-wider">Confirmados</p>
            {circuit.max_players && (
              <p className="text-text-muted/60 text-xs mt-0.5">/ {circuit.max_players} vagas</p>
            )}
          </div>
        </div>
        {pricePerPlayer && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 text-text-muted text-sm">
            <span>💰</span>
            <span>Valor estimado por jogador: <strong className="text-text-primary">R$ {pricePerPlayer}</strong></span>
          </div>
        )}

        {/* Botão PIX */}
        {safePrice > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            {circuitDetail?.gameday?.total_present > 0 ? (
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                  <Wallet size={16} />
                  Rateio: R$ {pricePerPlayer}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('hellcifevolei@gmail.com');
                    toast.success('Chave PIX copiada! 💸');
                  }}
                  className="w-full bg-green-500/10 border border-green-500/40 hover:bg-green-500/20 hover:border-green-500 transition-colors text-green-400 font-bold rounded-lg py-2.5 flex items-center justify-center gap-2 text-sm"
                >
                  <Copy size={15} />
                  Copiar PIX — hellcifevolei@gmail.com
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-400/70 text-xs">
                <Wallet size={13} />
                <span>Rateio exibido quando houver confirmados</span>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Minha Presença ── */}
      {myPlayer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-6"
        >
          <h2 className="font-display text-lg text-text-primary tracking-wider mb-4">MINHA PRESENÇA</h2>

          <div className="flex items-center gap-4 mb-5">
            <Avatar name={myPlayer.display_name} src={myPlayer.avatar_url} size="md" />
            <div className="flex-1">
              <p className="text-text-primary font-medium">{myPlayer.display_name}</p>
              <p className="text-text-muted text-sm">{myPlayer.main_position_display}</p>
            </div>
            <div>
              {amPresent ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                  <Check size={14} /> Confirmado
                </span>
              ) : amWaitlist ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  <Clock size={14} /> Fila de Espera
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-surface-highlight text-text-muted border border-border">
                  Ausente
                </span>
              )}
            </div>
          </div>

          {!amPresent && !amWaitlist && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => checkinMutation.mutate(myPlayer.id)}
              disabled={checkinMutation.isPending}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
            >
              {checkinMutation.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CalendarCheck size={18} />
              )}
              Confirmar Minha Presença
            </motion.button>
          )}

          {amPresent && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 text-center">
              <p className="text-green-400 font-medium text-sm">✅ Você está confirmado! Nos vemos na quadra!</p>
            </div>
          )}

          {amWaitlist && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-center">
              <p className="text-yellow-400 font-medium text-sm">⏳ Você está na fila de espera. Aguarde uma vaga!</p>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Adicionar Convidado ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-blue/10 flex items-center justify-center text-blue-400">
            <UserPlus size={18} />
          </div>
          <div>
            <h2 className="font-display text-lg text-text-primary tracking-wider">CONVIDADOS</h2>
            <p className="text-text-muted text-xs">Convidados que estão na lista deste circuito</p>
          </div>
        </div>

        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={guestSearch}
            onChange={e => setGuestSearch(e.target.value)}
            placeholder="Buscar convidado..."
            className="input w-full pl-9"
          />
        </div>

        {availableGuests.length > 0 ? (
          <div className="space-y-2">
            {availableGuests.map((guest: any) => (
              <motion.div
                key={guest.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 p-3 bg-surface-highlight rounded-xl border border-border/30"
              >
                <Avatar name={guest.name} src={guest.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm font-medium truncate">{guest.name}</p>
                  {guest.invited_by && (
                    <p className="text-text-muted text-xs">Convidado por {guest.invited_by}</p>
                  )}
                </div>
                <button
                  onClick={() => guestCheckinMutation.mutate(guest.id)}
                  disabled={guestCheckinMutation.isPending}
                  className={cn(
                    'btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5',
                  )}
                >
                  {guestCheckinMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={13} />}
                  Adicionar
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <UserPlus size={36} className="text-text-muted/20 mx-auto mb-2" />
            <p className="text-text-muted text-sm">
              {guestSearch ? 'Nenhum convidado encontrado.' : 'Nenhum convidado na lista deste circuito.'}
            </p>
            <p className="text-text-muted/50 text-xs mt-1">
              Peça ao administrador para adicionar convidados.
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Lista de Confirmados ── */}
      {circuitDetail?.players && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6"
        >
          <h2 className="font-display text-lg text-text-primary tracking-wider mb-4">
            CONFIRMADOS ({circuitDetail.players.filter((p: any) => p.present).length})
          </h2>
          <div className="space-y-2">
            {circuitDetail.players
              .filter((p: any) => p.present)
              .map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                  <span className="text-text-muted/50 text-xs w-5 text-right flex-shrink-0">{i + 1}</span>
                  <Avatar name={p.name} src={p.avatar_url} size="sm" />
                  <span className={cn('text-sm flex-1', p.id === myPlayer?.id ? 'text-red font-medium' : 'text-text-primary')}>
                    {p.name}
                    {p.id === myPlayer?.id && ' (você)'}
                  </span>
                  {p.is_guest && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue/10 text-blue-400 border border-blue/20">
                      Convidado
                    </span>
                  )}
                  <Check size={14} className="text-green-400 flex-shrink-0" />
                </div>
              ))}
            {circuitDetail.players.filter((p: any) => p.present).length === 0 && (
              <p className="text-text-muted text-sm text-center py-4">Nenhum confirmado ainda. Seja o primeiro!</p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function AthleteCheckinPage() {
  const { data: myPlayer } = useQuery({
    queryKey: ['athlete-me'],
    queryFn: () => api.get('/players/me/').then(r => r.data),
  });

  const { data: openCircuits, isLoading } = useQuery({
    queryKey: ['athlete-open-circuits'],
    queryFn: async () => {
      const res = await api.get(`/attendance/gamedays/?is_closed=false&ordering=date`);
      return res.data.results || res.data;
    },
  });

  if (isLoading) return <PageLoading />;

  if (!openCircuits || openCircuits.length === 0) {
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
      {openCircuits.map((circuit: any) => (
        <CircuitCheckinCard key={circuit.id} circuit={circuit} myPlayer={myPlayer} />
      ))}
    </div>
  );
}
