import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import type { Player } from '@/types';

/**
 * Cadastro de atleta ligado ao login. Para a staff decide o "Ver como atleta":
 * admin ou moderador que também joga tem cadastro; quem só organiza recebe 404 (sem nova tentativa).
 */
export function useMyAthlete() {
  const { isAuthenticated } = useAuth();
  return useQuery<Player | null>({
    queryKey: ['athlete-me'],
    queryFn: () => api.get('/players/me/').then((r) => r.data).catch((err) => {
      if (err.response?.status === 404) return null;
      throw err;
    }),
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60_000,
  });
}
