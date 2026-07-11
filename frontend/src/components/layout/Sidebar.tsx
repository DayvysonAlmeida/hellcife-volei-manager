import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Star, CalendarCheck, Shuffle,
  Swords, Trophy, Settings, LogOut, ChevronLeft, ChevronRight, Menu, ScrollText, TrendingUp
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { to: '/players', icon: Users, label: 'Atletas' },
  { to: '/evaluations', icon: TrendingUp, label: 'Avaliações' },
  { to: '/attendance', icon: CalendarCheck, label: 'Presença' },
  { to: '/teams', icon: Shuffle, label: 'Gerador de Times' },
  { to: '/matches', icon: Swords, label: 'Partidas' },
  { to: '/stars-system', icon: Star, label: 'Sistema de Estrelas' },
  { to: '/regulation', icon: ScrollText, label: 'Regulamento' },
];

const adminItems = [
  { to: '/settings', icon: Settings, label: 'Configurações' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full bg-sidebar-gradient border-r border-border z-40 flex flex-col overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border min-h-[73px]">
        <img
          src="/logo.jpg"
          alt="HellCife"
          className="w-10 h-10 rounded-lg object-cover flex-shrink-0 shadow-neon-red-sm"
        />
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col leading-tight overflow-hidden"
            >
              <span className="font-display text-red text-lg tracking-widest whitespace-nowrap">HELLCIFE</span>
              <span className="text-text-muted text-xs tracking-widest uppercase whitespace-nowrap">Vôlei Manager</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest px-3 mb-2">
            Navegação
          </p>
        )}
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200 cursor-pointer group',
              isActive
                ? 'bg-red/10 text-red border-l-2 border-red'
                : 'text-text-secondary hover:bg-surface hover:text-text-primary'
            )}
            title={collapsed ? label : undefined}
          >
            <Icon size={20} className="flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="whitespace-nowrap text-sm"
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}

        {user?.profile === 'admin' && (
          <>
            {!collapsed && (
              <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest px-3 mt-4 mb-2">
                Admin
              </p>
            )}
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200 cursor-pointer',
                  isActive
                    ? 'bg-red/10 text-red border-l-2 border-red'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                )}
                title={collapsed ? label : undefined}
              >
                <Icon size={20} className="flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="whitespace-nowrap text-sm"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-border p-3">
        <div className={cn('flex items-center gap-3 px-2 py-2 rounded-lg', !collapsed && 'mb-1')}>
          <div className="w-8 h-8 rounded-full bg-red-gradient flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-text-primary text-sm font-medium truncate">{user?.name}</p>
                <p className="text-text-muted text-xs capitalize">{user?.profile}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={handleLogout}
          title="Sair"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-text-secondary hover:bg-red/10 hover:text-red transition-all duration-200 w-full',
            collapsed ? 'justify-center' : ''
          )}
        >
          <LogOut size={18} className="flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm"
              >
                Sair
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-[73px] w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-text-secondary hover:text-red hover:border-red transition-all duration-200 z-50"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}
