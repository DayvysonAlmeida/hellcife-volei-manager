import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CalendarCheck, Loader2, Copy, Wallet, Search, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { PageLoading } from '@/components/ui/Loading';
import { formatDate } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Avatar } from '@/components/ui/Avatar';
import { LocationMapModal } from '@/components/ui/LocationMapModal';

export function CheckinPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'guests'>('members');
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: number; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['public-checkin', id],
    queryFn: () => api.get(`/attendance/gamedays/${id}/checkin-info/`).then(r => r.data),
    enabled: !!id,
  });

  const checkinMutation = useMutation({
    mutationFn: (playerId: number) => 
      api.post(`/attendance/gamedays/${id}/public-checkin/`, { player_id: playerId }).then(r => r.data),
    onSuccess: (res) => {
      if (res.present) {
        toast.success('Presença confirmada!', { icon: '✅' });
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
    if (a.is_guest !== b.is_guest) return a.is_guest ? 1 : -1;
    if (a.waitlist_joined_at && b.waitlist_joined_at) {
      return new Date(a.waitlist_joined_at).getTime() - new Date(b.waitlist_joined_at).getTime();
    }
    return 0;
  });
  const absentPlayers = filteredPlayers.filter((p: any) => !p.present && !p.is_waitlist);
  const absentMembers = absentPlayers.filter((p: any) => !p.is_guest);
  const absentGuests = absentPlayers.filter((p: any) => p.is_guest);
  const displayedAbsent = activeTab === 'members' ? absentMembers : absentGuests;

  const safeCourtPrice = gameday.court_price ? Number(String(gameday.court_price).replace(',', '.')) : 0;

  const pricePerPlayer = safeCourtPrice > 0 && gameday.total_present > 0 
    ? (safeCourtPrice / gameday.total_present).toFixed(2) 
    : '0.00';

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
              <img src="/escudo_hellcife.png" alt="Hellcife Vôlei" className="relative w-16 h-16 sm:w-24 sm:h-24 object-contain drop-shadow-2xl hover:scale-105 transition-transform" />
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

            {safeCourtPrice > 0 && (
              <div className="bg-card-gradient border border-green-500/30 text-green-500 p-2 sm:p-4 rounded-xl w-full flex flex-col items-center justify-center gap-2 shadow-card mt-1">
                {gameday.total_present > 0 ? (
                  <>
                    <div className="flex items-center gap-2 font-bold text-base sm:text-lg">
                      <Wallet size={18} />
                      Rateio: R$ {pricePerPlayer.replace('.', ',')}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(gameday.pix_key || 'hellcifevolei@gmail.com');
                        toast.success('Chave PIX copiada!');
                      }}
                      className="w-full bg-green-500/10 border border-green-500/40 hover:bg-green-500/20 hover:border-green-500 transition-colors text-green-500 font-bold rounded-lg py-2 flex items-center justify-center gap-2 text-xs sm:text-sm shadow-[0_0_8px_rgba(22,163,74,0.2)]"
                    >
                      <Copy size={16} />
                      Copiar PIX
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-center text-xs sm:text-sm font-medium text-green-500/80">
                    <Wallet size={16} />
                    Rateio após check-in
                  </div>
                )}
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
                          {player.is_guest && (
                            <span className="text-[10px] bg-blue/10 text-blue px-1.5 py-0.5 rounded uppercase font-bold mt-0.5">
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
                          {player.is_guest && (
                            <span className="text-[10px] bg-blue/10 text-blue px-1.5 py-0.5 rounded uppercase font-bold mt-0.5">
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
                        onClick={() => setSelectedPlayer({ id: player.id, name: player.name })}
                        disabled={checkinMutation.isPending}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border border-border/50 transition-all bg-card-gradient shadow-card group hover:shadow-neon ${activeTab === 'guests' ? 'hover:border-blue/50 hover:shadow-neon-blue' : 'hover:border-red/50 hover:shadow-neon-red'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={player.name} src={player.avatar_url} size="md" className={`ring-1 ring-border opacity-70 group-hover:opacity-100 transition-all ${activeTab === 'guests' ? 'group-hover:ring-blue/50' : 'group-hover:ring-red/50'}`} />
                          <div className="flex flex-col items-start text-left">
                            <span className={`font-medium text-base text-text-primary transition-colors ${activeTab === 'guests' ? 'group-hover:text-blue' : 'group-hover:text-red'}`}>
                              {player.name}
                            </span>
                            {player.is_guest && (
                              <span className="text-[10px] bg-blue/10 text-blue px-1.5 py-0.5 rounded uppercase font-bold mt-0.5">
                                Convidado {player.invited_by ? `por: ${player.invited_by}` : ''}
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

      <ConfirmDialog
        isOpen={!!selectedPlayer}
        onOpenChange={(open) => !open && setSelectedPlayer(null)}
        title="Confirmar Presença"
        description={selectedPlayer ? `Tem certeza que deseja confirmar a presença de ${selectedPlayer.name} nesta pelada?` : ''}
        onConfirm={() => selectedPlayer && checkinMutation.mutate(selectedPlayer.id)}
        confirmText="Confirmar Presença"
        cancelText="Cancelar"
        isDestructive={false}
      />
    </div>
  );
}
