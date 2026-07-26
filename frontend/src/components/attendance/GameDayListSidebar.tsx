import { Trash2, ChevronRight, DollarSign } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { EmptyState, PageLoading } from '@/components/ui/Loading';

import type { GameDay } from '@/types';

interface GameDayListSidebarProps {
  isLoading: boolean;
  gameDays: GameDay[];
  activeGameDays: GameDay[];
  historyGameDays: GameDay[];
  selectedGameDayId: number | null;
  onSelectGameDay: (gd: GameDay) => void;
  circuitTab: 'active' | 'history';
  setCircuitTab: (tab: 'active' | 'history') => void;
  canEdit?: boolean;
  onDeleteGameDay?: (id: number) => void;
  isDeleting?: boolean;
  fullText?: string;
}

export function GameDayListSidebar({
  isLoading,
  gameDays,
  activeGameDays,
  historyGameDays,
  selectedGameDayId,
  onSelectGameDay,
  circuitTab,
  setCircuitTab,
  canEdit = false,
  onDeleteGameDay,
  isDeleting = false,
  fullText = 'LOTADO',
}: GameDayListSidebarProps) {
  const currentList = circuitTab === 'active' ? activeGameDays : historyGameDays;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-4 mb-4 border-b border-border">
        <button
          onClick={() => setCircuitTab('active')}
          className={`pb-2 px-1 text-sm font-bold border-b-2 transition-colors ${
            circuitTab === 'active' ? 'border-red text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Abertos ({activeGameDays.length})
        </button>
        <button
          onClick={() => setCircuitTab('history')}
          className={`pb-2 px-1 text-sm font-bold border-b-2 transition-colors ${
            circuitTab === 'history' ? 'border-red text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Histórico ({historyGameDays.length})
        </button>
      </div>
      
      {isLoading ? (
        <PageLoading />
      ) : gameDays.length === 0 ? (
        <EmptyState message="Nenhum circuito cadastrado." icon="📅" />
      ) : currentList.length === 0 ? (
        <EmptyState message={`Nenhum circuito ${circuitTab === 'active' ? 'aberto' : 'no histórico'}.`} icon="📅" />
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {currentList.map((gd) => (
            <div key={gd.id} className="relative">
              <div
                onClick={() => onSelectGameDay(gd)}
                role="button"
                tabIndex={0}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all text-left cursor-pointer
                  ${selectedGameDayId === gd.id ? 'bg-red/10 border border-red/30' : 'hover:bg-surface border border-transparent'}`}
              >
                <div>
                  <p className="text-text-primary text-sm font-medium">
                    {formatDate(gd.date)} {gd.time ? `- ${gd.time.slice(0, 5)}` : ''}
                  </p>
                  {gd.location && <p className="text-text-muted text-xs">{gd.location}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <div className="flex items-center gap-1 bg-surface-hover px-1.5 py-0.5 rounded border border-border">
                      <span className={`w-1.5 h-1.5 rounded-full ${gd.max_players && gd.total_present >= gd.max_players ? 'bg-red' : 'bg-green-500'}`} />
                      <span className="text-[10px] text-text-muted font-medium">
                        {gd.total_present}/{gd.max_players ? gd.max_players : gd.total_players}
                        {gd.max_players && gd.total_present >= gd.max_players ? ` (${fullText})` : ''}
                      </span>
                    </div>
                    {gd.total_paid !== undefined && (
                      <div className="flex items-center gap-1 bg-green-500/10 px-1.5 py-0.5 rounded">
                        <DollarSign size={10} className="text-green-500" />
                        <span className="text-[10px] text-green-500 font-medium">
                          {gd.total_paid}/{gd.total_present}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && onDeleteGameDay && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteGameDay(gd.id);
                      }}
                      disabled={isDeleting}
                      className="p-1.5 text-text-muted hover:text-red hover:bg-red/10 rounded-md transition-colors"
                      title="Excluir Circuito"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <ChevronRight size={16} className={selectedGameDayId === gd.id ? 'text-red' : 'text-border'} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
