import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Hourglass, LogOut } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/store/AuthContext';

/**
 * Quem se cadastrou pelo app e ainda não foi aprovado vê só o aviso de análise;
 * o resto do portal do atleta abre depois da aprovação da organização.
 */
export function PendingApprovalGate({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const { data: player } = useQuery({
    queryKey: ['athlete-me'],
    queryFn: () => api.get('/players/me/').then((r) => r.data),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 60_000 : false), // vê a aprovação sem precisar sair
  });

  if (player?.status !== 'pending') return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-6 sm:p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-yellow-500/10 text-yellow-400 rounded-full flex items-center justify-center mx-auto border border-yellow-500/30">
          <Hourglass size={30} />
        </div>
        <h1 className="font-display text-2xl text-text-primary tracking-wide uppercase">Cadastro em análise</h1>
        <p className="text-text-secondary text-sm">
          Olá, {player.display_name}! A organização está conferindo o seu cadastro. Assim que for aprovado, você recebe um aviso
          e já pode confirmar presença nos circuitos.
        </p>
        <button type="button" onClick={logout} className="btn-secondary inline-flex items-center gap-2">
          <LogOut size={14} /> Sair
        </button>
      </div>
    </div>
  );
}
