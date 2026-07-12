import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CalendarCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { PageLoading } from '@/components/ui/Loading';
import { formatDate } from '@/lib/utils';

export function CheckinPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['public-checkin', id],
    queryFn: () => api.get(`/attendance/gamedays/${id}/checkin-info/`).then(r => r.data),
    enabled: !!id,
  });

  const checkinMutation = useMutation({
    mutationFn: (playerId: number) => 
      api.post(`/attendance/gamedays/${id}/public-checkin/`, { player_id: playerId }).then(r => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['public-checkin', id] });
      if (res.present) {
        toast.success('Presença confirmada!', { icon: '✅' });
      } else {
        toast.success('Presença cancelada.', { icon: '❌' });
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Erro ao fazer check-in.');
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

  return (
    <div className="min-h-screen pb-10 bg-background">
      <div className="bg-surface border-b border-border p-6 pt-10 sticky top-0 z-10 shadow-sm">
        <div className="max-w-md mx-auto text-center">
          <h1 className="font-display text-2xl text-red uppercase tracking-wider mb-2">Check-in Hellcife</h1>
          <h2 className="text-lg font-medium text-text-primary">{formatDate(gameday.date)}</h2>
          {gameday.location && <p className="text-text-muted text-sm mt-1">{gameday.location}</p>}
          
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="bg-red/10 text-red px-3 py-1 rounded-full text-sm font-bold">
              {gameday.total_present} / {gameday.max_players || '∞'} presentes
            </span>
          </div>

          <div className="mt-6">
            <input
              type="text"
              placeholder="Busque seu nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-red transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-2 mt-4">
        {filteredPlayers.length === 0 ? (
          <p className="text-center text-text-muted py-8">Nenhum jogador encontrado com "{search}".</p>
        ) : (
          filteredPlayers.map((player: any) => (
            <button
              key={player.id}
              onClick={() => checkinMutation.mutate(player.id)}
              disabled={checkinMutation.isPending}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                player.present 
                  ? 'bg-red/10 border-red/50 shadow-md shadow-red/10' 
                  : 'bg-surface border-border hover:border-red/30'
              }`}
            >
              <div className="flex flex-col items-start text-left">
                <span className={`font-medium text-lg ${player.present ? 'text-red' : 'text-text-primary'}`}>
                  {player.name}
                </span>
                {player.is_guest && (
                  <span className="text-[10px] bg-blue/10 text-blue px-1.5 py-0.5 rounded uppercase font-bold mt-1">
                    Convidado
                  </span>
                )}
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                player.present ? 'bg-red' : 'bg-background border-2 border-border-subtle'
              }`}>
                {checkinMutation.isPending && checkinMutation.variables === player.id ? (
                  <Loader2 size={16} className="text-white animate-spin" />
                ) : player.present ? (
                  <Check size={16} className="text-white" />
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
