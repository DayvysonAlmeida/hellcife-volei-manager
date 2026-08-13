import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Calendar, MapPin, AlertTriangle, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Attendance } from "@/types";

export function NoShowRow({ attendance, onJustify }: { attendance: Attendance; onJustify: (text: string) => void }) {
  const [isJustifying, setIsJustifying] = useState(false);
  const [text, setText] = useState("");
  return (
    <div className={`p-4 rounded-xl border shadow-sm transition-all ${attendance.is_justified ? "border-green-500/20 bg-green-500/5 hover:bg-green-500/10" : "border-red/20 bg-red/5 hover:bg-red/10"}`}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex items-start gap-3">
          <Avatar name={attendance.player_name} src={attendance.player_avatar} size="md" className="border-2 border-surface" />
          <div>
            <p className="text-text-primary font-black text-base flex items-center gap-2">
              {attendance.player_name}
              {attendance.player_is_guest && (
                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  Convidado {attendance.player_invited_by ? `por: ${attendance.player_invited_by}` : ''}
                </span>
              )}
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
              <span className="text-text-muted text-xs flex items-center gap-1">
                <span className="font-bold text-text-secondary">#{attendance.gameday}</span>
              </span>
              {attendance.gameday_date && (
                <span className="text-text-muted text-xs flex items-center gap-1">
                  <Calendar size={12} />
                  {formatDate(attendance.gameday_date)}
                </span>
              )}
              {attendance.gameday_location && (
                <span className="text-text-muted text-xs flex items-center gap-1">
                  <MapPin size={12} />
                  {attendance.gameday_location}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 self-start">
          {attendance.is_justified
            ? <span className="text-xs font-black text-green-500 bg-green-500/10 px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1">✓ Justificada</span>
            : <span className="text-xs font-black text-red bg-red/10 px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1"><AlertTriangle size={14} /> No-show</span>
          }
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-border/50">
        {attendance.is_justified ? (
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Motivo da Justificativa</span>
            <p className="text-sm text-text-secondary bg-surface/50 p-3 rounded-lg border border-border/50 italic">
              "{attendance.justification_text}"
            </p>
          </div>
        ) : (
          <div>
            {!isJustifying ? (
              <button onClick={() => setIsJustifying(true)} className="btn-secondary py-2 px-4 text-sm w-full font-bold">Justificar Ausência</button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 bg-surface/50 p-2 rounded-lg border border-border/50">
                <input type="text" placeholder="Qual o motivo da falta?" className="input-base text-sm py-2 flex-1 bg-surface" value={text} onChange={e => setText(e.target.value)} autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => { if (text.trim()) onJustify(text); }} className="btn-primary py-2 px-4 text-sm font-bold flex-1 sm:flex-none">Salvar</button>
                  <button onClick={() => setIsJustifying(false)} className="btn-ghost p-2 text-text-muted hover:bg-surface"><X size={18} /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
