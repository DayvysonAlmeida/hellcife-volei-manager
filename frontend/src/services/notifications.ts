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
};
