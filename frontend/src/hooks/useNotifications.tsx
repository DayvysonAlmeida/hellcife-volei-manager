import { useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { notificationsService } from '@/services/notifications';
import {
  closeSystemNotifications, getPushPublicKey, isIosOutsideApp, pushSupported, subscribeThisDevice,
} from '@/lib/push';
import type { Notification } from '@/types';

const PROMPT_SNOOZE_KEY = 'hellcife-notif-prompt-snoozed-until';
const IOS_HINT_SNOOZE_KEY = 'hellcife-ios-install-hint-snoozed-until';
const PROMPT_SNOOZE_DAYS = 7;

// Acima disso, um aviso só com o total (ex.: ao voltar para o app depois de horas)
const MAX_TOASTS = 3;

const TYPE_ICONS: Record<string, string> = {
  prize: '🎁',
  circuit: '🏅',
  system: 'ℹ️',
  alert: '⚠️',
  financial: '💰',
};

function promptSnoozed(key: string) {
  try {
    return Number(localStorage.getItem(key) || 0) > Date.now();
  } catch {
    return false;
  }
}

function snoozePrompt(key: string) {
  try {
    localStorage.setItem(key, String(Date.now() + PROMPT_SNOOZE_DAYS * 24 * 60 * 60 * 1000));
  } catch {
    // sem armazenamento: o aviso volta na próxima abertura
  }
}

/**
 * Pede a permissão de notificação (precisa de um toque do usuário) e inscreve o aparelho no push.
 * Aparece embaixo, sem cobrir o menu; "Agora não" deixa de perguntar por 7 dias.
 */
function askPushPermission(publicKey: string) {
  if (Notification.permission === 'default' && !promptSnoozed(PROMPT_SNOOZE_KEY)) {
    toast((t) => (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Quer receber as notificações no celular, mesmo com o app fechado?</p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              Notification.requestPermission().then((perm) => {
                if (perm !== 'granted') return;
                subscribeThisDevice(publicKey)
                  .then(() => toast.success('Notificações ativadas! 🔔', { id: 'perm-success' }))
                  .catch(() => toast.error('Não foi possível ativar as notificações neste aparelho.', { id: 'perm-error' }));
              });
              toast.dismiss(t.id);
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            Ativar Notificações
          </button>
          <button
            onClick={() => {
              snoozePrompt(PROMPT_SNOOZE_KEY);
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

/** No iPhone, o push só funciona com o app instalado: explica como instalar (no máximo 1x por semana). */
function showIosInstallHint() {
  if (promptSnoozed(IOS_HINT_SNOOZE_KEY)) return;
  toast((t) => (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Para receber as notificações no iPhone, instale o app:</p>
      <p className="text-xs text-text-muted">
        Toque em Compartilhar e depois em “Adicionar à Tela de Início”. Abra o app pelo ícone e ative as notificações.
      </p>
      <button
        onClick={() => {
          snoozePrompt(IOS_HINT_SNOOZE_KEY);
          toast.dismiss(t.id);
        }}
        className="self-start bg-surface-highlight hover:bg-white/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-border"
      >
        Entendi
      </button>
    </div>
  ), { duration: 15000, id: 'ios-install-hint', position: 'bottom-center' });
}

/** Push neste aparelho: inscreve se já tem permissão, pergunta se ainda não respondeu. */
async function setUpPush(isCancelled: () => boolean) {
  if (!pushSupported()) {
    if (isIosOutsideApp()) showIosInstallHint();
    return;
  }
  const publicKey = await getPushPublicKey().catch(() => null);
  // Sem chave, o push está desligado no servidor: nem pergunta
  if (!publicKey || isCancelled()) return;

  if (Notification.permission === 'granted') {
    subscribeThisDevice(publicKey).catch(() => {});
  } else {
    askPushPermission(publicKey);
  }
}

interface NotificationToast {
  id: string;
  icon: string;
  title: string;
  message: string;
  onOpen: () => void;
}

/** Aviso flutuante (estilo WhatsApp): tocar abre as notificações, "Fechar" só some. */
function showNotificationToast({ id, icon, title, message, onOpen }: NotificationToast) {
  toast.custom((t) => (
    <div
      className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } max-w-sm w-full bg-surface-highlight/90 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-border rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => {
          toast.dismiss(t.id);
          onOpen();
        }}
        className="flex-1 w-0 p-4 text-left hover:bg-white/5 focus:outline-none transition-colors"
      >
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5 text-xl">
            {icon}
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-bold text-text-primary">
              {title}
            </p>
            <p className="mt-1 text-xs text-text-muted line-clamp-2">
              {message}
            </p>
          </div>
        </div>
      </button>
      <div className="flex border-l border-border">
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          className="w-full border border-transparent rounded-none rounded-r-xl p-4 flex items-center justify-center text-sm font-medium text-text-muted hover:text-text-primary hover:bg-white/5 focus:outline-none transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  ), { id, duration: 6000, position: 'top-right', removeDelay: 200 });
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, isSuccess } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsService.getNotifications,
    refetchInterval: 30000,    // Atualiza a cada 30 segundos (só com o app na tela)
    refetchOnWindowFocus: true, // Ao voltar para o app, busca na hora
    staleTime: 0,              // Garante que o refetch sempre busca dados frescos
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

  const safeNotifications = useMemo(
    () => (Array.isArray(notifications) ? notifications : (notifications as any)?.results || []),
    [notifications],
  );

  const unreadCount = safeNotifications.filter((n: any) => !n.is_read).length;

  return {
    notifications: safeNotifications,
    unreadCount,
    isLoading,
    isSuccess,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    deleteNotification: deleteNotification.mutate,
  };
}

/**
 * Mostra na tela as notificações que chegam com o app aberto e cuida do push deste aparelho.
 * Roda num lugar só (o sininho do cabeçalho); em dois lugares, cada aviso aparece repetido.
 */
export function useNotificationAlerts(
  notifications: Notification[],
  ready: boolean,
  markAsRead: (id: number) => void,
) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const knownIds = useRef<Set<number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUpPush(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, []);

  // Mensagens do service worker: chegou um push (atualiza a lista na hora) ou tocaram na notificação
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const { type, url } = event.data || {};
      if (type === 'push') {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } else if (type === 'open' && typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
        navigate(url);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate, queryClient]);

  useEffect(() => {
    // Só depois de uma busca que deu certo: um erro na primeira não pode virar "tudo é novo" depois
    if (!ready) return;

    const currentIds = new Set(notifications.map((n) => n.id));
    const known = knownIds.current;
    knownIds.current = currentIds;

    // Primeira carga: só memoriza, para não encher a tela ao abrir o app
    if (!known) return;

    const fresh = notifications.filter((n) => !known.has(n.id) && !n.is_read);
    if (fresh.length === 0) return;

    // O aviso flutuante já mostra: tira da bandeja as notificações do sistema repetidas
    closeSystemNotifications(fresh.map((n) => n.id));

    const listPath = `${pathname.startsWith('/athlete') ? '/athlete' : ''}/notifications`;

    if (fresh.length > MAX_TOASTS) {
      showNotificationToast({
        id: 'notif-summary',
        icon: '🔔',
        title: `Você tem ${fresh.length} notificações novas`,
        message: 'Toque para ver.',
        onOpen: () => navigate(listPath),
      });
      return;
    }

    fresh.forEach((n) => {
      showNotificationToast({
        id: `notif-${n.id}`,
        icon: TYPE_ICONS[n.type] || '🔔',
        title: n.title,
        message: n.message,
        onOpen: () => {
          markAsRead(n.id);
          navigate(listPath);
        },
      });
    });
  }, [notifications, ready, pathname, navigate, markAsRead]);
}
