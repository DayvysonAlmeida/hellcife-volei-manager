import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Star, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { playersService } from '@/services/players';

export function StarsSystemPage() {
  const { data: players, isLoading, error, refetch } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersService.list(),
  });

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!players?.results) return null;

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
      <div>
        <h1 className="page-title flex items-center gap-3">
          <Star className="text-yellow-500" size={32} />
          SISTEMA DE ESTRELAS
        </h1>
        <p className="page-subtitle">Classificação oficial dos atletas no Hellcife Vôlei baseada em mérito, evolução e comprometimento.</p>
      </div>

      <div className="bg-surface-highlight border border-border p-4 rounded-xl flex items-start gap-3">
        <AlertCircle className="text-blue-500 mt-0.5 flex-shrink-0" size={20} />
        <div className="text-sm text-text-secondary space-y-1">
          <p><strong>Como funciona?</strong> Todo atleta inicia com 1 Mini Estrela (⭐). O ganho de novas estrelas acontece através do desempenho em circuitos e campeonatos.</p>
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
                      className="card p-4 flex items-center gap-4 hover:bg-surface-highlight transition-colors group relative overflow-hidden"
                    >
                      {/* Borda superior colorida baseada no número de estrelas para dar destaque */}
                      <div className={`absolute top-0 left-0 w-full h-1 ${
                        stars >= 3 ? 'bg-yellow-500' :
                        stars === 2 ? 'bg-blue-500' :
                        stars === 1 ? 'bg-green-500' :
                        'bg-border'
                      }`} />

                      <Avatar name={player.display_name} src={player.avatar_url} size="md" />
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-text-primary font-medium text-base truncate group-hover:text-red transition-colors">
                          {player.display_name}
                        </h3>
                        <PositionBadge position={player.main_position} />
                        
                        <div className="flex items-center gap-1 mt-2">
                          {Array.from({ length: player.mini_stars || 0 }).map((_, i) => (
                            <div key={`mini-${i}`} className="w-4 h-4 bg-yellow-500/10 rounded-sm flex items-center justify-center border border-yellow-500/30">
                              <span className="text-yellow-500 text-[10px]">⭐</span>
                            </div>
                          ))}
                          {(player.mini_stars || 0) === 0 && (
                            <span className="text-xs text-text-muted italic">Sem mini estrelas</span>
                          )}
                        </div>
                      </div>
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
