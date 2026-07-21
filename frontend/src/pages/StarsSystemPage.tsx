import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Star, Search, Trophy, Zap, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { playersService } from '@/services/players';
import type { StarsPayload } from '@/services/players';
import { useAuth } from '@/store/AuthContext';
import { useDebounce } from '@/lib/useDebounce';
import toast from 'react-hot-toast';
import type { Player } from '@/types';

// Configuração das 3 categorias de estrelas
const STAR_CATEGORIES = [
  {
    key: 'mvp_stars' as keyof StarsPayload,
    label: 'MVP',
    icon: Trophy,
    color: 'text-yellow-400',
    fillColor: '#FACC15',
    glowClass: 'drop-shadow-[0_0_4px_rgba(250,204,21,0.8)]',
  },
  {
    key: 'attack_stars' as keyof StarsPayload,
    label: 'ATAQUE',
    icon: Zap,
    color: 'text-red',
    fillColor: '#D90429',
    glowClass: 'shadow-neon-red-sm',
  },
  {
    key: 'defense_stars' as keyof StarsPayload,
    label: 'DEFESA',
    icon: Shield,
    color: 'text-blue',
    fillColor: '#2563EB',
    glowClass: 'shadow-neon-blue-sm',
  },
] as const;

// Componente de 5 estrelas clicáveis por categoria
function StarRow({
  label,
  value,
  fillColor,
  glowClass,
  icon: Icon,
  color,
  canEdit,
  onChange,
}: {
  label: string;
  value: number;
  fillColor: string;
  glowClass: string;
  icon: typeof Trophy;
  color: string;
  canEdit: boolean;
  onChange: (val: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered !== null ? hovered : value;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className={`flex items-center gap-1.5 min-w-[68px]`}>
        <Icon size={12} className={color} />
        <span className={`text-[10px] font-bold tracking-widest uppercase ${color}`}>{label}</span>
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, i) => {
          const starVal = i + 1;
          const filled = display >= starVal;
          return (
            <button
              key={i}
              type="button"
              disabled={!canEdit}
              onClick={() => canEdit && onChange(value === starVal ? starVal - 1 : starVal)}
              onMouseEnter={() => canEdit && setHovered(starVal)}
              onMouseLeave={() => canEdit && setHovered(null)}
              className={`transition-transform ${canEdit ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
              aria-label={`${label} ${starVal} estrela(s)`}
            >
              <Star
                size={18}
                style={filled ? { color: fillColor, fill: fillColor } : undefined}
                className={`${filled ? glowClass : 'text-text-muted/30'} transition-all duration-150`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Card individual do atleta
function PlayerStarCard({
  player,
  canEdit,
  onUpdate,
  isPending,
}: {
  player: Player;
  canEdit: boolean;
  onUpdate: (id: number, payload: StarsPayload) => void;
  isPending: boolean;
}) {
  // Estado local para edição otimista (sem aguardar server)
  const [localStars, setLocalStars] = useState<StarsPayload>({
    mvp_stars: player.mvp_stars ?? 0,
    attack_stars: player.attack_stars ?? 0,
    defense_stars: player.defense_stars ?? 0,
  });

  const handleChange = useCallback(
    (key: keyof StarsPayload, val: number) => {
      if (!canEdit) return;
      const updated = { ...localStars, [key]: val };
      setLocalStars(updated);
      onUpdate(player.id, updated);
    },
    [localStars, canEdit, onUpdate, player.id]
  );

  const mini = (localStars.mvp_stars + localStars.attack_stars + localStars.defense_stars);
  const progressPct = Math.min(100, (mini / 15) * 100);
  const bigStars = player.big_stars ?? 0;

  return (
    <div className="card p-4 flex flex-col gap-3 border-border hover:border-yellow-500/30 transition-colors duration-300 relative overflow-hidden group">
      {/* Glow line topo */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Header: avatar + info + estrelas grandes */}
      <div className="flex items-center gap-3">
        <Link to={`/players/${player.id}`} className="flex-shrink-0">
          <Avatar name={player.display_name} src={player.avatar_url} size="md" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              to={`/players/${player.id}`}
              className="font-bold text-sm text-text-primary truncate hover:text-yellow-400 transition-colors"
            >
              {player.display_name}
            </Link>
            {player.shirt_number && (
              <span className="text-[10px] text-text-muted font-mono">#{player.shirt_number}</span>
            )}
          </div>
          <div className="mt-0.5">
            <PositionBadge position={player.main_position} />
          </div>
        </div>
        {/* Estrelas Grandes */}
        {bigStars > 0 && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {Array.from({ length: bigStars }).map((_, i) => (
              <span key={i} className="text-base leading-none" title={`${bigStars} Estrela(s) Grande(s)`}>
                🌟
              </span>
            ))}
          </div>
        )}
        {/* Indicador de loading */}
        {isPending && (
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Linhas de estrelas por categoria */}
      <div className="flex flex-col gap-2.5">
        {STAR_CATEGORIES.map((cat) => (
          <StarRow
            key={cat.key}
            label={cat.label}
            value={localStars[cat.key]}
            fillColor={cat.fillColor}
            glowClass={cat.glowClass}
            icon={cat.icon}
            color={cat.color}
            canEdit={canEdit}
            onChange={(val) => handleChange(cat.key, val)}
          />
        ))}
      </div>

      {/* Barra de progresso mini-estrelas */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted uppercase tracking-widest">Mini Estrelas</span>
          <span className="text-[11px] font-bold text-yellow-400 font-mono">{mini}/15</span>
        </div>
        <div className="w-full h-1.5 bg-surface-highlight rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-700 via-yellow-400 to-yellow-500 transition-all duration-500 shadow-[0_0_6px_rgba(250,204,21,0.5)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function StarsSystemPage() {
  const { user } = useAuth();
  const isAdmin = user?.profile === 'admin' || user?.profile === 'moderator';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Busca todos os atletas ativos — sem paginação (lista auxiliar)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['players', 'stars-system', debouncedSearch],
    queryFn: () =>
      playersService.list({
        status: 'active',
        search: debouncedSearch || undefined,
        page_size: 500,
      }),
    staleTime: 1000 * 60 * 3,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: StarsPayload }) =>
      playersService.updateStars(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
    },
    onError: () => {
      toast.error('Erro ao salvar estrelas. Tente novamente.');
    },
  });

  const handleUpdate = useCallback(
    (id: number, payload: StarsPayload) => {
      updateMutation.mutate({ id, payload });
    },
    [updateMutation]
  );

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState onRetry={refetch} />;

  const players = (data?.results ?? []).sort((a, b) => {
    const aBig = a.big_stars ?? 0;
    const bBig = b.big_stars ?? 0;
    if (aBig !== bBig) return bBig - aBig;
    
    const aMini = a.mini_stars ?? 0;
    const bMini = b.mini_stars ?? 0;
    return bMini - aMini;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">
          <Star className="text-yellow-500 fill-yellow-500" size={28} />
          SISTEMA DE ESTRELAS
        </h1>
        <p className="page-subtitle">
          Classificação dos atletas por MVP, Ataque e Defesa. Ao completar 15 mini-estrelas, o atleta conquista uma Estrela Grande.
        </p>
      </div>

      {/* Legenda rápida */}
      <div className="flex flex-wrap gap-3 text-xs">
        {STAR_CATEGORIES.map((cat) => (
          <div key={cat.key} className="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-full border border-border">
            <cat.icon size={12} className={cat.color} />
            <span className={`font-bold tracking-wider uppercase ${cat.color}`}>{cat.label}</span>
            <span className="text-text-muted">— até 5 estrelas</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-full border border-border">
          <span>🌟</span>
          <span className="text-text-muted">— Estrela Grande (a cada 15)</span>
        </div>
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Buscar atleta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-full pl-9"
        />
      </div>

      {/* Contagem */}
      {players.length > 0 && (
        <p className="text-xs text-text-muted">
          {players.length} atleta{players.length !== 1 ? 's' : ''} ativo{players.length !== 1 ? 's' : ''}
          {!isAdmin && <span className="ml-2 text-text-muted/60">· somente leitura</span>}
        </p>
      )}

      {/* Grid de atletas */}
      {players.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          {debouncedSearch ? 'Nenhum atleta encontrado para essa busca.' : 'Nenhum atleta ativo no sistema.'}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {players.map((player) => (
            <PlayerStarCard
              key={player.id}
              player={player}
              canEdit={isAdmin}
              onUpdate={handleUpdate}
              isPending={
                updateMutation.isPending &&
                (updateMutation.variables as { id: number })?.id === player.id
              }
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
