import api from '@/lib/api';
import type { Player, PaginatedResponse } from '@/types';

export const playersService = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Player>>('/players/', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<Player>(`/players/${id}/`).then(r => r.data),

  create: (data: Partial<Player> | FormData) =>
    api.post<Player>('/players/', data).then(r => r.data),

  update: (id: number, data: Partial<Player> | FormData) =>
    api.patch<Player>(`/players/${id}/`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/players/${id}/`),

  ranking: (position?: string) =>
    api.get('/players/ranking/', { params: position ? { position } : undefined }).then(r => r.data),

  stats: (id: number) =>
    api.get(`/players/${id}/stats/`).then(r => r.data),
};
