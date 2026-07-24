import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CalendarCheck, Loader2, Copy, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { PageLoading } from '@/components/ui/Loading';
import { formatDate } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Avatar } from '@/components/ui/Avatar';

export function CheckinPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: number; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['public-checkin', id],
    queryFn: () => api.get(`/attendance/gamedays/${id}/checkin-info/`).then(r => r.data),
    enabled: !!id,
  });

  const checkinMutation = useMutation({
    mutationFn: (playerId: number) => 
      api.post(`/attendance/gamedays/${id}/public-checkin/`, { player_id: playerId }).then(r => r.data),
    onMutate: async (playerId) => {
      await qc.cancelQueries({ queryKey: ['public-checkin', id] });
      const previousData = qc.getQueryData(['public-checkin', id]);

      qc.setQueryData(['public-checkin', id], (old: any) => {
        if (!old) return old;
        
        let toggledPresent = false;
        
        const newPlayers = old.players.map((p: any) => {
          if (p.id === playerId) {
            toggledPresent = !p.present;
            return { ...p, present: toggledPresent };
          }
          return p;
        });
        
        const newTotalPresent = Math.max(0, old.gameday.total_present + (toggledPresent ? 1 : -1));

        return {
          ...old,
          gameday: {
            ...old.gameday,
            total_present: newTotalPresent
          },
          players: newPlayers
        };
      });
      return { previousData };
    },
    onSuccess: (res) => {
      if (res.present) {
        toast.success('Presença confirmada!', { icon: '✅' });
      } else {
        toast.success('Presença cancelada.', { icon: '❌' });
      }
    },
    onError: (err: any, playerId, context) => {
      qc.setQueryData(['public-checkin', id], context?.previousData);
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
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const presentPlayers = filteredPlayers.filter((p: any) => p.present);
  const absentPlayers = filteredPlayers.filter((p: any) => !p.present);

  const pricePerPlayer = gameday.court_price && gameday.total_present > 0 
    ? (Number(gameday.court_price) / gameday.total_present).toFixed(2) 
    : '0.00';

  return (
    <div className="min-h-screen pb-10 bg-background bg-sidebar-gradient animate-fade-in">
      <div className="bg-hero-gradient border-b border-border/30 p-6 pt-10 sticky top-0 z-10 shadow-sm backdrop-blur-md">
        <div className="max-w-md mx-auto text-center">
          <h1 className="font-display text-2xl text-red uppercase tracking-wider mb-2 drop-shadow-[0_0_8px_rgba(217,4,41,0.5)]">
            Check-in Hellcife
          </h1>
          <h2 className="text-lg font-medium text-text-primary">{formatDate(gameday.date)}</h2>
          {gameday.location && <p className="text-text-muted text-sm mt-1">{gameday.location}</p>}
          {(gameday.time || gameday.time_end) && (
            <p className="text-text-muted text-sm font-medium mt-0.5">
              {gameday.time ? gameday.time.slice(0, 5) : ''} {gameday.time_end ? `às ${gameday.time_end.slice(0, 5)}` : ''}
            </p>
          )}
          
          <div className="mt-4 flex flex-col items-center justify-center gap-3">
            <span className="bg-red/10 text-red px-4 py-1.5 rounded-full text-sm font-bold shadow-[0_0_10px_rgba(217,4,41,0.2)]">
              {gameday.total_present} / {gameday.max_players || '∞'} confirmados
            </span>

            {gameday.court_price && Number(gameday.court_price) > 0 && (
              <div className="bg-card-gradient border border-green-500/30 text-green-500 p-4 rounded-xl w-full flex flex-col items-center justify-center gap-3 shadow-card mt-2">
                {gameday.total_present > 0 ? (
                  <>
                    <div className="flex items-center gap-2 font-bold text-lg">
                      <Wallet size={20} />
                      Rateio: R$ {pricePerPlayer.replace('.', ',')}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('hellcifevolei@gmail.com');
                        toast.success('Chave PIX copiada!');
                      }}
                      className="w-full bg-green-500/10 border border-green-500/40 hover:bg-green-500/20 hover:border-green-500 transition-colors text-green-500 font-bold rounded-lg py-2.5 flex items-center justify-center gap-2 text-sm shadow-[0_0_8px_rgba(22,163,74,0.2)]"
                    >
                      <Copy size={16} />
                      Copiar PIX (hellcifevolei@gmail.com)
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-center text-sm font-medium text-green-500/80">
                    <Wallet size={16} />
                    Rateio exibido assim que houver confirmados
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 relative">
            <input
              type="text"
              placeholder="Busque seu nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-highlight border border-border/50 rounded-xl px-4 py-3.5 text-text-primary focus:outline-none focus:border-red focus:shadow-neon-red transition-all shadow-card"
            />
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-2 mt-4 animate-slide-in">
        {filteredPlayers.length === 0 ? (
          <p className="text-center text-text-muted py-8">Nenhum jogador encontrado com "{search}".</p>
        ) : (
          <div className="space-y-6">
            {presentPlayers.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 ml-2">
                  Confirmados ({presentPlayers.length})
                </h3>
                <div className="space-y-3">
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
                              Convidado
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

            {absentPlayers.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 ml-2 mt-6">
                  Ainda não confirmaram ({absentPlayers.length})
                </h3>
                <div className="space-y-3">
                  {absentPlayers.map((player: any) => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayer({ id: player.id, name: player.name })}
                      disabled={checkinMutation.isPending}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-border/50 transition-all bg-card-gradient shadow-card hover:border-red/50 hover:shadow-neon-red group"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={player.name} src={player.avatar_url} size="md" className="ring-1 ring-border opacity-70 group-hover:opacity-100 group-hover:ring-red/50 transition-all" />
                        <div className="flex flex-col items-start text-left">
                          <span className="font-medium text-base text-text-primary group-hover:text-red transition-colors">
                            {player.name}
                          </span>
                          {player.is_guest && (
                            <span className="text-[10px] bg-blue/10 text-blue px-1.5 py-0.5 rounded uppercase font-bold mt-0.5">
                              Convidado
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-surface border-2 border-border-subtle group-hover:border-red/40 transition-colors">
                        {checkinMutation.isPending && checkinMutation.variables === player.id ? (
                          <Loader2 size={18} className="text-text-muted animate-spin" />
                        ) : null}
                      </div>
                    </button>
                  ))}
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
