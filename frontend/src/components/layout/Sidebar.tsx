import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Users, CalendarDays, BarChart3, Settings, FileText, Trophy, Star, LogOut, Swords, CircleUser, Dumbbell, Circle, LayoutDashboard, TrendingUp, Shuffle, ScrollText, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Dashboard' },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { to: '/players', icon: Users, label: 'Atletas' },
  { to: '/evaluations', icon: TrendingUp, label: 'Avaliações' },
  { to: '/attendance', icon: Circle, label: 'Circuito' },
  { to: '/court-checkin', icon: ClipboardList, label: 'Tiragem de Falta' },
  { to: '/teams', icon: Shuffle, label: 'Peladas' },
  { to: '/matches', icon: Swords, label: 'Jogos' },
  { to: '/stars-system', icon: Star, label: 'Sistema de Estrelas' },
  { to: '/regulation', icon: ScrollText, label: 'Regulamento' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Travar o scroll da página quando o menu mobile estiver aberto
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Se for mobile, nunca deve estar "collapsed" (no sentido de 72px). Ou está aberta (256px) ou fechada.
  // Para evitar complexidade excessiva, usamos classes Tailwind para gerenciar os estados.
  
  return (
    <>
      {/* Overlay para Mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onMobileClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        // Animação para desktop (width) e mobile (x)
        animate={
          typeof window !== 'undefined' && window.innerWidth >= 768
            ? { width: collapsed ? 72 : 256, x: 0 }
            : { width: 256, x: mobileOpen ? 0 : '-100%' }
        }
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={cn(
          "fixed left-0 top-0 h-full bg-surface border-r border-border z-50 flex flex-col overflow-hidden shadow-2xl md:shadow-none",
          // Garante que inicie oculto no mobile antes da hidratação
          !mobileOpen && "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border min-h-[73px]">
          <img
            src="/logo.png"
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
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {!collapsed && (
            <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest px-3 mb-2">
              Navegação
            </p>
          )}
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => onMobileClose()} // Fecha menu no mobile ao clicar
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

        {/* Toggle button (apenas desktop) */}
        <button
          onClick={onToggle}
          className="hidden md:flex absolute -right-3 top-[73px] w-6 h-6 bg-card border border-border rounded-full items-center justify-center text-text-secondary hover:text-red hover:border-red transition-all duration-200 z-50"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </motion.aside>
    </>
  );
}
