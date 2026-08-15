import { Trash2, ChevronRight, DollarSign, Calendar } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
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
  countType?: 'circuit' | 'court';
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
  countType = 'circuit',
}: GameDayListSidebarProps) {
  const currentList = circuitTab === 'active' ? activeGameDays : historyGameDays;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-6 bg-black/20 p-1.5 rounded-[1.25rem] border border-white/5">
        <button
          onClick={() => setCircuitTab('active')}
          className={cn(
            "flex-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all",
            circuitTab === 'active' 
              ? "bg-red text-white shadow-[0_0_15px_rgba(217,4,41,0.4)]" 
              : "text-text-muted hover:text-text-primary hover:bg-white/5"
          )}
        >
          Abertos ({activeGameDays.length})
        </button>
        <button
          onClick={() => setCircuitTab('history')}
          className={cn(
            "flex-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all",
            circuitTab === 'history' 
              ? "bg-surface-highlight text-white border border-border" 
              : "text-text-muted hover:text-text-primary hover:bg-white/5"
          )}
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
          {currentList.map((gd) => {
            const dateObj = new Date(`${gd.date}T12:00:00`);
            const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
            const dayNum = dateObj.toLocaleDateString('pt-BR', { day: '2-digit' });
            const month = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            const timeStr = gd.time ? ` às ${gd.time.slice(0, 5)}` : '';
            const dateFormatted = `${dayName}., ${dayNum} ${month}${timeStr}`;
            
            return (
              <div key={gd.id} className="relative group">
                <div
                  onClick={() => onSelectGameDay(gd)}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "w-full flex flex-col p-4 rounded-2xl transition-all text-left cursor-pointer border mb-3 overflow-hidden relative",
                    selectedGameDayId === gd.id 
                      ? "bg-red/10 border-red/30 shadow-[0_0_15px_rgba(217,4,41,0.15)]" 
                      : "bg-surface/30 border-white/5 hover:bg-surface-highlight/40 hover:border-white/10"
                  )}
                >
                  {/* Indicador lateral sutil (para os selecionados) */}
                  {selectedGameDayId === gd.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-red shadow-[0_0_10px_rgba(217,4,41,0.8)]" />
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className={cn(
                        "font-display text-sm uppercase tracking-widest truncate",
                        selectedGameDayId === gd.id ? "text-red" : "text-text-primary"
                      )}>
                        {gd.location || 'PELADA'}
                      </h3>
                      <p className="text-text-muted text-[10px] mt-1 capitalize font-bold flex items-center gap-1.5">
                         <Calendar size={12} className={selectedGameDayId === gd.id ? "text-red" : "text-text-muted/60"} />
                         {dateFormatted}
                      </p>
                    
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-md border border-white/5">
                        {countType === 'court' ? (
                          <>
                            <span className={cn('w-1.5 h-1.5 rounded-full', gd.total_court_checkins !== undefined && gd.total_court_checkins >= gd.total_present && gd.total_present > 0 ? 'bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]' : 'bg-yellow-400 shadow-[0_0_5px_rgba(250,204,21,0.5)]')} />
                            <span className="text-[9px] text-white/80 font-black uppercase tracking-widest">
                              {gd.total_court_checkins || 0}/{gd.total_present} quadra
                            </span>
                          </>
                        ) : (
                          <>
                            <span className={cn('w-1.5 h-1.5 rounded-full', gd.max_players && gd.total_present >= gd.max_players ? 'bg-red shadow-[0_0_5px_rgba(217,4,41,0.5)]' : 'bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]')} />
                            <span className="text-[9px] text-white/80 font-black uppercase tracking-widest">
                              {gd.total_present}/{gd.max_players ? gd.max_players : gd.total_players}
                              {gd.max_players && gd.total_present >= gd.max_players ? ` (${fullText})` : ''}
                            </span>
                          </>
                        )}
                      </div>
                      
                      {gd.total_paid !== undefined && (
                        <div className="flex items-center gap-1.5 bg-green-500/10 px-2.5 py-1 rounded-md border border-green-500/20">
                          <DollarSign size={10} className="text-green-400" />
                          <span className="text-[9px] text-green-400 font-black uppercase tracking-widest">
                            {gd.total_paid}/{gd.total_present}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between self-stretch flex-shrink-0">
                    <ChevronRight size={18} className={cn("transition-transform", selectedGameDayId === gd.id ? "text-red translate-x-1" : "text-text-muted/40 group-hover:text-white group-hover:translate-x-1")} />
                    
                    {canEdit && onDeleteGameDay && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteGameDay(gd.id);
                        }}
                        disabled={isDeleting}
                        className="p-1.5 text-text-muted/40 hover:text-red hover:bg-red/10 rounded-lg transition-colors"
                        title="Excluir Circuito"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
