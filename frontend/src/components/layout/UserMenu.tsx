import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftRight, CircleUser, LogOut, Moon, Sun } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/store/ThemeContext';
import { useMyAthlete } from '@/hooks/useMyAthlete';
import { isStaff, PROFILE_LABELS } from '@/lib/roles';
import { cn } from '@/lib/utils';

const ROLE_STYLE = {
  admin: 'bg-red/10 text-red border-red/30',
  moderator: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  player: 'bg-text-primary/5 text-text-muted border-border/60',
} as const;

const item = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-secondary hover:bg-text-primary/[0.05] hover:text-text-primary transition-colors text-left';

/** Canto do topo: foto e nome; abre Meu perfil, alternar painel/atleta, tema e Sair. */
export function UserMenu() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { data: athlete } = useMyAthlete();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao tocar fora, com Esc ou ao trocar de tela
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);
  useEffect(() => { setOpen(false); }, [pathname]);

  if (!user) return null;
  const staff = isStaff(user);
  const inAthletePortal = pathname.startsWith('/athlete');
  const photo = athlete?.avatar_url;
  const go = (to: string) => { setOpen(false); navigate(to); };

  const avatar = (size: string) => photo
    ? <img src={photo} alt="" className={cn('rounded-full object-cover', size)} />
    : <span className={cn('rounded-full bg-red-gradient flex items-center justify-center text-white font-bold', size)}>{user.name?.charAt(0).toUpperCase()}</span>;

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" aria-label="Abrir menu da conta"
        className={cn('flex items-center gap-2 rounded-full md:rounded-xl md:pl-1 md:pr-2.5 md:py-1 transition-colors', open ? 'bg-surface' : 'hover:bg-surface')}>
        {avatar('w-8 h-8 text-xs')}
        <span className="hidden md:block text-right">
          <span className="block text-text-primary text-sm font-medium leading-tight max-w-[10rem] truncate">{user.name}</span>
          <span className="block text-text-muted text-xs">{PROFILE_LABELS[user.profile]}</span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-2 top-[60px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-72 rounded-2xl bg-white/95 dark:bg-[#050505]/95 backdrop-blur-3xl border border-gray-200 dark:border-white/10 shadow-2xl z-50 p-2"
          >
            <div className="flex items-center gap-3 px-2 py-2.5">
              {avatar('w-11 h-11 text-sm shrink-0')}
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-primary truncate">{user.name}</p>
                <p className="text-xs text-text-muted truncate">{user.email}</p>
                <span className={cn('mt-1 inline-block rounded-full border px-2 py-px text-[10px] font-black uppercase tracking-wider', ROLE_STYLE[user.profile])}>
                  {PROFILE_LABELS[user.profile]}
                </span>
              </div>
            </div>
            <div className="h-px bg-border/60 my-1" />

            {athlete && (
              <button type="button" role="menuitem" className={item} onClick={() => go('/athlete/profile')}>
                <CircleUser size={17} className="shrink-0" /> Meu perfil
              </button>
            )}
            {staff && (athlete || inAthletePortal) && (
              <button type="button" role="menuitem" className={item} onClick={() => go(inAthletePortal ? '/dashboard' : '/athlete')}>
                <ArrowLeftRight size={17} className="shrink-0" /> {inAthletePortal ? 'Voltar ao painel' : 'Ver como atleta'}
              </button>
            )}
            <button type="button" role="menuitem" className={item} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={17} className="shrink-0" /> : <Moon size={17} className="shrink-0" />}
              {theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            </button>
            <div className="h-px bg-border/60 my-1" />
            <button type="button" role="menuitem" className={cn(item, 'hover:text-red hover:bg-red/10')} onClick={() => { setOpen(false); logout(); navigate('/login'); }}>
              <LogOut size={17} className="shrink-0" /> Sair
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
