import api from '@/lib/api';
import type { Notification } from '@/types';

export const notificationsService = {
  getNotifications: async () => {
    const { data } = await api.get<Notification[]>('/notifications/');
    return data;
  },

  markAsRead: async (id: number) => {
    const { data } = await api.post(`/notifications/${id}/read/`);
    return data;
  },

  markAllAsRead: async () => {
    const { data } = await api.post('/notifications/read_all/');
    return data;
  },

  deleteNotification: async (id: number) => {
    await api.delete(`/notifications/${id}/`);
  },

  sendGlobalAnnouncement: async (title: string, message: string) => {
    const { data } = await api.post('/notifications/global_announcement/', { title, message });
    return data;
  },

  /** Diagnóstico do push: chaves do servidor e os aparelhos desta conta. */
  pushStatus: async () => {
    const { data } = await api.get<PushStatus>('/notifications/push/status/');
    return data;
  },

  /** Notificação de teste; com delay o servidor espera (até 15s) para dar tempo de bloquear a tela. */
  pushTest: async (delay: number) => {
    const { data } = await api.post<{ results: PushTestResult[] }>('/notifications/push/test/', { delay }, { timeout: 30000 });
    return data.results;
  },

  /** Staff: quantos atletas recebem as notificações no celular. */
  pushStats: async () => {
    const { data } = await api.get<{ athletes: number; with_push: number; without: string[] }>('/notifications/push/stats/');
    return data;
  },
};

export interface PushStatus {
  server: 'ok' | 'missing' | 'invalid';
  devices: { endpoint: string; device: string; created_at: string; last_success_at: string | null; last_error: string }[];
}

export interface PushTestResult {
  device: string;
  status: 'delivered' | 'expired' | 'failed';
  detail: string;
}
