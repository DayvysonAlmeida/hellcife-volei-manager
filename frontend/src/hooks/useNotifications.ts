import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '@/services/notifications';

export function useNotifications() {
  const queryClient = useQueryClient();
  const knownNotificationIds = useRef<Set<number>>(new Set());
  const isFirstLoad = useRef(true);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsService.getNotifications,
    refetchInterval: 60000, // Atualiza a cada 1 min
  });

  const markAsRead = useMutation({
    mutationFn: notificationsService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: notificationsService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const safeNotifications = Array.isArray(notifications) 
    ? notifications 
    : (notifications as any)?.results || [];

  const unreadCount = safeNotifications.filter((n: any) => !n.is_read).length;

  useEffect(() => {
    if (isLoading) return;
    
    const currentIds = new Set<number>(safeNotifications.map((n: any) => n.id));

    if (isFirstLoad.current) {
      // Popula os IDs conhecidos na primeira carga para não espamar toasts ao abrir a tela
      knownNotificationIds.current = currentIds;
      isFirstLoad.current = false;
      return;
    }

    // Encontra novas notificações não lidas
    const newNotifications = safeNotifications.filter((n: any) => 
      !knownNotificationIds.current.has(n.id) && !n.is_read
    );

    newNotifications.forEach((n: any) => {
       const iconMap: Record<string, string> = {
         prize: '🎁',
         circuit: '🏅',
         system: 'ℹ️',
         alert: '⚠️',
       };
       const icon = iconMap[n.type] || '🔔';
       
       toast.success(`${n.title}`, {
          icon,
          duration: 6000,
          position: 'top-right',
          style: {
            background: '#18181b', // zinc-900
            color: '#fff',
            border: '1px solid #3f3f46', // zinc-700
          },
       });
    });

    knownNotificationIds.current = currentIds;
  }, [safeNotifications, isLoading]);

  return {
    notifications: safeNotifications,
    unreadCount,
    isLoading,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
  };
}
