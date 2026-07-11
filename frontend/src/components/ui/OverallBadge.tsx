import { getOverallColor, getOverallLabel } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface OverallBadgeProps {
  overall?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function OverallBadge({ overall, size = 'md', showLabel = false }: OverallBadgeProps) {
  if (overall == null) {
    return (
      <div className={cn(
        'font-display font-bold text-text-muted',
        size === 'sm' && 'text-lg',
        size === 'md' && 'text-2xl',
        size === 'lg' && 'text-4xl',
      )}>
        —
      </div>
    );
  }

  const color = getOverallColor(overall);
  const label = getOverallLabel(overall);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={cn(
          'font-display font-bold',
          size === 'sm' && 'text-lg',
          size === 'md' && 'text-2xl',
          size === 'lg' && 'text-4xl',
        )}
        style={{ color }}
      >
        {overall.toFixed(1)}
      </span>
      {showLabel && (
        <span
          className="text-[9px] font-bold tracking-widest uppercase"
          style={{ color }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: string;
}

export function SkillBar({ value, max = 10, color, height = 'h-1.5' }: ProgressBarProps) {
  const pct = (value / max) * 100;
  const barColor = color || getOverallColor(value);

  return (
    <div className={cn('w-full bg-border rounded-full overflow-hidden', height)}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: barColor }}
      />
    </div>
  );
}
