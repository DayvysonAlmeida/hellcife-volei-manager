import { Check, CloudOff, Loader2, Smartphone, X } from 'lucide-react';
import type { BracketController } from '@/types';
import type { SyncStatus } from './useBracketSync';

function ago(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return 'agora';
  return `há ${Math.round(seconds / 60)} min`;
}

const STATUS: Record<SyncStatus, { label: string; className: string; icon: React.ElementType }> = {
  loading: { label: 'Carregando do servidor…', className: 'text-text-muted border-border', icon: Loader2 },
  saving: { label: 'Salvando…', className: 'text-text-muted border-border', icon: Loader2 },
  saved: { label: 'Salvo no servidor', className: 'text-green-400 border-green-500/30 bg-green-500/10', icon: Check },
  offline: { label: 'Sem conexão · salvo neste celular', className: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10', icon: CloudOff },
};

/**
 * Topo da tela da fila: em que quadra estou, se o placar está salvo e quem está marcando.
 * Quem não está marcando fica "acompanhando" (botões travados) e pode assumir o placar.
 */
export function CourtSyncBar({ courtLabel, color, status, notice, onDismissNotice, controller, isScorer, otherScorerActive, seenAgoMs, onTakeControl }: {
  courtLabel: string;
  color: string;
  status: SyncStatus;
  notice: string | null;
  onDismissNotice: () => void;
  controller: BracketController | null;
  isScorer: boolean;
  otherScorerActive: boolean;
  seenAgoMs: number;
  onTakeControl: () => void;
}) {
  const s = STATUS[status];
  const Icon = s.icon;

  return (
    <div className="card p-3 space-y-2 border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-display text-lg md:text-xl tracking-widest uppercase" style={{ color }}>{courtLabel}</span>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold border rounded-full px-2.5 py-1 ${s.className}`}>
          <Icon size={12} className={status === 'loading' || status === 'saving' ? 'animate-spin' : ''} />
          {s.label}
        </span>
      </div>

      {isScorer && (
        <p className="text-xs text-green-400 flex items-start gap-1.5">
          <Smartphone size={13} className="mt-0.5 flex-shrink-0" />
          <span><strong>Você está marcando esta quadra.</strong> Quem abrir em outro celular só acompanha.</span>
        </p>
      )}

      {!controller && (
        <p className="text-xs text-text-muted flex items-start gap-1.5">
          <Smartphone size={13} className="mt-0.5 flex-shrink-0" />
          <span>Ninguém marcando ainda: quem iniciar ou marcar o primeiro ponto assume o placar.</span>
        </p>
      )}

      {otherScorerActive && controller && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
          <p className="text-xs text-yellow-200 flex-1">
            <strong>{controller.name}</strong> está marcando esta quadra em outro celular (ativo {ago(seenAgoMs)}).
            Você está <strong>acompanhando</strong>: o placar atualiza sozinho e os botões ficam travados.
          </p>
          <button onClick={onTakeControl} className="btn-primary text-xs px-3 py-2 whitespace-nowrap">
            Assumir o placar
          </button>
        </div>
      )}

      {controller && !isScorer && !otherScorerActive && (
        <p className="text-xs text-text-muted flex items-start gap-1.5">
          <Smartphone size={13} className="mt-0.5 flex-shrink-0" />
          <span>{controller.name} marcava esta quadra (sem sinal {ago(seenAgoMs)}). Ao marcar, você assume o placar.</span>
        </p>
      )}

      {notice && (
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-2 flex items-start gap-2">
          <p className="text-xs text-orange-200 flex-1">{notice}</p>
          <button onClick={onDismissNotice} className="text-orange-200 hover:text-white" title="Fechar aviso">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
