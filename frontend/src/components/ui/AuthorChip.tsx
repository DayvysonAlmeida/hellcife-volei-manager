import { UserCheck } from 'lucide-react';
import { getInitials, cn } from '@/lib/utils';
import { PROFILE_LABELS } from '@/lib/roles';
import type { User } from '@/types';

const ROLE_STYLE: Partial<Record<User['profile'], string>> = {
  admin: 'bg-red/10 text-red border-red/30',
  moderator: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
};

/** Quem da staff fez o registro (avaliação, estrela): iniciais, nome e o selo Admin/Moderador. */
export function AuthorChip({ label, name, profile, missing = 'Autor não registrado', className }: {
  label: string;
  name?: string | null;
  profile?: User['profile'] | null;
  missing?: string;
  className?: string;
}) {
  if (!name) {
    return <span className={cn('inline-flex items-center gap-1.5 text-xs text-text-muted italic', className)}><UserCheck size={13} /> {missing}</span>;
  }
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0', className)}>
      <span aria-hidden className="w-6 h-6 rounded-full bg-text-primary/10 text-text-primary text-[10px] font-black flex items-center justify-center shrink-0">
        {getInitials(name)}
      </span>
      <span className="text-xs text-text-muted break-words">
        {label} <strong className="text-text-primary font-bold">{name}</strong>
      </span>
      {profile && ROLE_STYLE[profile] && (
        <span className={cn('shrink-0 rounded-full border px-1.5 py-px text-[9px] font-black uppercase tracking-wider', ROLE_STYLE[profile])}>
          {PROFILE_LABELS[profile]}
        </span>
      )}
    </span>
  );
}
