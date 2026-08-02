import { useState, useRef, useEffect } from 'react';
import { Bell, Check, Gift, Medal, Info, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types';

const ICONS = {
  prize: Gift,
  circuit: Medal,
  system: Info,
  alert: AlertTriangle,
};

const COLORS = {
  prize: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  circuit: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  system: 'text-gray-300 bg-gray-500/10 border-gray-500/20',
  alert: 'text-red bg-red/10 border-red/20',
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Fechar o menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-2 rounded-lg transition-all relative outline-none",
          isOpen ? "bg-gray-200 dark:bg-[#111] text-gray-900 dark:text-white" : "text-text-secondary hover:text-text-primary hover:bg-surface"
        )}
      >
        <Bell size={18} />
        
        {/* Unread Badge (Neon) */}
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red shadow-neon-red flex items-center justify-center">
            <span className="absolute w-full h-full rounded-full bg-red opacity-50 animate-ping"></span>
          </span>
        )}
      </button>

      {/* Popover/Dropdown (Glassmorphism) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-white/95 dark:bg-[#050505]/95 backdrop-blur-3xl border border-gray-200 dark:border-white/10 shadow-2xl dark:shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
              <h3 className="font-display tracking-wider text-gray-900 dark:text-white">NOTIFICAÇÕES</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={() => markAllAsRead()}
                  className="text-xs text-text-muted hover:text-red transition-colors flex items-center gap-1"
                >
                  <Check size={14} /> Lidas
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-text-muted flex flex-col items-center">
                  <Bell size={32} className="opacity-20 mb-3" />
                  <p className="text-sm">Nenhuma notificação por enquanto.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                  {notifications.map((notification: Notification) => {
                    const Icon = ICONS[notification.type] || Info;
                    const colorClass = COLORS[notification.type] || COLORS.system;
                    
                    return (
                      <div 
                        key={notification.id}
                        onClick={() => !notification.is_read && markAsRead(notification.id)}
                        className={cn(
                          "p-4 flex gap-3 transition-colors cursor-pointer",
                          !notification.is_read ? "bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10" : "opacity-60 hover:opacity-100 hover:bg-gray-50 dark:hover:bg-white/5"
                        )}
                      >
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border flex-shrink-0", colorClass)}>
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className={cn("text-sm font-medium mb-0.5 leading-tight", !notification.is_read ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300")}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 uppercase tracking-wider">
                            {new Date(notification.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <div className="w-2 h-2 rounded-full bg-red flex-shrink-0 mt-1.5 shadow-neon-red-sm" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Footer — Link para página completa */}
            <div className="p-3 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
              <Link
                to={`${location.pathname.startsWith('/athlete') ? '/athlete' : ''}/notifications`}
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-red transition-colors w-full py-1"
              >
                <Bell size={12} />
                Ver todas as notificações
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
