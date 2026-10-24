import { Link, Navigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useMyAthlete } from '@/hooks/useMyAthlete';
import { PageLoading } from '@/components/ui/Loading';
import { isAdmin } from '@/lib/roles';
import type { ReactNode } from 'react';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Somente admin e moderador — atletas são redirecionados para seu portal */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.profile === 'player') return <Navigate to="/athlete" replace />;
  return <>{children}</>;
}

/** Áreas só do administrador (finanças, planos, regulamento, Equipe): o moderador vê um aviso em vez da tela. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (isAdmin(user)) return <>{children}</>;
  return (
    <div className="card max-w-md mx-auto mt-10 p-8 text-center space-y-3">
      <Lock size={32} className="mx-auto text-text-muted" />
      <h1 className="font-display text-2xl text-text-primary tracking-wide">SÓ O ADMINISTRADOR</h1>
      <p className="text-sm text-text-muted">Esta área é exclusiva do administrador do clube.</p>
      <Link to="/dashboard" className="btn-secondary inline-flex">Voltar ao painel</Link>
    </div>
  );
}

/** Portal do atleta: atletas e a staff que também joga ("Ver como atleta"); quem só organiza volta ao painel. */
export function PlayerRoute({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const isPlayer = user?.profile === 'player';
  const { data: athlete, isLoading } = useMyAthlete();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isPlayer) return <>{children}</>;
  if (isLoading) return <PageLoading />;
  if (!athlete) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
