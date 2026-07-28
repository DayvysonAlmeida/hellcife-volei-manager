import { Navigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
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

/** Somente atletas (profile=player) — admin/mod são redirecionados para o dashboard */
export function PlayerRoute({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.profile !== 'player') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
