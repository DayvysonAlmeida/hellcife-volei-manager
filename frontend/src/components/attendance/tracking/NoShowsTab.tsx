import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/Loading";
import { NoShowRow } from "./NoShowRow";
import type { Attendance } from "@/types";

interface NoShowsTabProps {
  noShows: Attendance[];
  onJustify: (id: number, text: string) => void;
}

export function NoShowsTab({ noShows, onJustify }: NoShowsTabProps) {
  return (
    <motion.div key="noshows" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="card p-4">
      <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4"><AlertTriangle size={20} className="text-red" /> Histórico de Faltas (No-shows)</h2>
      <p className="text-text-muted text-sm mb-4">Jogadores que colocaram o nome na lista, mas não fizeram check-in na quadra.</p>
      {noShows.length === 0 ? <EmptyState icon="✅" message="Tudo certo! Não há registros de no-shows no sistema." /> : (
        <div className="space-y-4">
          {noShows.map((att) => <NoShowRow key={att.id} attendance={att} onJustify={(text) => onJustify(att.id, text)} />)}
        </div>
      )}
    </motion.div>
  );
}
