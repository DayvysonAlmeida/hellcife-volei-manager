import { motion } from "framer-motion";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { PlayerFrequencyRow } from "./PlayerFrequencyRow";
import type { Player } from "@/types";

interface FrequencyTabProps {
  players: Player[];
  allTrackedPlayers: Player[];
  safePlayers: Player[];
}

export function FrequencyTab({ players, allTrackedPlayers, safePlayers }: FrequencyTabProps) {
  return (
    <motion.div key="frequency" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
      <div className="card p-6 bg-gradient-to-br from-surface to-surface-hover/50 border border-border/50 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="max-w-2xl">
            <h2 className="text-xl font-display font-black text-text-primary flex items-center gap-2 mb-2">
              <AlertTriangle size={24} className="text-orange-500" />
              Monitoramento de Frequência (Ausências)
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              A cada dia de circuito que o jogador <strong className="text-red">NÃO</strong> marca presença física na quadra, ele recebe <strong className="text-text-primary">1 ausência consecutiva</strong> (isso inclui quem sequer se inscreveu e quem se inscreveu mas não foi). 
              Ao participar presencialmente de um jogo, essa contagem <strong className="text-green-500">zera imediatamente</strong>.
            </p>
            <div className="flex items-center gap-4 mt-4">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-500 bg-orange-500/10 px-2.5 py-1 rounded-md border border-orange-500/20">
                8 Ausências = Alerta
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red bg-red/10 px-2.5 py-1 rounded-md border border-red/20">
                10 Ausências = Inativação
              </span>
            </div>
          </div>
          
          <div className="bg-surface p-4 rounded-xl border border-border min-w-[200px] text-center shadow-inner">
            <p className="text-[10px] text-text-muted font-black uppercase tracking-widest mb-1">Jogadores em Risco (8+)</p>
            <p className="text-4xl font-display text-orange-500">
              {players.filter(p => p.consecutive_absences >= 8 && p.status === 'active').length}
            </p>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden shadow-md border-border/60">
        <div className="p-4 border-b border-border bg-surface/50 flex justify-between items-center">
          <h3 className="font-bold text-text-primary">Atletas com Faltas Consecutivas</h3>
          <span className="text-xs text-text-muted font-medium">{allTrackedPlayers.length} atletas acumulando faltas</span>
        </div>
        
        {allTrackedPlayers.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-text-muted">Todos os jogadores estão com a frequência em dia! 🎉</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto custom-scrollbar">
            {allTrackedPlayers.map(p => (
              <PlayerFrequencyRow key={p.id} player={p} />
            ))}
          </div>
        )}
      </div>

      {safePlayers.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => {
            const el = document.getElementById('safe-players');
            if (el) el.classList.toggle('hidden');
          }}>
            <h3 className="font-bold text-green-500 flex items-center gap-2">
              <ShieldAlert size={18} /> 
              Frequentes – Em Dia ({safePlayers.length} atletas)
            </h3>
            <p className="text-xs text-text-muted hover:text-text-primary transition-colors">Ver lista</p>
          </div>
          <div id="safe-players" className="hidden">
            <div className="flex flex-wrap gap-2 mt-2">
              {safePlayers.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-surface-hover px-2.5 py-1.5 rounded-lg border border-border/50">
                  <Avatar name={p.display_name} src={p.avatar_url} size="sm" />
                  <span className="text-xs font-medium text-text-primary">{p.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
