import api from '@/lib/api';
import type { DashboardData, Evaluation, GameDay, GenerateTeamsResult, TeamGenerationData, HallOfFameEntry, Match, PaginatedResponse, QuickMatchData, RegulationText } from '@/types';

export const dashboardService = {
  get: () => api.get<DashboardData>('/dashboard/').then(r => r.data),
};

export const regulationService = {
  get: () => api.get<RegulationText>('/hall-of-fame/regulation/').then(r => r.data),
  update: (payload: { title: string; content: string }) =>
    api.put<RegulationText>('/hall-of-fame/regulation/1/', payload).then(r => r.data),
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
};

export const attendanceService = {
  listGameDays: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<GameDay>>('/attendance/gamedays/', { params }).then(r => r.data),

  getGameDay: (id: number) =>
    api.get<GameDay>(`/attendance/gamedays/${id}/`).then(r => r.data),

  createGameDay: (data: Partial<GameDay>) =>
    api.post<GameDay>('/attendance/gamedays/', data).then(r => r.data),

  updateGameDay: (id: number, data: Partial<GameDay>) =>
    api.patch<GameDay>(`/attendance/gamedays/${id}/`, data).then(r => r.data),

  deleteGameDay: (id: number) =>
    api.delete(`/attendance/gamedays/${id}/`),

  refreshList: (id: number) =>
    api.post(`/attendance/gamedays/${id}/refresh-list/`).then(r => r.data),

  getGeneralStats: () =>
    api.get<any[]>('/attendance/gamedays/general-stats/').then(r => r.data),

  addGuest: (gamedayId: number, data: { name: string; main_position: string; invited_by?: string; gender?: string }) =>
    api.post(`/attendance/gamedays/${gamedayId}/add-guest/`, data).then(r => r.data),

  promoteWaitlist: (gamedayId: number) =>
    api.post(`/attendance/gamedays/${gamedayId}/promote-waitlist/`).then(r => r.data),

  processPastAbsences: () =>
    api.post('/attendance/gamedays/process-past-absences/').then(r => r.data),

  bulkAttendance: (gamedayId: number, presentPlayerIds: number[]) =>
    api.post(`/attendance/gamedays/${gamedayId}/bulk-attendance/`, {
      present_player_ids: presentPlayerIds,
    }).then(r => r.data),

  bulkPayment: (gamedayId: number, actionType: 'check_all' | 'uncheck_all') =>
    api.post(`/attendance/gamedays/${gamedayId}/bulk-payment/`, { action_type: actionType }).then(r => r.data),

  toggleAttendance: (gamedayId: number, playerId: number) =>
    api.patch(`/attendance/gamedays/${gamedayId}/toggle/${playerId}/`).then(r => r.data),

  togglePayment: (gamedayId: number, playerId: number) =>
    api.patch(`/attendance/gamedays/${gamedayId}/toggle-payment/${playerId}/`).then(r => r.data),

  toggleCourtCheckin: (gamedayId: number, playerId: number) =>
    api.post('/attendance/court-checkins/toggle/', { gameday_id: gamedayId, player_id: playerId }).then(r => r.data),

  bulkCourtCheckin: (gamedayId: number, playerIds: number[], actionType: 'check_all' | 'uncheck_all') =>
    api.post('/attendance/court-checkins/bulk-toggle/', { gameday_id: gamedayId, player_ids: playerIds, action_type: actionType }).then(r => r.data),

  reorderWaitlist: (gamedayId: number, attendanceIds: number[]) =>
    api.post(`/attendance/gamedays/${gamedayId}/reorder-waitlist/`, { attendance_ids: attendanceIds }).then(r => r.data),
};

export const teamsService = {
  generate: (data: {
    modality: number;
    gameday_id?: number;
    player_ids?: number[];
    save?: boolean;
    notes?: string;
  }) => api.post<GenerateTeamsResult>('/teams/generate/', data).then(r => r.data),

  saveGenerated: (data: {
    modality: number;
    gameday_id?: number | null;
    notes?: string;
    result: GenerateTeamsResult;
  }) => api.post<{ detail: string, generation_id: number }>('/teams/save-generated/', data).then(r => r.data),

  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<TeamGenerationData>>('/teams/', { params }).then(r => r.data),

  get: (id: number) =>
    api.get(`/teams/${id}/`).then(r => r.data),

  movePlayer: (generationId: number, playerId: number, targetTeamId: number) =>
    api.patch(`/teams/${generationId}/move-player/`, { player_id: playerId, target_team_id: targetTeamId }).then(r => r.data),

  addPlayer: (generationId: number, playerId: number, teamId: number) =>
    api.post(`/teams/${generationId}/add-player/`, { player_id: playerId, team_id: teamId }).then(r => r.data),

  removePlayer: (genId: number, playerId: number) =>
    api.post(`/teams/${genId}/remove-player/`, { player_id: playerId }).then(r => r.data),

  addTeam: (genId: number) =>
    api.post(`/teams/${genId}/add-team/`).then(r => r.data),

  autoAllocate: async (genId: number): Promise<{ detail: string }> => {
    const response = await api.post(`/teams/${genId}/auto-allocate/`);
    return response.data;
  },

  shuffle: async (genId: number): Promise<{ detail: string }> => {
    const response = await api.post(`/teams/${genId}/shuffle/`);
    return response.data;
  },

  removeTeam: (genId: number, teamId: number) =>
    api.delete(`/teams/${genId}/remove-team/${teamId}/`).then(r => r.data),

  lock: (id: number) =>
    api.post(`/teams/${id}/lock/`).then(r => r.data),

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

  quickCreate: (data: QuickMatchData) =>
    api.post<Match>('/matches/quick/', data).then(r => r.data),
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

  byYear: (year?: number) =>
    api.get<HallOfFameEntry[]>('/hall-of-fame/', { params: year ? { year } : {} }).then(r => r.data),
};
