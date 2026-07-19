import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Star, AlertCircle, Plus, Minus, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { playersService } from '@/services/players';
import { useAuth } from '@/store/AuthContext';
import toast from 'react-hot-toast';

export function StarsSystemPage() {
  const { user } = useAuth();
  const isAdmin = user?.profile === 'admin' || user?.profile === 'moderator';
  const queryClient = useQueryClient();

  const { data: players, isLoading, error, refetch } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersService.list(),
  });

  const updateStarsMutation = useMutation({
    mutationFn: ({ id, mini_stars }: { id: number; mini_stars: number }) => 
      playersService.update(id, { mini_stars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar estrelas');
    }
  });

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!players?.results) return null;

  const handleUpdateStars = (e: React.MouseEvent, playerId: number, currentStars: number, delta: number) => {
    e.preventDefault();
    const newStars = Math.max(0, (currentStars || 0) + delta);
    updateStarsMutation.mutate({ id: playerId, mini_stars: newStars });
  };

  const activePlayers = players.results.filter(p => p.status === 'active');

  // Agrupar os jogadores por big_stars
  const groupedPlayers = activePlayers.reduce((acc, player) => {
    const stars = player.big_stars || 0;
    if (!acc[stars]) {
      acc[stars] = [];
    }
    acc[stars].push(player);
    return acc;
  }, {} as Record<number, typeof activePlayers>);

  // Ordenar os grupos em ordem decrescente (ex: 3 Estrelas Grandes primeiro)
  const sortedGroups = Object.keys(groupedPlayers)
    .map(Number)
    .sort((a, b) => b - a);

  // Ordenar os jogadores dentro do grupo por mini_stars (decrescente)
  sortedGroups.forEach(group => {
    groupedPlayers[group].sort((a, b) => (b.mini_stars || 0) - (a.mini_stars || 0));
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      {/* Header */}
      <div>
        <h1 className="page-title">
          <Star className="text-yellow-500 fill-yellow-500" size={32} />
          SISTEMA DE ESTRELAS
        </h1>
        <p className="page-subtitle">Classificação oficial dos atletas no Hellcife Vôlei baseada em mérito, evolução e comprometimento.</p>
      </div>

      <div className="bg-surface border border-blue-500/30 p-5 rounded-xl flex items-start gap-4 shadow-[0_0_15px_rgba(37,99,235,0.05)]">
        <AlertCircle className="text-blue-500 mt-0.5 flex-shrink-0" size={24} />
        <div className="text-sm text-text-secondary space-y-2">
          <p><strong className="text-blue-400 font-display tracking-wider">COMO FUNCIONA?</strong> Todo atleta inicia com 1 Mini Estrela. O ganho de novas estrelas acontece através do desempenho em circuitos e campeonatos.</p>
          <p>Apenas Administradores podem promover atletas. As estrelas definem o nível e o agrupamento nos jogos e garantem o equilíbrio técnico dos times gerados.</p>
        </div>
      </div>

      {sortedGroups.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          Nenhum atleta ativo encontrado no sistema de estrelas.
        </div>
      ) : (
        <div className="space-y-10">
          {sortedGroups.map((stars) => (
            <div key={stars} className="space-y-4">
              {/* Cabeçalho do Grupo */}
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  {stars === 0 ? (
                    <div className="text-text-muted font-display text-sm uppercase tracking-widest px-3 py-1 bg-surface rounded-full border border-border">
                      Iniciantes / Em Avaliação
                    </div>
                  ) : (
                    Array.from({ length: stars }).map((_, i) => (
                      <div key={i} className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center border-b-2 border-yellow-600 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                        <span className="text-yellow-900 font-display text-sm font-bold">🌟</span>
                      </div>
                    ))
                  )}
                </div>
                {stars > 0 && (
                  <h2 className="font-display text-xl text-text-primary tracking-wider uppercase">
                    Nível {stars} Estrela{stars > 1 ? 's' : ''}
                  </h2>
                )}
                <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
              </div>

              {/* Grid de Jogadores do Grupo */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedPlayers[stars].map((player, idx) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Link
                      to={`/players/${player.id}`}
                      className="card p-5 flex flex-col justify-between hover:bg-surface-highlight transition-all duration-300 group relative overflow-hidden min-h-[140px] hover:-translate-y-1 hover:shadow-neon-yellow border-border hover:border-yellow-500/50"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <Avatar name={player.display_name} src={player.avatar_url} size="md" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-text-primary font-bold text-base truncate group-hover:text-yellow-400 transition-colors">
                            {player.display_name}
                          </h3>
                          <div className="mt-1">
                            <PositionBadge position={player.main_position} />
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-text-muted tracking-widest">Mini Estrelas</span>
                          <span className="text-xs font-bold text-yellow-400">{player.mini_stars || 0}/15</span>
                        </div>
                        <div className="w-full bg-surface-highlight rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-yellow-700 via-yellow-400 to-yellow-700 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(250,204,21,0.5)]" 
                            style={{ width: `${Math.min(100, ((player.mini_stars || 0) / 15) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="absolute right-3 top-4 flex flex-col items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface/90 backdrop-blur-sm p-1.5 rounded-lg border border-border">
                          <button
                            onClick={(e) => handleUpdateStars(e, player.id, player.mini_stars, 1)}
                            disabled={updateStarsMutation.isPending}
                            className="w-7 h-7 rounded-md bg-green-500/10 flex items-center justify-center text-green-500 hover:bg-green-500 hover:text-white transition-all disabled:opacity-30 border border-green-500/20"
                            title="Adicionar 1 Mini Estrela"
                          >
                            {updateStarsMutation.isPending && updateStarsMutation.variables?.id === player.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Plus size={14} strokeWidth={3} />
                            )}
                          </button>
                          <button
                            onClick={(e) => handleUpdateStars(e, player.id, player.mini_stars, -1)}
                            disabled={updateStarsMutation.isPending || (player.mini_stars || 0) === 0}
                            className="w-7 h-7 rounded-md bg-red/10 flex items-center justify-center text-red hover:bg-red hover:text-white transition-all disabled:opacity-30 border border-red/20"
                            title="Remover 1 Mini Estrela"
                          >
                            <Minus size={14} strokeWidth={3} />
                          </button>
                        </div>
                      )}
                      
                      {/* Glow gradient bottom line */}
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] opacity-40 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-yellow-700 via-yellow-400 to-yellow-700" />
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
