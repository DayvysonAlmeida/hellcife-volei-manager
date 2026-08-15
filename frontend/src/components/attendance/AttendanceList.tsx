import { useState } from 'react';
import { Search, Plus, RefreshCw, Check, Users, DollarSign, X, GripVertical, Clock } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableWaitlistCard({ att, idx, renderCard, showEditControls }: {
  att: any;
  idx: number;
  renderCard: (att: any, idx?: number, isWaitlist?: boolean) => React.ReactNode;
  showEditControls: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: att.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as any,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {showEditControls && (
        <button
          {...attributes}
          {...listeners}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 w-6 h-10 flex items-center justify-center text-text-muted/50 hover:text-yellow-500 cursor-grab active:cursor-grabbing touch-none"
          title="Arrastar para reordenar"
        >
          <GripVertical size={14} />
        </button>
      )}
      <div className={showEditControls ? 'pl-5' : ''}>
        {renderCard(att, idx, true)}
      </div>
    </div>
  );
}

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
  showPaymentControls: boolean;
  gamedayId?: number;
  onReorderWaitlist?: (gamedayId: number, attendanceIds: number[]) => void;
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
  showPaymentControls,
  gamedayId,
  onReorderWaitlist,
}: AttendanceListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [filterMode, setFilterMode] = useState<'all' | 'confirmed' | 'pending'>('all');

  const filteredPresent = presentAttendances.filter(att => {
    if (filterMode === 'pending') return !att.has_paid;
    return true;
  });

  const showWaitlist = filterMode === 'all';
  const showAbsent = filterMode === 'all';

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = waitlistAttendances.findIndex(a => a.id === active.id);
    const newIndex = waitlistAttendances.findIndex(a => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(waitlistAttendances, oldIndex, newIndex);
    if (gamedayId && onReorderWaitlist) {
      onReorderWaitlist(gamedayId, reordered.map(a => a.id));
    }
  };
  const renderAttendanceCard = (att: any, index?: number, isWaitlist?: boolean) => {
    const isPresent = att.present;
    const isPaid = att.has_paid;

    return (
      <div
        key={att.id}
        className={`relative group flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-[16px] border transition-all duration-300 text-left overflow-hidden shadow-lg
          ${
            att.player_status !== 'active'
              ? 'bg-[#0a0a0a] border-[#222] opacity-50 grayscale'
              : isPresent
              ? 'bg-gradient-to-br from-[#161616] to-[#0a0a0a] border-[#333] hover:border-green-500/40 hover:shadow-[0_0_15px_rgba(34,197,94,0.15)]'
              : isWaitlist
              ? 'bg-gradient-to-br from-[#161616] to-[#0a0a0a] border-[#333] hover:border-yellow-500/40 hover:shadow-[0_0_15px_rgba(234,179,8,0.15)]'
              : 'bg-[#0a0a0a] border-[#222] hover:border-[#444]'
          }`}
      >
        {/* Left side (Mobile) / Top side (Desktop) */}
        <div className="flex flex-row sm:flex-col items-center sm:items-start gap-3 w-full min-w-0">
          <div className="flex items-center sm:w-full sm:justify-between">
            <Avatar name={att.player_name} src={att.player_avatar} size="md" className="sm:w-12 sm:h-12 border border-[#333]" />
            {isWaitlist && index !== undefined && (
              <span className="hidden sm:flex w-6 h-6 rounded-full bg-yellow-500/10 text-yellow-500 items-center justify-center text-xs font-black border border-yellow-500/20">
                {index + 1}
              </span>
            )}
            {isWaitlist && index !== undefined && (
              <span className="sm:hidden text-yellow-500 text-xs font-black ml-2">
                {index + 1}º
              </span>
            )}
          </div>
          
          <div className="flex-1 min-w-0 flex flex-col sm:mt-1">
            <p className="text-white text-sm sm:text-base font-bold truncate">
              {att.player_name}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5 items-center">
              <PositionBadge position={att.player_position} />
              {att.player_is_guest && (
                <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-widest font-black border border-blue-500/30">
                  Conv.
                </span>
              )}
              {att.player_status !== 'active' && (
                <span className="text-[9px] bg-red/10 text-red px-1.5 py-0.5 rounded uppercase tracking-widest font-black border border-red/30">
                  Inativo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side (Mobile) / Bottom side (Desktop) */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between w-auto sm:w-full gap-2 sm:mt-auto sm:pt-2 sm:border-t sm:border-[#222]">
          
          {/* Status Text (Pago / Aguardando / Pendente) */}
          <div className="flex flex-col items-end sm:items-start min-h-[16px]">
            {isPresent && (
              isPaid ? (
                <div className="flex items-center gap-1 text-green-500">
                  <Check size={12} strokeWidth={3} />
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Pago</span>
                </div>
              ) : att.payment_claimed ? (
                <div className="flex items-center gap-1 text-orange-500 animate-pulse">
                  <DollarSign size={12} strokeWidth={3} />
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Avisou</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-red">
                  <DollarSign size={12} strokeWidth={3} />
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Pendente</span>
                </div>
              )
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-1 sm:mt-0">
            {showEditControls ? (
              <>
                {showPaymentControls && (
                  <button
                    onClick={() => onTogglePayment(att.player)}
                    disabled={isTogglingPayment(att.player)}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 hover:scale-110 active:scale-95 ${
                      att.has_paid
                        ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                        : att.payment_claimed
                        ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]'
                        : 'bg-[#111] border border-[#333] text-white/40 hover:border-green-500 hover:text-green-500 hover:bg-green-500/10'
                    }`}
                    title={att.payment_claimed ? "Atleta avisou que pagou. Clique para confirmar." : "Alternar Pagamento"}
                  >
                    <DollarSign size={14} strokeWidth={3} />
                  </button>
                )}
                <button
                  onClick={() => onTogglePresence(att.player)}
                  disabled={isTogglingPresence(att.player)}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 hover:scale-110 active:scale-95 ${
                    att.is_waitlist
                      ? 'bg-[#111] border border-red/50 text-red hover:bg-red hover:text-white hover:shadow-[0_0_15px_rgba(217,4,41,0.4)]'
                      : att.present
                      ? 'bg-red text-white shadow-[0_0_15px_rgba(217,4,41,0.4)] border border-red'
                      : 'bg-[#111] border border-[#333] text-white/40 hover:border-red hover:text-red hover:bg-red/10'
                  }`}
                  title={att.is_waitlist ? "Remover da Fila" : "Alternar Presença"}
                >
                  {att.is_waitlist ? <X size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}
                </button>
              </>
            ) : (
              // Read-only badges if edit controls are disabled
              <>
                {(att.has_paid || att.payment_claimed) && (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${att.has_paid ? 'bg-green-500' : 'bg-orange-500'}`}>
                    <DollarSign size={12} className="text-white" />
                  </div>
                )}
                {att.present && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-red">
                    <Check size={12} className="text-white" strokeWidth={3} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="mb-6 border-b border-[#222] pb-6">
        <h3 className="text-[11px] font-black text-white/60 uppercase tracking-[0.2em] mb-4">
          PRESENÇA
        </h3>

        <div className="flex flex-col gap-4 w-full">
          {/* Fila Superior: Busca e Ações */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
            {/* Barra de Busca */}
            <div className="relative flex-1 w-full lg:max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"
              />
              <input
                type="text"
                placeholder="Buscar atleta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:border-red focus:ring-1 focus:ring-red/50 transition-all shadow-inner"
              />
            </div>

            {/* Botões de Ação */}
            {showEditControls && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={onAddGuestClick}
                  className="bg-red hover:bg-red-600 text-white py-2.5 px-4 rounded-xl text-xs font-black flex items-center gap-2 transition-colors shadow-lg shadow-red/20 border border-red/50"
                  title="Adicionar um convidado para jogar hoje"
                >
                  <Plus size={16} strokeWidth={3} />
                  <span className="uppercase tracking-widest">Convidado</span>
                </button>
                
                {showPaymentControls && (
                  <>
                    <button
                      onClick={onCheckAll}
                      disabled={isBulkLoading}
                      className="bg-[#0a0a0a] border border-green-500/20 hover:border-green-500/50 hover:bg-green-500/10 text-green-500 py-2.5 px-4 rounded-xl text-[10px] sm:text-xs font-black flex items-center gap-1.5 transition-colors"
                      title="Marcar Todos como Pago"
                    >
                      <DollarSign size={16} strokeWidth={3} />
                      <span className="hidden sm:inline uppercase tracking-widest">Todos Pagos</span>
                    </button>
                    <button
                      onClick={onUncheckAll}
                      disabled={isBulkLoading}
                      className="bg-[#0a0a0a] border border-[#2a2a2a] hover:border-red/50 hover:bg-red/10 text-white/40 hover:text-red py-2.5 px-4 rounded-xl text-[10px] sm:text-xs font-black flex items-center gap-1.5 transition-colors"
                      title="Desmarcar Pagamentos"
                    >
                      <DollarSign size={16} strokeWidth={3} />
                      <span className="hidden sm:inline uppercase tracking-widest">Zerar Pagos</span>
                    </button>
                  </>
                )}
                
                <button
                  onClick={onRefreshClick}
                  disabled={isRefreshing}
                  className="bg-[#0a0a0a] border border-[#2a2a2a] hover:border-white/20 text-white/40 hover:text-white py-2.5 px-3 rounded-xl flex items-center justify-center transition-colors h-10 w-10"
                  title="Puxar novos jogadores ativos para esta lista"
                >
                  <RefreshCw
                    size={16}
                    className={isRefreshing ? 'animate-spin' : ''}
                  />
                </button>
              </div>
            )}
          </div>

          {/* Fila Inferior: Filtros de Visualização */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setFilterMode('all')}
              className={`py-1.5 px-4 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-colors border ${
                filterMode === 'all' 
                  ? 'bg-red text-white border-red shadow-lg shadow-red/20' 
                  : 'bg-transparent text-white/40 border-[#333] hover:border-white/20 hover:text-white'
              }`}
            >
              Todos ({presentAttendances.length + waitlistAttendances.length + absentAttendances.length})
            </button>
            <button
              onClick={() => setFilterMode('confirmed')}
              className={`py-1.5 px-4 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-colors border ${
                filterMode === 'confirmed' 
                  ? 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/20' 
                  : 'bg-transparent text-white/40 border-[#333] hover:border-white/20 hover:text-white'
              }`}
            >
              Confirmados ({presentAttendances.length})
            </button>
            {showPaymentControls && (
              <button
                onClick={() => setFilterMode('pending')}
                className={`py-1.5 px-4 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-1.5 transition-colors border ${
                  filterMode === 'pending' 
                    ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20' 
                    : 'bg-transparent text-white/40 border-[#333] hover:border-white/20 hover:text-white'
                }`}
              >
                Pendentes <DollarSign size={12} strokeWidth={3} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Container Rolável para os Atletas */}
      <div className="max-h-[55vh] lg:max-h-[65vh] overflow-y-auto sm:pr-2 scrollbar-hide sm:custom-scrollbar sm:-mr-2 pb-10">
        {/* Seção Confirmados */}
        {filteredPresent.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-black text-green-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 drop-shadow-md">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
              CONFIRMADOS • {filteredPresent.length}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredPresent.map((att) => renderAttendanceCard(att))}
            </div>
          </div>
        )}

        {/* Seção Fila de Espera */}
        {showWaitlist && waitlistAttendances.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-yellow-500 uppercase tracking-[0.2em] flex items-center gap-2 drop-shadow-sm">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                AGUARDANDO FILA • {waitlistAttendances.length}
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={waitlistAttendances.map(a => a.id)} strategy={verticalListSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {waitlistAttendances.map((att, idx) => (
                    <SortableWaitlistCard key={att.id} att={att} idx={idx} renderCard={renderAttendanceCard} showEditControls={showEditControls} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Seção Pendentes / Ausentes */}
        {showAbsent && absentAttendances.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 drop-shadow-sm">
              NÃO CONFIRMADOS • {absentAttendances.length}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
      </div>

      {showEditControls && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={onSaveClick}
            className="btn-primary flex items-center gap-2 px-6 py-2.5"
          >
            <Check size={18} />
            Salvar e Ir para Tiragem de Falta
          </button>
        </div>
      )}
    </>
  );
}
