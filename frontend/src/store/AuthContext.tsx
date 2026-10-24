import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, LoginResponse } from '@/types';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { removePushSubscription } from '@/lib/push';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.post<LoginResponse>('/auth/login/', { email, password });
      const { access, refresh, user: userData } = res.data;
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    // Leva o token agora: logo abaixo ele é apagado, e o cancelamento termina em segundo plano
    removePushSubscription(localStorage.getItem('access_token'));
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    queryClient.clear();
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  // Ao abrir o app, confere o acesso no servidor: quem foi promovido ou rebaixado na tela Equipe já vê o painel certo
  useEffect(() => {
    if (!localStorage.getItem('access_token')) return;
    api.get<User>('/auth/me/').then(({ data }) => {
      setUser((current) => {
        if (!current || (current.profile === data.profile && current.name === data.name)) return current;
        const merged = { ...current, profile: data.profile, name: data.name };
        localStorage.setItem('user', JSON.stringify(merged));
        return merged;
      });
    }).catch(() => {}); // sem rede ou sessão vencida: o interceptador da API cuida
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
