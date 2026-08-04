import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '@/services/notifications';

/** Solicita permissão de notificação nativa do navegador via Toast para exigir interação do usuário (bypass de bloqueio). */
function requestBrowserNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    toast((t) => (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Deseja receber as notificações de Circuitos no sistema?</p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              Notification.requestPermission().then((perm) => {
                if (perm === 'granted') toast.success('Notificações ativadas! 🔔', { id: 'perm-success' });
              });
              toast.dismiss(t.id);
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            Ativar Notificações
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="bg-surface-highlight hover:bg-white/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-border"
          >
            Agora não
          </button>
        </div>
      </div>
    ), { duration: 15000, id: 'browser-notif-req', position: 'top-center' });
  } else if ('Notification' in window && Notification.permission === 'denied') {
    console.warn('Permissão de notificações do navegador bloqueada pelo usuário.');
  }
}

/** Exibe uma notificação nativa do navegador (quando o app está em segundo plano). */
function showBrowserNotification(title: string, body: string, type: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const iconMap: Record<string, string> = {
      prize: '🎁',
      circuit: '🏅',
      system: 'ℹ️',
      alert: '⚠️',
    };
    new Notification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: `hellcife-notif-${type}`,
      silent: false,
    });
  }
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const knownNotificationIds = useRef<Set<number>>(new Set());
  const isFirstLoad = useRef(true);

  // Solicita permissão de notificação nativa ao montar o hook
  useEffect(() => {
    requestBrowserNotificationPermission();
  }, []);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsService.getNotifications,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
    staleTime: 0,           // Garante que o refetch sempre busca dados frescos
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

  const deleteNotification = useMutation({
    mutationFn: notificationsService.deleteNotification,
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

      // Toast in-app
      toast.success(`${n.title}`, {
        icon,
        duration: 6000,
        position: 'top-right',
        style: {
          background: '#18181b',
          color: '#fff',
          border: '1px solid #3f3f46',
        },
      });

      // Notificação nativa do navegador (funciona mesmo com app em 2º plano)
      showBrowserNotification(n.title, n.message, n.type);
    });

    knownNotificationIds.current = currentIds;
  }, [safeNotifications, isLoading]);

  return {
    notifications: safeNotifications,
    unreadCount,
    isLoading,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    deleteNotification: deleteNotification.mutate,
  };
}
