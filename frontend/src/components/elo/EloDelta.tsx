import { cn } from '@/lib/utils';

/** Quanto o Elo da temporada mudou numa partida: "+18" em verde, "-14" em vermelho. */
export function EloDelta({ value, className }: { value?: number | null; className?: string }) {
  if (value === null || value === undefined) return null;
  const rounded = Math.round(value);
  if (rounded === 0) return null;
  const positive = rounded > 0;
  return (
    <span
      title="Elo ganho ou perdido nesta partida"
      className={cn(
        'text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded border flex-shrink-0',
        positive ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-red bg-red/10 border-red/20',
        className,
      )}
    >
      {positive ? '+' : '−'}{Math.abs(rounded)}
    </span>
  );
}
