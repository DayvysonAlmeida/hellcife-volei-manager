import api from '@/lib/api';
import type { Player, PaginatedResponse } from '@/types';

export interface StarsPayload {
  mvp_stars: number;
  attack_stars: number;
  defense_stars: number;
}

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

  updateStars: (id: number, payload: StarsPayload) =>
    api.patch<Pick<Player, 'id' | 'mvp_stars' | 'attack_stars' | 'defense_stars' | 'mini_stars' | 'big_stars'>>(
      `/players/${id}/update_stars/`, payload
    ).then(r => r.data),

  ranking: (position?: string, all?: boolean) =>
    api.get('/players/ranking/', { params: { ...(position ? { position } : {}), ...(all ? { all: 'true' } : {}) } }).then(r => r.data),

  stats: (id: number) =>
    api.get(`/players/${id}/stats/`).then(r => r.data),

  getStarHistory: () =>
    api.get('/players/stars-history/').then(r => r.data),
};
