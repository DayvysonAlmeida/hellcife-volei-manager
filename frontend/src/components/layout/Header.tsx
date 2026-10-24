import { Menu, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/store/ThemeContext';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between px-3 sm:px-6 h-[57px]">
        {/* Left: Logo + Page title */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onMenuToggle}
            aria-label="Abrir menu"
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-all md:hidden"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/escudo-hellcife.webp" alt="HellCife" className="h-8 w-auto object-contain drop-shadow-md" />
            <span className="text-red font-display text-base tracking-widest hidden sm:block">
              HELLCIFE VÔLEI
            </span>
          </div>
        </div>

        {/* Right: tema, notificações e o menu da conta */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-all"
            title={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
