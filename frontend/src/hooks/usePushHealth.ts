import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsService } from '@/services/notifications';
import { localPushState, type LocalPushState } from '@/lib/push';
import { useAuth } from '@/store/AuthContext';

/**
 * Saúde das notificações no celular: o que o aparelho diz (suporte, permissão, inscrição)
 * somado ao que o servidor diz (chaves VAPID e aparelhos inscritos nesta conta).
 */
export function usePushHealth() {
  const { isAuthenticated } = useAuth();
  const [local, setLocal] = useState<LocalPushState | null>(null);
  const server = useQuery({
    queryKey: ['push-status'],
    queryFn: notificationsService.pushStatus,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const refreshLocal = useCallback(() => localPushState().then(setLocal), []);
  useEffect(() => { refreshLocal(); }, [refreshLocal]);

  const refresh = useCallback(async () => {
    await refreshLocal();
    await server.refetch();
  }, [refreshLocal, server]);

  const registered = !!local?.endpoint && !!server.data?.devices.some((d) => d.endpoint === local.endpoint);
  const ready = server.data?.server === 'ok' && !!local?.worker && local?.permission === 'granted' && registered;
  return { local, server: server.data, loading: !local || server.isLoading, registered, ready, refresh };
}
