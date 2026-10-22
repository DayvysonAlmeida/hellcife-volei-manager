const DEVICE_KEY = 'hellcife-device-id';

/** Código deste aparelho (fica no navegador): diz qual celular está marcando o placar de uma quadra. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'sem-armazenamento';
  }
}
