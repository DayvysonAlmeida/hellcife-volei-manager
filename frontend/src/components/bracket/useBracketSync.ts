import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { teamsService } from '@/services';
import { deviceId } from '@/lib/device';
import type { BracketController, BracketServerState } from '@/types';

/** Campos só desta tela (modal aberto, tela de "venceu"): não vão para o servidor nem vêm dele. */
const LOCAL_ONLY = ['showSaveModal', 'transitionMessage', 'transitionColor'];
const POLL_MS = 3000;
/** Sem sinal do celular que marcava por esse tempo, quem estiver na quadra pode marcar direto. */
const INACTIVE_AFTER_MS = 3 * 60 * 1000;

export type SyncStatus = 'loading' | 'saved' | 'saving' | 'offline';

function toServer(state: object) {
  const copy: Record<string, unknown> = { ...state };
  LOCAL_ONLY.forEach((key) => delete copy[key]);
  return copy;
}

/**
 * Fila e placar da quadra no servidor, para qualquer celular ver e continuar o jogo.
 * - Só o celular que está marcando grava; os outros acompanham (atualizam a cada 3s).
 * - Sem internet, o celular continua funcionando e grava quando a conexão volta.
 * - Se outro celular gravou antes (conflito), vale a versão do servidor.
 */
export function useBracketSync<S extends object>({ generationId, enabled, state, setState }: {
  generationId: number;
  enabled: boolean;
  state: S;
  setState: (update: (prev: S) => S) => void;
}) {
  const device = useMemo(() => deviceId(), []);
  const version = useRef(0);
  const savedJson = useRef<string | null>(null); // o que o servidor tem
  const pending = useRef<string | null>(null); // mudança deste celular ainda não gravada
  const inFlight = useRef(false);
  const userActed = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const stateRef = useRef(state);
  const controllerRef = useRef<BracketController | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('loading');
  const [controller, setControllerState] = useState<BracketController | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setController = useCallback((value: BracketController | null) => {
    controllerRef.current = value;
    setControllerState(value);
  }, []);

  /** Usa a versão do servidor (mantém só os campos desta tela). */
  const adopt = useCallback((server: BracketServerState) => {
    version.current = server.version;
    setController(server.controller);
    if (!server.state) return;
    pending.current = null;
    savedJson.current = JSON.stringify(server.state);
    setState((prev) => {
      const local: Record<string, unknown> = {};
      LOCAL_ONLY.forEach((key) => { local[key] = (prev as Record<string, unknown>)[key]; });
      return { ...(server.state as S), ...local };
    });
  }, [setController, setState]);

  const flush = useCallback(async () => {
    const json = pending.current;
    if (!json || inFlight.current) return;
    inFlight.current = true;
    setStatus('saving');
    let ok = false;
    try {
      const server = await teamsService.saveBracket(generationId, { state: JSON.parse(json), version: version.current, device });
      version.current = server.version;
      savedJson.current = json;
      setController(server.controller);
      if (pending.current === json) pending.current = null;
      setStatus('saved');
      ok = true;
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Outro celular gravou antes: vale a versão do servidor
        adopt(err.response.data);
        const who = err.response.data?.controller?.name;
        setNotice(`Esta quadra foi atualizada por outro celular${who ? ` (${who})` : ''}. Valeu a versão salva no servidor.`);
        setStatus('saved');
      } else if (!err.response) {
        setStatus('offline'); // sem conexão: segue neste celular e tenta de novo a cada 3s
      } else {
        pending.current = null;
        setStatus('saved');
      }
    } finally {
      inFlight.current = false;
    }
    // Marcou outro ponto enquanto gravava: grava o mais novo
    if (ok && pending.current) void flush();
  }, [adopt, device, generationId, setController]);

  // Carrega o jogo do servidor ao abrir a quadra
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    teamsService.getBracket(generationId, device)
      .then((server) => {
        if (cancelled) return;
        if (server.state) adopt(server);
        else {
          version.current = server.version;
          setController(server.controller);
        }
        setStatus('saved');
      })
      .catch(() => { if (!cancelled) setStatus('offline'); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [enabled, generationId, device, adopt, setController]);

  // Cada mudança deste celular vai para o servidor (quem só acompanha não grava)
  useEffect(() => {
    if (!loaded) return;
    const json = JSON.stringify(toServer(state));
    if (json === savedJson.current) return;
    const current = controllerRef.current;
    const mine = current?.device === device;
    // Jogo começado antes desta versão, só neste celular: sobe para o servidor na primeira abertura
    const localOnlyGame = !current && savedJson.current === null && Boolean((state as { isStarted?: boolean }).isStarted);
    if (!mine && !userActed.current && !localOnlyGame) return;
    userActed.current = false;
    pending.current = json;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 250);
  }, [state, loaded, device, flush]);

  // Acompanha o servidor: outro celular marcando, conexão voltando
  useEffect(() => {
    if (!enabled || !loaded) return;
    const interval = window.setInterval(async () => {
      if (pending.current) {
        void flush();
        return;
      }
      try {
        const server = await teamsService.getBracket(generationId, device);
        setController(server.controller);
        if (server.version > version.current) adopt(server);
        setStatus((s) => (s === 'offline' ? 'saved' : s));
      } catch {
        setStatus('offline');
      }
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [enabled, loaded, generationId, device, adopt, flush, setController]);

  // Saindo da tela com algo por gravar: tenta gravar
  useEffect(() => () => {
    window.clearTimeout(timer.current);
    if (pending.current) void flush();
  }, [flush]);

  /** Marca a próxima mudança como ação de quem está usando a tela (assume o placar se ninguém marca). */
  const markUserAction = useCallback(() => { userActed.current = true; }, []);

  /** Passa a marcar esta quadra neste celular (o outro fica acompanhando). */
  const takeControl = useCallback(async () => {
    try {
      const server = await teamsService.getBracket(generationId, device);
      adopt(server);
      pending.current = JSON.stringify(server.state ?? toServer(stateRef.current));
      await flush();
    } catch {
      setStatus('offline');
    }
  }, [adopt, device, flush, generationId]);

  const seenAgoMs = controller?.seen_at ? Date.now() - new Date(controller.seen_at).getTime() : Infinity;
  const isScorer = !!controller && controller.device === device;
  const otherScorerActive = !!controller && !isScorer && seenAgoMs < INACTIVE_AFTER_MS;

  return {
    loaded,
    status,
    notice,
    dismissNotice: () => setNotice(null),
    controller,
    isScorer,
    otherScorerActive,
    seenAgoMs,
    markUserAction,
    takeControl,
  };
}
