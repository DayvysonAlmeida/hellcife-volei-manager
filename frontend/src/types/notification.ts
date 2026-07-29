export interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'system' | 'prize' | 'circuit' | 'alert';
  is_read: boolean;
  created_at: string;
}
