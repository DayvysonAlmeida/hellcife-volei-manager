import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Check, Gift, Medal, Info, AlertTriangle, Trash2, BellOff, Filter, Send, Loader2
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/store/AuthContext';
import { notificationsService } from '@/services/notifications';
import toast from 'react-hot-toast';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types';

type FilterType = 'all' | 'system' | 'prize' | 'circuit' | 'alert';

const ICONS: Record<string, React.ElementType> = {
  prize: Gift,
  circuit: Medal,
  system: Info,
  alert: AlertTriangle,
};

const COLORS: Record<string, string> = {
  prize: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  circuit: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  system: 'text-gray-300 bg-gray-500/10 border-gray-500/30',
  alert: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'Todas',
  system: 'Sistema',
  prize: 'Prêmios',
  circuit: 'Circuito',
  alert: 'Alertas',
};

const FILTER_ICONS: Record<FilterType, React.ElementType> = {
  all: Bell,
  system: Info,
  prize: Gift,
  circuit: Medal,
  alert: AlertTriangle,
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays === 1) return 'ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function NotificationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.profile === 'admin' || user?.profile === 'moderator';
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [filter, setFilter] = useState<FilterType>('all');
  
  const [showGlobalForm, setShowGlobalForm] = useState(false);
  const [globalTitle, setGlobalTitle] = useState('');
  const [globalMessage, setGlobalMessage] = useState('');

  const sendGlobalMutation = useMutation({
    mutationFn: () => notificationsService.sendGlobalAnnouncement(globalTitle, globalMessage),
    onSuccess: () => {
      toast.success('Aviso global enviado para todos os atletas!');
      setShowGlobalForm(false);
      setGlobalTitle('');
      setGlobalMessage('');
    },
    onError: () => {
      toast.error('Erro ao enviar aviso global.');
    }
  });

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter((n: Notification) => n.type === filter);

  const countByType = (type: string) =>
    notifications.filter((n: Notification) => n.type === type && !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 flex items-center justify-center">
            <Bell size={20} className="text-red" />
          </div>
          <div>
            <h1 className="font-display text-xl text-text-primary tracking-wider">NOTIFICAÇÕES</h1>
            {unreadCount > 0 && (
              <p className="text-xs text-text-muted">{unreadCount} não lida{unreadCount !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary border border-border rounded-lg px-3 py-1.5 hover:bg-surface-highlight transition-all"
            >
              <Check size={13} />
              Marcar lidas
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowGlobalForm(!showGlobalForm)}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-2"
            >
              <Send size={13} />
              Aviso Global
            </button>
          )}
        </div>
      </motion.div>

      {/* Form de Aviso Global (Apenas Admins) */}
      <AnimatePresence>
        {showGlobalForm && isAdmin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="card p-4 border border-red/30 bg-red/5 mb-4">
              <h3 className="text-sm font-bold text-red flex items-center gap-2 mb-3 uppercase tracking-widest">
                <Send size={14} /> Disparar Aviso Global
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Título do Aviso</label>
                  <input
                    type="text"
                    value={globalTitle}
                    onChange={(e) => setGlobalTitle(e.target.value)}
                    placeholder="Ex: Treino Cancelado"
                    className="input w-full py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Mensagem (Visível para todos os atletas)</label>
                  <textarea
                    value={globalMessage}
                    onChange={(e) => setGlobalMessage(e.target.value)}
                    rows={2}
                    placeholder="Digite a mensagem..."
                    className="input w-full text-sm resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setShowGlobalForm(false)} className="btn-ghost text-xs py-1.5 px-3">
                    Cancelar
                  </button>
                  <button 
                    onClick={() => sendGlobalMutation.mutate()} 
                    disabled={!globalTitle || !globalMessage || sendGlobalMutation.isPending}
                    className="btn-primary text-xs py-1.5 px-4 flex items-center gap-2"
                  >
                    {sendGlobalMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    Enviar para Todos
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtros por tipo */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
      >
        <Filter size={14} className="text-text-muted flex-shrink-0" />
        {(Object.keys(FILTER_LABELS) as FilterType[]).map((type) => {
          const Icon = FILTER_ICONS[type];
          const unread = type === 'all' ? unreadCount : countByType(type);
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border flex-shrink-0',
                filter === type
                  ? 'bg-red text-white border-red shadow-md shadow-red/20'
                  : 'bg-surface border-border text-text-muted hover:text-text-primary hover:border-red/30'
              )}
            >
              <Icon size={12} />
              {FILTER_LABELS[type]}
              {unread > 0 && (
                <span className={cn(
                  'text-[10px] font-black rounded-full px-1.5 py-0.5 leading-none',
                  filter === type ? 'bg-white/20 text-white' : 'bg-red/10 text-red'
                )}>
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </motion.div>

      {/* Lista de notificações */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="card overflow-hidden"
      >
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 px-4 text-center"
            >
              <BellOff size={40} className="text-text-muted/30 mb-4" />
              <p className="text-text-muted text-sm">
                {filter === 'all'
                  ? 'Nenhuma notificação por enquanto.'
                  : `Nenhuma notificação do tipo "${FILTER_LABELS[filter]}".`}
              </p>
            </motion.div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((notification: Notification, i: number) => {
                const Icon = ICONS[notification.type] || Info;
                const colorClass = COLORS[notification.type] || COLORS.system;

                return (
                  <motion.div
                    key={notification.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={cn(
                      'p-4 flex gap-4 group transition-colors',
                      !notification.is_read
                        ? 'bg-white/5 hover:bg-white/8'
                        : 'opacity-60 hover:opacity-80 hover:bg-white/3'
                    )}
                  >
                    {/* Ícone do tipo */}
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center border flex-shrink-0 mt-0.5',
                      colorClass
                    )}>
                      <Icon size={18} />
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          'text-sm font-semibold leading-tight',
                          !notification.is_read ? 'text-text-primary' : 'text-text-muted'
                        )}>
                          {notification.title}
                        </p>
                        <span className="text-[10px] text-text-muted/70 whitespace-nowrap flex-shrink-0 mt-0.5 uppercase tracking-wider">
                          {formatRelativeTime(notification.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">
                        {notification.message}
                      </p>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          title="Marcar como lida"
                          className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:text-green-400 hover:bg-green-400/10 transition-all"
                        >
                          <Check size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        title="Remover notificação"
                        className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Indicador de não lida */}
                    {!notification.is_read && (
                      <div className="w-2 h-2 rounded-full bg-red flex-shrink-0 mt-2 shadow-neon-red-sm" />
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
