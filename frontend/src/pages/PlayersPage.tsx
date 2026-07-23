import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, Grid, List, Edit, Trash2, Eye, Users, Star, X, AlertTriangle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { OverallBadge } from '@/components/ui/OverallBadge';
import { PositionBadge, StatusBadge } from '@/components/ui/Badges';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { playersService } from '@/services/players';
import { useAuth } from '@/store/AuthContext';
import { useDebounce } from '@/lib/useDebounce';
import toast from 'react-hot-toast';
import { POSITION_LABELS, type Position, type PlayerStatus } from '@/types';
import type { Player } from '@/types';
import { cn, getOverallLabel, getOverallColor } from '@/lib/utils';

const POSITIONS = Object.entries(POSITION_LABELS) as [Position, string][];
const STATUSES: [PlayerStatus, string][] = [
  ['active', 'Ativo'], ['inactive', 'Inativo'], ['injured', 'Lesionado'], ['suspended', 'Suspenso']
];

const PAGE_SIZE = 24;

export function PlayersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', desc: '', onConfirm: () => {} });

  // Debounce na busca — espera 300ms após parar de digitar
  const debouncedSearch = useDebounce(search, 300);

  // Guest modal state
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestTab, setGuestTab] = useState<'list' | 'new'>('list');
  const [guestName, setGuestName] = useState('');
  const [guestPosition, setGuestPosition] = useState<Position>('outside');
  const [guestInvitedBy, setGuestInvitedBy] = useState(user?.name || '');
  
  const { data: guestsData, isLoading: loadingGuests } = useQuery({
    queryKey: ['guests'],
    queryFn: () => playersService.list({ is_guest: 'true', page_size: 100 }),
    enabled: showGuestModal,
  });
  const existingGuests = guestsData?.results || [];

  const deletePlayerMutation = useMutation({
    mutationFn: (id: number) => playersService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['players'] });
      toast.success('Convidado excluído com sucesso!');
    }
  });

  const promotePlayerMutation = useMutation({
    mutationFn: (id: number) => playersService.update(id, { is_guest: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['players'] });
      toast.success('Convidado promovido a atleta oficial!');
    }
  });

  const createGuestMutation = useMutation({
    mutationFn: (data: any) => playersService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['players'] });
      setGuestName('');
      setGuestTab('list');
      toast.success('Novo convidado criado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao criar convidado.');
    }
  });

  // Reset para página 1 ao mudar filtros ou busca
  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['players', debouncedSearch, positionFilter, statusFilter, page],
    queryFn: () => playersService.list({
      search: debouncedSearch || undefined,
      main_position: positionFilter || undefined,
      status: statusFilter || undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    placeholderData: (prev) => prev, // Mantém dados anteriores durante carregamento
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => playersService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['players'] }),
  });

  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';
  const players = data?.results || [];

  return (
    <div className="space-y-6">
      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        onOpenChange={(isOpen) => setConfirmDialog(s => ({ ...s, isOpen }))}
        title={confirmDialog.title}
        description={confirmDialog.desc}
        onConfirm={confirmDialog.onConfirm}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Atletas</h1>
          <p className="page-subtitle">Cadastro e gestão do elenco.</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setShowGuestModal(true)}
              className="btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-2"
            >
              <Users size={16} />
              <span className="whitespace-nowrap">Convidados</span>
            </button>
            <Link to="/players/new" className="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2">
              <Plus size={16} />
              <span className="whitespace-nowrap">Novo Atleta</span>
            </Link>
          </div>
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
              onChange={handleSearchChange}
              className="input w-full pl-9"
            />
          </div>

          {/* Position filter */}
          <select
            value={positionFilter}
            onChange={handleFilterChange(setPositionFilter)}
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
            onChange={handleFilterChange(setStatusFilter)}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
          {players.map((player, idx) => (
            <PlayerCard
              key={player.id}
              player={player}
              idx={idx}
              canEdit={canEdit}
              onDelete={() => {
                setConfirmDialog({
                  isOpen: true,
                  title: 'Remover Jogador',
                  desc: `Remover ${player.display_name}?`,
                  onConfirm: () => deleteMutation.mutate(player.id)
                });
              }}
            />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[600px]">
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
                        <p className="text-text-primary font-medium text-sm flex items-center gap-1">
                          {player.display_name}
                          {player.is_guest && (
                            <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded uppercase font-bold">
                              Convidado
                            </span>
                          )}
                        </p>
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
                              setConfirmDialog({
                                isOpen: true,
                                title: 'Remover Jogador',
                                desc: `Remover ${player.display_name}?`,
                                onConfirm: () => deleteMutation.mutate(player.id)
                              });
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

      {/* Paginação */}
      {data && data.count > PAGE_SIZE && (
        <Pagination
          count={data.count}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      {/* Guest Manager Modal */}
      {showGuestModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card max-w-md w-full p-6 shadow-xl flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-display text-text-primary flex items-center gap-2">
                <Users className="text-red" />
                Gerenciar Convidados
              </h2>
              <button onClick={() => setShowGuestModal(false)} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border mb-4 mt-2">
              <button
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  guestTab === 'list'
                    ? 'border-red text-text-primary'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
                onClick={() => setGuestTab('list')}
              >
                Selecionar Existente
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  guestTab === 'new'
                    ? 'border-red text-text-primary'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
                onClick={() => setGuestTab('new')}
              >
                Novo Convidado
              </button>
            </div>

            {guestTab === 'new' && (
              <div className="space-y-4 overflow-y-auto pr-2">
                <div>
                  <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">
                    Nome do Convidado *
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="input w-full"
                    placeholder="Ex: João Silva"
                  />
                </div>

                <div>
                  <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">
                    Posição Principal *
                  </label>
                  <select
                    value={guestPosition}
                    onChange={(e) => setGuestPosition(e.target.value as Position)}
                    className="input w-full"
                  >
                    <option value="outside">Ponteiro</option>
                    <option value="setter">Levantador</option>
                    <option value="middle">Central</option>
                    <option value="opposite">Oposto</option>
                    <option value="libero">Líbero</option>
                    <option value="universal">Universal</option>
                  </select>
                </div>

                <div>
                  <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">
                    Convidado por
                  </label>
                  <input
                    type="text"
                    value={guestInvitedBy}
                    onChange={(e) => setGuestInvitedBy(e.target.value)}
                    className="input w-full"
                    placeholder="Seu nome"
                  />
                </div>

                <div className="flex justify-end pt-4 mt-2 border-t border-border">
                  <button
                    onClick={() =>
                      createGuestMutation.mutate({
                        name: guestName,
                        main_position: guestPosition,
                        is_guest: true,
                        invited_by: guestInvitedBy,
                        status: 'active',
                      })
                    }
                    disabled={!guestName || createGuestMutation.isPending}
                    className="btn-primary"
                  >
                    {createGuestMutation.isPending ? 'Criando...' : 'Criar Convidado'}
                  </button>
                </div>
              </div>
            )}

            {guestTab === 'list' && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {loadingGuests ? (
                  <div className="py-8 text-center text-text-muted animate-pulse">Carregando convidados...</div>
                ) : existingGuests.length === 0 ? (
                  <div className="py-12 text-center text-text-muted">
                    <p>Nenhum convidado no sistema.</p>
                    <button
                      onClick={() => setGuestTab('new')}
                      className="mt-4 text-red hover:underline text-sm font-bold"
                    >
                      Cadastrar o primeiro convidado
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 overflow-y-auto pr-2 pb-2">
                    {existingGuests.map(guest => (
                    <div key={guest.id} className="flex items-center justify-between bg-surface/50 p-3 rounded-xl border border-border">
                      <div className="flex items-center gap-3">
                        <Avatar name={guest.name} src={guest.avatar_url} size="sm" />
                        <div>
                          <p className="text-sm font-bold text-text-primary">{guest.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <PositionBadge position={guest.main_position} />
                            {guest.invited_by && (
                              <span className="text-[9px] text-text-muted uppercase truncate max-w-[80px]">
                                Por: {guest.invited_by}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: 'Promover a Oficial',
                              desc: `Deseja transformar ${guest.name} em um Atleta Oficial? Ele passará a aparecer nas estatísticas principais e ranking do Dashboard.`,
                              onConfirm: () => promotePlayerMutation.mutate(guest.id)
                            });
                          }}
                          disabled={promotePlayerMutation.isPending}
                          className="p-1.5 text-yellow-500 hover:bg-yellow-500/10 rounded-md transition-colors flex flex-col items-center gap-1"
                          title="Promover a Oficial"
                        >
                          <Star size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: 'Excluir Convidado',
                              desc: `Tem certeza que deseja apagar o convidado ${guest.name} do sistema?`,
                              onConfirm: () => deletePlayerMutation.mutate(guest.id)
                            });
                          }}
                          disabled={deletePlayerMutation.isPending}
                          className="p-1.5 text-text-muted hover:text-red hover:bg-red/10 rounded-md transition-colors"
                          title="Excluir Convidado"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </motion.div>
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
  const navigate = useNavigate();

  const getCardStyle = (overall?: number) => {
    if (!overall) return 'from-zinc-700 via-zinc-800 to-zinc-900 border-zinc-600 text-zinc-100';
    if (overall >= 8.5) return 'from-yellow-500 via-yellow-600 to-yellow-800 border-yellow-400 text-white';
    if (overall >= 7.0) return 'from-zinc-200 via-zinc-400 to-zinc-500 border-zinc-100 text-zinc-900';
    return 'from-amber-700 via-orange-800 to-amber-900 border-amber-600 text-orange-50';
  };

  const cardStyle = getCardStyle(player.latest_overall);
  const isInactive = player.status === 'inactive' || player.status === 'suspended';
  const hasAbsenceRisk = player.consecutive_absences >= 8 && player.status === 'active';

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'libero': return 'text-cyan-300 drop-shadow-[0_0_3px_rgba(0,0,0,0.8)]';
      case 'setter': return 'text-purple-300 drop-shadow-[0_0_3px_rgba(0,0,0,0.8)]';
      case 'opposite': return 'text-red-300 drop-shadow-[0_0_3px_rgba(0,0,0,0.8)]';
      case 'outside': return 'text-green-300 drop-shadow-[0_0_3px_rgba(0,0,0,0.8)]';
      case 'middle': return 'text-yellow-300 drop-shadow-[0_0_3px_rgba(0,0,0,0.8)]';
      case 'universal': return 'text-orange-300 drop-shadow-[0_0_3px_rgba(0,0,0,0.8)]';
      default: return 'text-white';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: idx * 0.03 }}
      className={`relative w-full max-w-[240px] mx-auto group ${isInactive ? 'opacity-60 grayscale-[0.8]' : ''} mb-6`}
    >
      {/* Alertas Externos no Topo */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 z-20 w-max pointer-events-none">
         {player.is_guest && (
            <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded shadow-md uppercase font-bold tracking-wider">Convidado</span>
         )}
         {hasAbsenceRisk && (
            <span className="text-[9px] bg-orange-600 text-white px-2 py-0.5 rounded shadow-md uppercase font-bold flex items-center gap-1 animate-pulse" title={`${player.consecutive_absences} faltas seguidas`}>
               <AlertTriangle size={10} /> Risco
            </span>
         )}
      </div>

      <Link to={`/players/${player.id}`} className="block w-full">
        {/* Usando aspect-ratio fixo para as cartas terem proporção perfeita 2:3 */}
        <div className={`w-full aspect-[2/3] rounded-t-xl rounded-b-[2.5rem] border-[3px] flex flex-col p-3 bg-gradient-to-br shadow-xl relative overflow-hidden group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] transition-all duration-300 ${cardStyle}`}>
          
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 group-hover:translate-x-full transition-all duration-700 pointer-events-none -translate-x-full skew-x-12" />

          {/* Top Left: Overall & Position */}
          <div className="absolute top-4 left-4 flex flex-col items-center z-10 w-12 sm:w-14">
            <span 
              className="font-display text-4xl sm:text-5xl font-black leading-none drop-shadow-[0_0_4px_rgba(0,0,0,0.5)]"
              style={{ color: player.latest_overall ? getOverallColor(player.latest_overall) : undefined }}
            >
              {player.latest_overall ? player.latest_overall.toFixed(1) : '-'}
            </span>
            <span className={`font-bold text-xs sm:text-sm uppercase tracking-widest mt-1 w-full text-center ${getPositionColor(player.main_position)}`}>
              {POSITION_LABELS[player.main_position]?.substring(0, 3)}
            </span>
          </div>

          {/* Top Right: Status & Star */}
          <div className="absolute top-4 right-4 flex flex-col items-center gap-2 z-10">
            {player.status === 'active' ? (
              <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] border border-white/40" title="Ativo" />
            ) : player.status === 'injured' ? (
              <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)] border border-white/40" title="Lesionado" />
            ) : (
              <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-zinc-600 shadow-[0_0_8px_rgba(82,82,91,0.8)] border border-white/40" title="Inativo/Suspenso" />
            )}
            
            {player.mini_stars > 0 && (
              <div className="flex flex-col items-center mt-1">
                <Star size={12} className="sm:w-4 sm:h-4 fill-yellow-400 text-yellow-400 drop-shadow-md" />
                <span className="text-[9px] font-bold mt-0.5">{player.mini_stars}</span>
              </div>
            )}
          </div>

          {/* Avatar Centered */}
          <div className={`absolute inset-x-0 top-6 sm:top-8 bottom-[35%] flex ${player.avatar_url?.toLowerCase().includes('.png') ? 'items-end' : 'items-start'} justify-center pointer-events-none z-0`}>
            {player.avatar_url ? (
              <img 
                src={player.avatar_url} 
                alt={player.name} 
                className={`pointer-events-auto ${
                  player.avatar_url.toLowerCase().includes('.png')
                    ? 'h-[110%] w-[110%] object-contain object-bottom drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]'
                    : 'h-[90%] aspect-square object-cover object-top rounded-full border-[3px] border-current/20 shadow-xl mt-2'
                }`} 
              />
            ) : (
              <div className="h-[80%] aspect-square rounded-full border-[3px] border-current/20 shadow-xl overflow-hidden flex items-center justify-center bg-black/10 pointer-events-auto mb-2">
                 <Avatar name={player.display_name} size="xl" className="w-full h-full text-4xl sm:text-5xl opacity-80" />
              </div>
            )}
          </div>

          {/* Spacer for Avatar */}
          <div className="flex-1" />

          {/* Divider */}
          <div className="w-10/12 h-[1.5px] bg-current/40 mx-auto mb-1 sm:mb-2 z-10" />

          {/* Name */}
          <div className="text-center z-10 px-2 mb-1 sm:mb-2">
            <h3 className="font-display text-base sm:text-xl font-bold uppercase tracking-widest drop-shadow-md truncate">
              {player.display_name}
            </h3>
          </div>

          {/* Stats Grid 2x2 */}
          <div className="flex justify-center w-full z-10 mb-2 sm:mb-3 px-2">
             <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-1 text-[9px] sm:text-[11px] font-bold uppercase opacity-90 w-full max-w-[180px]">
                {/* Col 1 */}
                <div className="flex justify-between items-center pr-2 border-r border-current/30">
                  <span className="opacity-70">ATQ</span>
                  <span className="text-xs sm:text-sm">{player.attack_stars}</span>
                </div>
                {/* Col 2 */}
                <div className="flex justify-between items-center pl-2">
                  <span className="opacity-70">DEF</span>
                  <span className="text-xs sm:text-sm">{player.defense_stars}</span>
                </div>
                {/* Col 1 */}
                <div className="flex justify-between items-center pr-2 border-r border-current/30">
                  <span className="opacity-70">MVP</span>
                  <span className="text-xs sm:text-sm">{player.mvp_stars}</span>
                </div>
                {/* Col 2 */}
                <div className="flex justify-between items-center pl-2">
                  <span className="opacity-70">GLR</span>
                  <span className="text-xs sm:text-sm">{player.big_stars}</span>
                </div>
             </div>
          </div>
        </div>
      </Link>

      {/* Admin Actions Overlay (External bottom) */}
      {canEdit && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 z-20 flex flex-row gap-3 pointer-events-none md:translate-y-2 md:group-hover:translate-y-0">
          <button 
            onClick={(e) => { e.preventDefault(); navigate(`/players/${player.id}/edit`); }} 
            className="p-2 sm:p-2.5 rounded-full bg-surface/95 text-text-primary shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-border hover:bg-surface pointer-events-auto hover:scale-110 transition-transform"
            title="Editar Jogador"
          >
            <Edit size={14} className="sm:w-4 sm:h-4" />
          </button>
          <button 
            onClick={(e) => { e.preventDefault(); onDelete(); }} 
            className="p-2 sm:p-2.5 rounded-full bg-red-600/95 text-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-red-500 hover:bg-red pointer-events-auto hover:scale-110 transition-transform"
            title="Deletar Jogador"
          >
            <Trash2 size={14} className="sm:w-4 sm:h-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
