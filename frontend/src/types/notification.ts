export interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'system' | 'prize' | 'circuit' | 'alert' | 'financial';
  /** Tela do app que a notificação abre (vazio: fica na lista). */
  url?: string;
  is_read: boolean;
  created_at: string;
}
