import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, Grid, List, Edit, Trash2, Eye } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { OverallBadge } from '@/components/ui/OverallBadge';
import { PositionBadge, StatusBadge } from '@/components/ui/Badges';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { playersService } from '@/services/players';
import { useAuth } from '@/store/AuthContext';
import { POSITION_LABELS, type Position, type PlayerStatus } from '@/types';
import type { Player } from '@/types';
import { cn } from '@/lib/utils';

const POSITIONS = Object.entries(POSITION_LABELS) as [Position, string][];
const STATUSES: [PlayerStatus, string][] = [
  ['active', 'Ativo'], ['inactive', 'Inativo'], ['injured', 'Lesionado'], ['suspended', 'Suspenso']
];

export function PlayersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data, isLoading } = useQuery({
    queryKey: ['players', search, positionFilter, statusFilter],
    queryFn: () => playersService.list({
      search: search || undefined,
      main_position: positionFilter || undefined,
      status: statusFilter || undefined,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => playersService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['players'] }),
  });

  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';
  const players = data?.results || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Atletas</h1>
          <p className="page-subtitle">Cadastro e gestão do elenco.</p>
        </div>
        {canEdit && (
          <Link to="/players/new" className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Novo Atleta
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar por nome ou apelido..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full pl-9"
            />
          </div>

          {/* Position filter */}
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="input sm:w-44"
          >
            <option value="">Todas posições</option>
            {POSITIONS.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input sm:w-36"
          >
            <option value="">Todos status</option>
            {STATUSES.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-surface rounded-lg p-1 border border-border">
            <button
              onClick={() => setViewMode('grid')}
              className={cn('p-2 rounded transition-all', viewMode === 'grid' ? 'bg-red text-white' : 'text-text-muted hover:text-text-primary')}
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn('p-2 rounded transition-all', viewMode === 'list' ? 'bg-red text-white' : 'text-text-muted hover:text-text-primary')}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        {/* Results count */}
        {data && (
          <p className="text-text-muted text-xs mt-3">
            {data.count} atleta{data.count !== 1 ? 's' : ''} encontrado{data.count !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <PageLoading />
      ) : players.length === 0 ? (
        <EmptyState
          message="Nenhum atleta encontrado. Ajuste os filtros ou adicione um novo atleta."
          icon="🏐"
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {players.map((player, idx) => (
            <PlayerCard
              key={player.id}
              player={player}
              idx={idx}
              canEdit={canEdit}
              onDelete={() => {
                if (confirm(`Remover ${player.display_name}?`)) {
                  deleteMutation.mutate(player.id);
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Atleta</th>
                <th className="text-left px-4 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Posição</th>
                <th className="text-left px-4 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Status</th>
                <th className="text-center px-4 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Overall</th>
                <th className="text-right px-4 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {players.map((player) => (
                <tr key={player.id} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={player.display_name} src={player.avatar_url} size="sm" />
                      <div>
                        <p className="text-text-primary font-medium text-sm">{player.display_name}</p>
                        {player.shirt_number && (
                          <p className="text-text-muted text-xs">#{player.shirt_number}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PositionBadge position={player.main_position} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={player.status} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <OverallBadge overall={player.latest_overall} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/players/${player.id}`} className="btn-ghost p-1.5">
                        <Eye size={14} />
                      </Link>
                      {canEdit && (
                        <>
                          <Link to={`/players/${player.id}/edit`} className="btn-ghost p-1.5">
                            <Edit size={14} />
                          </Link>
                          <button
                            onClick={() => {
                              if (confirm(`Remover ${player.display_name}?`)) deleteMutation.mutate(player.id);
                            }}
                            className="btn-ghost p-1.5 hover:text-red"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PlayerCard({ player, idx, canEdit, onDelete }: {
  player: Player;
  idx: number;
  canEdit: boolean;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className="card-hover overflow-hidden group"
    >
      {/* Top accent bar */}
      <div className="h-1 bg-red-gradient" />

      <div className="p-4">
        {/* Header with avatar + overall */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar name={player.display_name} src={player.avatar_url} size="md" />
            <div className="min-w-0">
              <p className="text-text-primary font-semibold text-sm truncate">{player.display_name}</p>
              {player.shirt_number && (
                <p className="text-text-muted text-xs">#{player.shirt_number}</p>
              )}
            </div>
          </div>
          <OverallBadge overall={player.latest_overall} size="md" showLabel />
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <PositionBadge position={player.main_position} />
          <StatusBadge status={player.status} />
        </div>

        {/* Stats bars (mini) */}
        <div className="text-xs text-text-muted flex justify-between">
          <span>Mini estrelas</span>
        </div>
        <div className="mt-1 h-1 bg-border rounded-full">
          <div
            className="h-full bg-red rounded-full transition-all"
            style={{ width: player.latest_overall ? `${(player.latest_overall / 10) * 100}%` : '0%' }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <Link
            to={`/players/${player.id}`}
            className="flex-1 btn-ghost text-xs py-1.5 text-center flex items-center justify-center gap-1"
          >
            <Eye size={12} />
            Ver perfil
          </Link>
          {canEdit && (
            <>
              <Link
                to={`/players/${player.id}/edit`}
                className="btn-ghost p-1.5"
              >
                <Edit size={14} />
              </Link>
              <button onClick={onDelete} className="btn-ghost p-1.5 hover:text-red">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
