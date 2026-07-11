import api from '@/lib/api';
import type { DashboardData, Evaluation, EvaluationConfig, GameDay, GenerateTeamsResult, TeamGenerationData, HallOfFameEntry, Match, PaginatedResponse } from '@/types';

export const dashboardService = {
  get: () => api.get<DashboardData>('/dashboard/').then(r => r.data),
};

export const evaluationsService = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Evaluation>>('/evaluations/', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<Evaluation>(`/evaluations/${id}/`).then(r => r.data),

  create: (data: Partial<Evaluation>) =>
    api.post<Evaluation>('/evaluations/', data).then(r => r.data),

  update: (id: number, data: Partial<Evaluation>) =>
    api.patch<Evaluation>(`/evaluations/${id}/`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/evaluations/${id}/`),

  byPlayer: (playerId: number) =>
    api.get<Evaluation[]>(`/evaluations/by-player/${playerId}/`).then(r => r.data),

  radar: (playerId: number) =>
    api.get(`/evaluations/radar/${playerId}/`).then(r => r.data),

  configs: {
    list: () => api.get<EvaluationConfig[]>('/evaluations/configs/').then(r => r.data),
    update: (id: number, data: Partial<EvaluationConfig>) =>
      api.patch<EvaluationConfig>(`/evaluations/configs/${id}/`, data).then(r => r.data),
    setActive: (id: number) =>
      api.post(`/evaluations/configs/${id}/set-active/`).then(r => r.data),
    create: (data: Partial<EvaluationConfig>) =>
      api.post<EvaluationConfig>('/evaluations/configs/', data).then(r => r.data),
  },
};

export const attendanceService = {
  listGameDays: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<GameDay>>('/attendance/gamedays/', { params }).then(r => r.data),

  getGameDay: (id: number) =>
    api.get<GameDay>(`/attendance/gamedays/${id}/`).then(r => r.data),

  createGameDay: (data: Partial<GameDay>) =>
    api.post<GameDay>('/attendance/gamedays/', data).then(r => r.data),

  bulkAttendance: (gamedayId: number, presentPlayerIds: number[]) =>
    api.post(`/attendance/gamedays/${gamedayId}/bulk-attendance/`, {
      present_player_ids: presentPlayerIds,
    }).then(r => r.data),

  toggleAttendance: (gamedayId: number, playerId: number) =>
    api.patch(`/attendance/gamedays/${gamedayId}/toggle/${playerId}/`).then(r => r.data),
};

export const teamsService = {
  generate: (data: {
    modality: number;
    gameday_id?: number;
    player_ids?: number[];
    save?: boolean;
    notes?: string;
  }) => api.post<GenerateTeamsResult>('/teams/generate/', data).then(r => r.data),

  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<TeamGenerationData>>('/teams/', { params }).then(r => r.data),

  get: (id: number) =>
    api.get(`/teams/${id}/`).then(r => r.data),

  movePlayer: (generationId: number, playerId: number, targetTeamId: number) =>
    api.patch(`/teams/${generationId}/move-player/`, { player_id: playerId, target_team_id: targetTeamId }).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/teams/${id}/`),
};

export const matchesService = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Match>>('/matches/', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<Match>(`/matches/${id}/`).then(r => r.data),

  create: (data: Partial<Match>) =>
    api.post<Match>('/matches/', data).then(r => r.data),

  update: (id: number, data: Partial<Match>) =>
    api.patch<Match>(`/matches/${id}/`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/matches/${id}/`),

  addResult: (id: number, teamsData: unknown) =>
    api.post(`/matches/${id}/result/`, { teams: teamsData }).then(r => r.data),
};

export const hallOfFameService = {
  list: (params?: Record<string, unknown>) =>
    api.get<HallOfFameEntry[]>('/hall-of-fame/', { params }).then(r => r.data),

  create: (data: Partial<HallOfFameEntry>) =>
    api.post<HallOfFameEntry>('/hall-of-fame/', data).then(r => r.data),

  update: (id: number, data: Partial<HallOfFameEntry>) =>
    api.patch<HallOfFameEntry>(`/hall-of-fame/${id}/`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/hall-of-fame/${id}/`),
};
