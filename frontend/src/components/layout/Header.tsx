import { useLocation } from 'react-router-dom';
import { Menu, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/store/ThemeContext';
import { NotificationBell } from './NotificationBell';

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/players': 'Atletas',
  '/evaluations': 'Avaliações',
  '/attendance': 'Controle de Presença',
  '/teams': 'Gerador de Times',
  '/matches': 'Partidas',
  '/hall-of-fame': 'Hall da Fama',
  '/settings': 'Configurações',
};

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const routeLabel = Object.entries(routeLabels).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] || 'HellLife Vôlei';

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between px-6 h-[57px]">
        {/* Left: Logo + Page title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-all md:hidden"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/escudo-hellcife.png" alt="HellCife" className="h-8 w-auto object-contain drop-shadow-md" />
            <span className="text-red font-display text-base tracking-widest hidden sm:block">
              HELLCIFE VÔLEI
            </span>
          </div>
        </div>

        {/* Right: notifications + user */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-all"
            title="Alternar Tema"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <NotificationBell />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-gradient flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-right">
              <p className="text-text-primary text-sm font-medium leading-tight">{user?.name}</p>
              <p className="text-text-muted text-xs capitalize">{user?.profile}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
