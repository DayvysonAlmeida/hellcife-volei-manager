import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/store/ThemeContext';

/**
 * Moldura das telas de acesso (esqueci a senha, redefinir senha, criar conta, confirmar e-mail),
 * com o mesmo visual do login: foto da quadra, escudo, cartão de vidro e tema claro/escuro.
 */
export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#050505] flex relative overflow-x-hidden text-gray-900 dark:text-white selection:bg-red/30 transition-colors duration-300">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
        className="absolute top-5 right-5 z-50 p-3 rounded-full bg-white/20 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-white/10 hover:bg-white/40 dark:hover:bg-black/60 transition-all shadow-xl dark:shadow-neon-blue"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Foto da quadra ao fundo no celular */}
      <div className="absolute inset-0 z-0 lg:hidden">
        <img src="/login-bg.webp" alt="" className="hidden dark:block w-full h-full object-cover opacity-30" />
        <img src="/login-bg-light.webp" alt="" className="block dark:hidden w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-100 via-gray-100/70 to-gray-100/30 dark:from-[#050505] dark:via-[#050505]/70 dark:to-[#050505]/30" />
      </div>

      {/* Lado da marca no computador */}
      <div className="hidden lg:flex w-[50%] relative flex-col justify-between p-14 overflow-hidden border-r border-gray-300 dark:border-white/5 shadow-2xl z-10">
        <div className="absolute inset-0 z-0">
          <img src="/login-bg.webp" alt="" className="hidden dark:block w-full h-full object-cover opacity-70 mix-blend-screen" />
          <img src="/login-bg-light.webp" alt="" className="block dark:hidden w-full h-full object-cover opacity-70 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-transparent to-gray-100 dark:from-[#050505] dark:via-transparent dark:to-[#050505]" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-100 via-transparent to-transparent dark:from-[#050505] dark:via-transparent dark:to-transparent" />
          <div className="absolute inset-0 bg-red/10 mix-blend-overlay" />
        </div>
        <img src="/escudo-hellcife.webp" alt="HellCife Vôlei" className="relative z-10 w-56 h-auto object-contain drop-shadow-[0_0_30px_rgba(217,4,41,0.6)]" />
        <h2 className="relative z-10 font-display text-6xl font-bold leading-tight pb-10 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-white/90 dark:to-white/40">
          DOMINE<br />A QUADRA.
        </h2>
      </div>

      {/* Cartão */}
      <div className="w-full lg:w-[50%] flex flex-col items-center px-4 py-10 sm:p-12 relative z-10 lg:justify-center">
        <div className="absolute top-0 left-0 w-[360px] h-[360px] bg-red/25 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[360px] h-[360px] bg-blue/25 rounded-full blur-[140px] pointer-events-none" />

        <img src="/escudo-hellcife.webp" alt="HellCife Vôlei" className="lg:hidden w-40 h-auto mx-auto mb-6 mt-4 drop-shadow-[0_0_30px_rgba(217,4,41,0.6)]" />

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md relative">
          <div className="absolute -inset-[2px] bg-gradient-to-br from-red/70 via-transparent to-blue/70 rounded-[34px] opacity-50 blur-sm" />
          <div className="relative bg-white/85 lg:bg-white/70 dark:bg-[#050505]/85 dark:lg:bg-[#050505]/70 backdrop-blur-3xl rounded-[32px] p-6 sm:p-9 shadow-2xl dark:shadow-neon-blue border border-gray-200 dark:border-white/10 overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-red/60 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-blue/60 to-transparent" />
            <div className="relative z-10">
              <h1 className="font-display text-3xl tracking-widest text-center font-bold uppercase text-neon-red">{title}</h1>
              {subtitle && <p className="text-center text-sm text-gray-500 dark:text-white/50 mt-2">{subtitle}</p>}
              <div className="mt-7">{children}</div>
            </div>
          </div>
        </motion.div>

        {footer && <div className="relative z-10 mt-6 text-center text-sm">{footer}</div>}
        <p className="relative z-10 text-center text-gray-400 dark:text-white/30 text-[10px] mt-8 uppercase tracking-widest font-medium select-none">
          HellCife Vôlei © {new Date().getFullYear()} • Desenvolvido por DayFer
        </p>
      </div>
    </div>
  );
}
