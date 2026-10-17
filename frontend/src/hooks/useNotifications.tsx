import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '@/services/notifications';

const PROMPT_SNOOZE_KEY = 'hellcife-notif-prompt-snoozed-until';
const PROMPT_SNOOZE_DAYS = 7;

function promptSnoozed() {
  try {
    return Number(localStorage.getItem(PROMPT_SNOOZE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

function snoozePrompt() {
  try {
    localStorage.setItem(PROMPT_SNOOZE_KEY, String(Date.now() + PROMPT_SNOOZE_DAYS * 24 * 60 * 60 * 1000));
  } catch {
    // sem armazenamento: o aviso volta na próxima abertura
  }
}

/**
 * Pede a permissão de notificação do navegador (precisa de um toque do usuário).
 * Aparece embaixo, sem cobrir o menu; "Agora não" deixa de perguntar por 7 dias.
 */
function requestBrowserNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default' && !promptSnoozed()) {
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
            onClick={() => {
              snoozePrompt();
              toast.dismiss(t.id);
            }}
            className="bg-surface-highlight hover:bg-white/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-border"
          >
            Agora não
          </button>
        </div>
      </div>
    ), { duration: 15000, id: 'browser-notif-req', position: 'bottom-center' });
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
      icon: '/logo.png',
      badge: '/logo.png',
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

      // Toast in-app (Estilo WhatsApp)
      toast.custom((t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-sm w-full bg-surface-highlight/90 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-border rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden`}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5 text-xl">
                {icon}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-bold text-text-primary">
                  {n.title}
                </p>
                <p className="mt-1 text-xs text-text-muted line-clamp-2">
                  {n.message}
                </p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-border">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-xl p-4 flex items-center justify-center text-sm font-medium text-text-muted hover:text-text-primary hover:bg-white/5 focus:outline-none transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      ), { duration: 6000, position: 'top-right' });

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
