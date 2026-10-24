import type { User } from '@/types';

/** Admin: tudo, inclusive finanças, exclusões, fechamento de temporada, regulamento e a tela Equipe. */
export const isAdmin = (user?: User | null) => user?.profile === 'admin';

/** Staff do clube: admin ou moderador (o moderador cuida do dia a dia da quadra). */
export const isStaff = (user?: User | null) => user?.profile === 'admin' || user?.profile === 'moderator';

export const PROFILE_LABELS: Record<User['profile'], string> = {
  admin: 'Administrador',
  moderator: 'Moderador',
  player: 'Atleta',
};
