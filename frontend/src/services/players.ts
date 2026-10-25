import api from '@/lib/api';
import type { Player, PaginatedResponse, StarCategory, StarHistoryEntry, StarLaunchOption } from '@/types';

export interface MakeMemberResult {
  detail: string;
  player_id: number;
  invite_sent: boolean;
  welcome_text: string;
  whatsapp_url: string;
}

export interface StarsPayload {
  mvp_stars: number;
  attack_stars: number;
  defense_stars: number;
  setter_stars: number;
  pass_stars: number;
  block_stars: number;
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
    api.patch<Pick<Player, 'id' | 'mvp_stars' | 'attack_stars' | 'defense_stars' | 'setter_stars' | 'pass_stars' | 'block_stars' | 'mini_stars' | 'big_stars'>>(
      `/players/${id}/update_stars/`, payload
    ).then(r => r.data),

  ranking: (position?: string, all?: boolean) =>
    api.get('/players/ranking/', { params: { ...(position ? { position } : {}), ...(all ? { all: 'true' } : {}) } }).then(r => r.data),

  stats: (id: number) =>
    api.get(`/players/${id}/stats/`).then(r => r.data),

  getStarHistory: () =>
    api.get<StarHistoryEntry[]>('/players/stars-history/').then(r => r.data),

  /** Painel "Lançar estrelas": circuitos já realizados e os presentes em cada um. */
  starLaunchOptions: () =>
    api.get<StarLaunchOption[]>('/players/stars/launch-options/').then(r => r.data),

  launchStars: (gameday: number, items: { player: number; category: StarCategory; count: number }[]) =>
    api.post<{ detail: string; created: number }>('/players/stars/launch/', { gameday, items }).then(r => r.data),

  /** Convidado vira membro (com convite por e-mail, se informado) e volta a mensagem de boas-vindas. */
  makeMember: (id: number, data: { name: string; phone: string; gender: string; main_position: string; email?: string }) =>
    api.post<MakeMemberResult>(`/players/${id}/make-member/`, data).then(r => r.data),

  undoStar: (historyId: number) =>
    api.post<{ detail: string }>(`/players/stars-history/${historyId}/undo/`).then(r => r.data),
};
