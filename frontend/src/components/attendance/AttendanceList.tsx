import { Search, Plus, RefreshCw, Check, Users, DollarSign } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';

interface AttendanceListProps {
  presentAttendances: any[];
  absentAttendances: any[];
  waitlistAttendances: any[];
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  showEditControls: boolean;
  onAddGuestClick: () => void;
  onRefreshClick: () => void;
  isRefreshing: boolean;
  onPromoteWaitlist: () => void;
  isPromoting: boolean;
  onSaveClick: () => void;
  onTogglePresence: (playerId: number) => void;
  onTogglePayment: (playerId: number) => void;
  isTogglingPresence: (playerId: number) => boolean;
  isTogglingPayment: (playerId: number) => boolean;
  onCheckAll: () => void;
  onUncheckAll: () => void;
  isBulkLoading: boolean;
}

export function AttendanceList({
  presentAttendances,
  absentAttendances,
  waitlistAttendances,
  searchTerm,
  setSearchTerm,
  showEditControls,
  onAddGuestClick,
  onRefreshClick,
  isRefreshing,
  onPromoteWaitlist,
  isPromoting,
  onSaveClick,
  onTogglePresence,
  onTogglePayment,
  isTogglingPresence,
  isTogglingPayment,
  onCheckAll,
  onUncheckAll,
  isBulkLoading,
}: AttendanceListProps) {
  const renderAttendanceCard = (att: any, index?: number, isWaitlist?: boolean) => {
    return (
      <div
        key={att.id}
        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left
          ${
            att.player_status !== 'active'
              ? 'bg-surface/50 border-border/30 opacity-70'
              : att.present
              ? 'bg-green-950/30 border-green-800/50'
              : isWaitlist
              ? 'bg-yellow-900/10 border-yellow-500/30'
              : 'bg-surface border-border hover:border-border-subtle'
          }`}
      >
        {isWaitlist && index !== undefined && (
          <div className="w-5 text-center font-black text-yellow-500 text-sm">
            {index + 1}º
          </div>
        )}
        <Avatar name={att.player_name} src={att.player_avatar} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-text-primary text-sm font-medium truncate flex items-center gap-2">
            {att.player_name}
            {att.player_is_guest && (
              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                Convidado {att.player_invited_by ? `por: ${att.player_invited_by}` : ''}
              </span>
            )}
            {att.player_status !== 'active' && (
              <span className="text-[10px] bg-red/10 text-red px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                Inativo
              </span>
            )}
          </p>
          <PositionBadge position={att.player_position} />
        </div>

        {showEditControls ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTogglePayment(att.player)}
              disabled={isTogglingPayment(att.player)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                att.has_paid
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                  : 'bg-surface border-2 border-border-subtle text-text-muted hover:border-green-500 hover:text-green-500'
              }`}
              title="Alternar Pagamento"
            >
              <DollarSign size={16} />
            </button>
            <button
              onClick={() => onTogglePresence(att.player)}
              disabled={isTogglingPresence(att.player)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                att.present
                  ? 'bg-red text-white shadow-lg shadow-red/20'
                  : 'bg-surface border-2 border-border-subtle text-text-muted hover:border-red hover:text-red'
              }`}
              title="Alternar Presença"
            >
              <Check size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
              ${att.has_paid ? 'bg-green-500' : 'bg-border'}`}
            >
              {att.has_paid && <DollarSign size={12} className="text-white" />}
            </div>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
              ${att.present ? 'bg-red' : 'bg-border'}`}
            >
              {att.present && <Check size={12} className="text-white" />}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border mb-4 pb-3 sm:pb-0">
        <div className="flex items-center gap-4">
          <span className="sm:pb-2 text-sm font-medium border-b-2 border-transparent sm:border-red text-red">
            Lista de Presença
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto sm:pb-2">
          <div className="relative flex-1 sm:w-48">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              placeholder="Buscar jogador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input w-full pl-8 py-1.5 text-xs bg-surface"
            />
          </div>
          {showEditControls && (
            <>
              <button
                onClick={onAddGuestClick}
                className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1"
                title="Adicionar um convidado para jogar hoje"
              >
                <Plus size={12} />
                <span className="hidden sm:inline">Convidado</span>
              </button>
              <button
                onClick={onCheckAll}
                disabled={isBulkLoading}
                className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 text-green-500 border-green-500/30 hover:bg-green-500/10"
                title="Marcar Todos"
              >
                <span className="hidden sm:inline">Marcar Todos</span>
                <span className="sm:hidden">Todos ✅</span>
              </button>
              <button
                onClick={onUncheckAll}
                disabled={isBulkLoading}
                className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 text-red border-red/30 hover:bg-red/10"
                title="Desmarcar Todos"
              >
                <span className="hidden sm:inline">Desmarcar Todos</span>
                <span className="sm:hidden">Nenhum ❌</span>
              </button>
              <button
                onClick={onRefreshClick}
                disabled={isRefreshing}
                className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1"
                title="Puxar novos jogadores ativos para esta lista"
              >
                <RefreshCw
                  size={12}
                  className={isRefreshing ? 'animate-spin' : ''}
                />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Seção Confirmados */}
      {presentAttendances.length > 0 && (
        <div className="mb-6">
          <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
            <Check size={14} className="text-green-500" /> Confirmados (
            {presentAttendances.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {presentAttendances.map((att) => renderAttendanceCard(att))}
          </div>
        </div>
      )}

      {/* Seção Fila de Espera */}
      {waitlistAttendances.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              Fila de Espera ({waitlistAttendances.length})
            </h3>
            {showEditControls && (
              <button
                onClick={onPromoteWaitlist}
                disabled={isPromoting}
                className="btn-secondary py-1 px-3 text-[10px] flex items-center gap-1 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10"
              >
                Promover Próximo
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {waitlistAttendances.map((att, idx) => renderAttendanceCard(att, idx, true))}
          </div>
        </div>
      )}

      {/* Seção Pendentes / Ausentes */}
      {absentAttendances.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
            <Users size={14} /> Aguardando / Ausentes ({absentAttendances.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {absentAttendances.map((att) => renderAttendanceCard(att))}
          </div>
        </div>
      )}

      {presentAttendances.length === 0 && absentAttendances.length === 0 && waitlistAttendances.length === 0 && (
        <p className="text-text-muted text-center py-8">
          {searchTerm
            ? `Nenhum jogador encontrado com "${searchTerm}".`
            : 'Nenhum jogador na lista.'}
        </p>
      )}

      {showEditControls && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={onSaveClick}
            className="btn-primary flex items-center gap-2 px-6 py-2.5"
          >
            <Check size={18} />
            Salvar e Ir para Sorteio
          </button>
        </div>
      )}
    </>
  );
}
