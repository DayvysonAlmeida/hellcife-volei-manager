import api from '@/lib/api';
import type { Gender, Position } from '@/types';

/** Cadastro esperando a staff (aba "Cadastros pendentes" em Atletas). */
export interface PendingSignup {
  id: number;
  name: string;
  legal_name: string;
  nickname: string | null;
  email: string;
  email_confirmed: boolean;
  phone: string | null;
  instagram: string | null;
  gender: Gender;
  gender_display: string;
  main_position: Position;
  main_position_display: string;
  secondary_position: Position | null;
  secondary_position_display: string | null;
  age: number | null;
  height: string | null;
  avatar_url: string | null;
  created_at: string;
}

/** Atleta sem acesso ao app, para ligar a conta de quem se cadastrou ("É o atleta X"). */
export interface SignupCandidate {
  id: number;
  name: string;
  nickname: string | null;
  main_position: Position;
  status: string;
}

type Detail = { detail: string };

export const signupService = {
  signup: (data: FormData) => api.post<Detail>('/auth/signup/', data).then((r) => r.data),
  confirmEmail: (token: string) => api.post<Detail>('/auth/confirm-email/', { token }).then((r) => r.data),
  resendConfirmation: (email: string) => api.post<Detail>('/auth/resend-confirmation/', { email }).then((r) => r.data),
  pending: () => api.get<PendingSignup[]>('/players/signups/').then((r) => r.data),
  candidates: () => api.get<SignupCandidate[]>('/players/signups/candidates/').then((r) => r.data),
  approve: (id: number, playerId?: number) =>
    api.post<Detail>(`/players/signups/${id}/approve/`, playerId ? { player_id: playerId } : {}).then((r) => r.data),
  reject: (id: number) => api.post<Detail>(`/players/signups/${id}/reject/`).then((r) => r.data),
};
