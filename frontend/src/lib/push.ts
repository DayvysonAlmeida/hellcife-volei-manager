import axios from 'axios';
import api, { API_URL } from '@/lib/api';

/** O navegador recebe Web Push (no iPhone, só com o app instalado na Tela de Início). */
export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** iPhone/iPad no Safari, fora do app instalado: lá o push não existe. */
export function isIosOutsideApp() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

function base64UrlToBytes(value: string) {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(current: ArrayBuffer | null, expected: Uint8Array) {
  if (!current || current.byteLength !== expected.length) return false;
  const bytes = new Uint8Array(current);
  return bytes.every((b, i) => b === expected[i]);
}

/**
 * O service worker do app (quem recebe o push com o app fechado). Sem ele, navigator.serviceWorker.ready
 * nunca resolve: desiste depois de alguns segundos com uma explicação, em vez de travar o botão.
 */
function serviceWorkerReady(timeoutMs = 10000) {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(
      () => reject(new Error('o serviço de notificações do app não carregou. Feche o app por completo e abra de novo.')),
      timeoutMs,
    )),
  ]);
}

/** Chave pública do servidor; nula quando o push está desligado lá. */
export async function getPushPublicKey() {
  const { data } = await api.get<{ public_key: string | null }>('/notifications/push/key/');
  return data.public_key;
}

/**
 * Inscreve este aparelho para o usuário logado (precisa da permissão já concedida).
 * Roda a cada abertura do app: renova a inscrição e, se outra conta entrou no aparelho, passa para ela.
 */
export async function subscribeThisDevice(publicKey: string) {
  const key = base64UrlToBytes(publicKey);
  const registration = await serviceWorkerReady();
  let subscription = await registration.pushManager.getSubscription();

  // A chave do servidor mudou: a inscrição antiga não recebe mais nada
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

  await api.post('/notifications/push/subscribe/', subscription.toJSON());
}

/**
 * Tira este aparelho do push ao sair da conta, para o próximo a entrar não receber os avisos de quem saiu.
 * Recebe o token antes de ele ser apagado; cancelar no navegador já basta, o aviso à API é só limpeza.
 */
export async function removePushSubscription(accessToken: string | null) {
  if (!pushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    const { endpoint } = subscription;
    await subscription.unsubscribe();
    if (accessToken) {
      // Sem o interceptor da api: um 401 aqui não pode tentar renovar a sessão que está sendo encerrada
      await axios.post(`${API_URL}/notifications/push/unsubscribe/`, { endpoint }, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
  } catch {
    // sem rede ou sem service worker: a API apaga a inscrição sozinha no próximo envio (410)
  }
}

/** Fecha as notificações do sistema que o aviso flutuante já mostrou com o app aberto. */
export function closeSystemNotifications(ids: number[]) {
  if (!('serviceWorker' in navigator) || ids.length === 0) return;
  navigator.serviceWorker.getRegistration()
    .then((registration) => registration?.getNotifications())
    .then((list) => list?.forEach((n) => {
      if (ids.includes(n.data?.id)) n.close();
    }))
    .catch(() => {});
}

export interface LocalPushState {
  supported: boolean;
  iosOutsideApp: boolean;
  permission: NotificationPermission | 'unsupported';
  /** O service worker do app está ativo (sem ele não chega push com o app fechado). */
  worker: boolean;
  /** Endereço da inscrição deste aparelho (null: não inscrito). */
  endpoint: string | null;
}

/** Como está o push neste aparelho: suporte, permissão e inscrição no navegador. */
export async function localPushState(): Promise<LocalPushState> {
  if (!pushSupported()) {
    return { supported: false, iosOutsideApp: isIosOutsideApp(), permission: 'unsupported', worker: false, endpoint: null };
  }
  let endpoint: string | null = null;
  let worker = false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    worker = !!registration?.active;
    endpoint = (await registration?.pushManager.getSubscription())?.endpoint ?? null;
  } catch {
    endpoint = null;
  }
  return { supported: true, iosOutsideApp: false, permission: Notification.permission, worker, endpoint };
}

/**
 * Botão "Ativar notificações": pede a permissão (precisa do toque) e inscreve o aparelho.
 * Lança um erro com a explicação quando não dá certo, para o diagnóstico mostrar.
 */
export async function enablePushHere() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'As notificações estão bloqueadas para o app. Libere nas configurações do celular (veja o passo a passo abaixo).'
      : 'Você não respondeu à pergunta de permissão. Toque em Ativar de novo.');
  }
  const publicKey = await getPushPublicKey().catch(() => null);
  if (!publicKey) throw new Error('O servidor está com o push desligado. Avise a organização.');
  try {
    await subscribeThisDevice(publicKey);
  } catch (err: any) {
    const detail = err?.response?.data?.endpoint?.[0] || err?.response?.data?.error || err?.message;
    throw new Error(`Não foi possível inscrever este aparelho${detail ? `: ${detail}` : '.'}`);
  }
}
