import { cn, getPositionClass, getStatusClass } from '@/lib/utils';
import { POSITION_LABELS, STATUS_LABELS } from '@/types';
import type { Position, PlayerStatus } from '@/types';

interface PositionBadgeProps {
  position: Position;
  className?: string;
}

export function PositionBadge({ position, className }: PositionBadgeProps) {
  return (
    <span className={cn(getPositionClass(position), className)}>
      {POSITION_LABELS[position]}
    </span>
  );
}

interface StatusBadgeProps {
  status: PlayerStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn(getStatusClass(status), className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}
