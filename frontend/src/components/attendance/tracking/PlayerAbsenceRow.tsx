import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { ChevronDown, ChevronUp, Calendar, MapPin, AlertTriangle, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Attendance } from "@/types";

export interface PlayerAbsenceRowProps {
  playerId: number; playerName: string; playerAvatar?: string; absences: Attendance[];
  isGuest?: boolean; invitedBy?: string;
  consecutiveAbsences: number; totalJustified: number; totalUnjustified: number;
  onJustify: (id: number, text: string) => void;
}

export function PlayerAbsenceRow({ playerId, playerName, playerAvatar, absences, isGuest, invitedBy, consecutiveAbsences, totalJustified, totalUnjustified, onJustify }: PlayerAbsenceRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [justifyingId, setJustifyingId] = useState<number | null>(null);
  const [justifyText, setJustifyText] = useState("");

  const isAtRisk = consecutiveAbsences >= 8;
  const isInactive = consecutiveAbsences >= 10;
  const sortedAbsences = [...absences].sort((a, b) => b.gameday - a.gameday);

  return (
    <div className={`rounded-xl border shadow-sm transition-all duration-200 overflow-hidden ${isInactive ? "border-red/40 bg-red/5 hover:border-red/60" : isAtRisk ? "border-orange-500/40 bg-orange-500/5 hover:border-orange-500/60" : "border-border bg-surface hover:border-text-muted/30"}`}>
      <button className="w-full flex items-center justify-between p-4 text-left transition-colors" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-4 min-w-0">
          <Avatar name={playerName} src={playerAvatar} size="md" className="border-2 border-surface" />
          <div className="min-w-0">
            <p className="text-text-primary font-black text-base truncate flex items-center gap-2">
              {playerName}
              {isGuest && (
                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  Convidado {invitedBy ? `por: ${invitedBy}` : ''}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {consecutiveAbsences > 0 && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${isInactive ? "bg-red/20 text-red" : isAtRisk ? "bg-orange-500/20 text-orange-400" : "bg-surface-hover text-text-muted"}`}>
                  {consecutiveAbsences} seguidas{isAtRisk && !isInactive ? " ⚠️" : isInactive ? " 🚫" : ""}
                </span>
              )}
              {totalJustified > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-green-500/15 text-green-400">{totalJustified} justificada{totalJustified > 1 ? "s" : ""}</span>}
              {totalUnjustified > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-red/15 text-red">{totalUnjustified} no-show{totalUnjustified > 1 ? "s" : ""}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 ml-2">
          <div className="text-center bg-surface/50 px-3 py-1.5 rounded-lg border border-border/50">
            <p className={`font-black text-2xl leading-none ${isInactive ? "text-red" : isAtRisk ? "text-orange-500" : "text-text-secondary"}`}>{absences.length}</p>
            <p className="text-[9px] text-text-muted uppercase tracking-widest mt-0.5">Faltas</p>
          </div>
          <div className={`p-1.5 rounded-full transition-colors ${expanded ? "bg-white/10 text-text-primary" : "text-text-muted hover:bg-white/5"}`}>
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border-t border-border/50 px-4 py-4 space-y-3 bg-black/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-text-muted uppercase tracking-widest font-black">Histórico de Circuitos Perdidos</p>
                <Link to={`/players/${playerId}`} className="text-[11px] text-primary hover:text-primary-hover font-bold transition-colors">Ver Perfil →</Link>
              </div>
              {sortedAbsences.map(att => (
                <div key={att.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border text-sm transition-colors ${att.is_justified ? "border-green-500/20 bg-green-500/5" : "border-red/20 bg-red/5"}`}>
                  <div className="flex flex-col gap-1">
                    <span className="text-text-primary font-bold text-sm">Circuito #{att.gameday}</span>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      {att.gameday_date && (
                        <span className="flex items-center gap-1"><Calendar size={12} className="text-text-secondary" /> {formatDate(att.gameday_date)}</span>
                      )}
                      {att.gameday_location && (
                        <span className="flex items-center gap-1"><MapPin size={12} className="text-text-secondary" /> {att.gameday_location}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:justify-end">
                    {att.is_justified ? (
                      <div className="flex flex-col items-start sm:items-end bg-surface/50 px-3 py-1.5 rounded-md border border-border/50 w-full sm:w-auto">
                        <span className="text-[10px] font-black text-green-500 uppercase tracking-wider flex items-center gap-1">✓ Justificada</span>
                        {att.justification_text && <p className="text-xs text-text-secondary mt-1 line-clamp-1 italic" title={att.justification_text}>"{att.justification_text}"</p>}
                      </div>
                    ) : justifyingId === att.id ? (
                      <div className="flex gap-2 items-center w-full sm:w-auto bg-surface p-1.5 rounded-md border border-border">
                        <input type="text" placeholder="Motivo..." className="input-base text-xs py-1.5 px-2 w-full sm:w-48 bg-transparent" value={justifyText} onChange={e => setJustifyText(e.target.value)} autoFocus />
                        <button onClick={() => { if (justifyText.trim()) { onJustify(att.id, justifyText); setJustifyingId(null); setJustifyText(""); } }} className="btn-primary py-1.5 px-3 text-xs font-bold shrink-0">Salvar</button>
                        <button onClick={() => { setJustifyingId(null); setJustifyText(""); }} className="btn-ghost p-1.5 text-text-muted hover:bg-surface-hover shrink-0"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto bg-surface/50 px-3 py-2 rounded-md border border-border/50">
                        <span className="text-[10px] font-black text-red uppercase tracking-wider flex items-center gap-1"><AlertTriangle size={12}/> No-show</span>
                        <button onClick={() => { setJustifyingId(att.id); setJustifyText(""); }} className="btn-secondary py-1 px-3 text-[10px] font-bold uppercase tracking-wider">Justificar</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
