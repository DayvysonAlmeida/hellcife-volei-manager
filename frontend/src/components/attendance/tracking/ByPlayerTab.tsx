import { motion } from "framer-motion";
import { UserX } from "lucide-react";
import { EmptyState } from "@/components/ui/Loading";
import { PlayerAbsenceRow } from "./PlayerAbsenceRow";
import type { Attendance, Player } from "@/types";

export interface PlayerAbsencesEntry {
  player_id: number;
  player_name: string;
  player_avatar?: string;
  absences: Attendance[];
}

interface ByPlayerTabProps {
  playerAbsences: PlayerAbsencesEntry[];
  noShows: Attendance[];
  playerMap: Map<number, Player>;
  onJustify: (id: number, text: string) => void;
}

export function ByPlayerTab({ playerAbsences, noShows, playerMap, onJustify }: ByPlayerTabProps) {
  return (
    <motion.div key="byplayer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="font-black text-3xl text-red">{playerAbsences.length}</p>
          <p className="text-text-muted text-[10px] uppercase tracking-wider mt-1">Atletas com Faltas</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-black text-3xl text-orange-500">{noShows.length}</p>
          <p className="text-text-muted text-[10px] uppercase tracking-wider mt-1">Total de No-shows</p>
        </div>
        <div className="card p-4 text-center col-span-2 sm:col-span-1">
          <p className="font-black text-3xl text-green-500">{noShows.filter(a => a.is_justified).length}</p>
          <p className="text-text-muted text-[10px] uppercase tracking-wider mt-1">Justificadas</p>
        </div>
      </div>
      <div className="card p-4">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-1"><UserX size={20} className="text-red" /> Ausências por Atleta</h2>
        <p className="text-text-muted text-xs mb-4">Ordenados por total de circuitos perdidos. Expanda para ver o histórico detalhado.</p>
        {playerAbsences.length === 0 ? <EmptyState icon="✅" message="Nenhum atleta com ausências registradas." /> : (
          <div className="space-y-3">
            {playerAbsences.map(entry => {
              const fullPlayer = playerMap.get(entry.player_id);
              const consecutiveAbsences = fullPlayer?.consecutive_absences ?? 0;
              const totalJustified = entry.absences.filter(a => a.is_justified).length;
              const totalUnjustified = entry.absences.length - totalJustified;
              return (
                <PlayerAbsenceRow
                  key={entry.player_id}
                  playerId={entry.player_id}
                  playerName={entry.player_name}
                  playerAvatar={entry.player_avatar}
                  isGuest={entry.absences[0]?.player_is_guest}
                  invitedBy={entry.absences[0]?.player_invited_by}
                  absences={entry.absences}
                  consecutiveAbsences={consecutiveAbsences}
                  totalJustified={totalJustified}
                  totalUnjustified={totalUnjustified}
                  onJustify={onJustify}
                />
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
