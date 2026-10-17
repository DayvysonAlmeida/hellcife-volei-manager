import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, ArrowRight, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(4, 'Senha muito curta'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { theme, toggleTheme } = useTheme();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    try {
      await login(data.email, data.password);
      // Redireciona baseado no perfil
      const stored = localStorage.getItem('user');
      const userData = stored ? JSON.parse(stored) : null;
      if (userData?.profile === 'player') {
        navigate('/athlete');
      } else {
        navigate('/dashboard');
      }
    } catch {
      setError('E-mail ou senha incorretos. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#050505] flex relative overflow-x-hidden text-gray-900 dark:text-white selection:bg-red/30 transition-colors duration-300">
      
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-50 p-3 rounded-full bg-white/20 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white hover:bg-white/40 dark:hover:bg-black/60 transition-all shadow-xl dark:shadow-neon-blue"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      
      {/* Background for Mobile (Absolute, Full Screen) */}
      <div className="absolute inset-0 z-0 lg:hidden">
        <img src="/login-bg.webp" alt="HellCife Court" className="hidden dark:block w-full h-full object-cover opacity-30" />
        <img src="/login-bg-light.webp" alt="HellCife Court" className="block dark:hidden w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-100 via-gray-100/70 to-gray-100/30 dark:from-[#050505] dark:via-[#050505]/70 dark:to-[#050505]/30" />
      </div>

      {/* ---------------------------------------------------- */}
      {/* Left Side - Hero / Branding (Desktop Only)           */}
      {/* ---------------------------------------------------- */}
      <div className="hidden lg:flex w-[55%] relative flex-col justify-between p-14 overflow-hidden border-r border-gray-300 dark:border-white/5 shadow-2xl z-10 bg-gray-100 dark:bg-[#050505] transition-colors duration-300">
        <div className="absolute inset-0 z-0">
          <img src="/login-bg.webp" alt="HellCife Court" className="hidden dark:block w-full h-full object-cover opacity-70 mix-blend-screen" />
          <img src="/login-bg-light.webp" alt="HellCife Court" className="block dark:hidden w-full h-full object-cover opacity-70 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-transparent to-gray-100 dark:from-[#050505] dark:via-transparent dark:to-[#050505]" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-100 via-transparent to-transparent dark:from-[#050505] dark:via-transparent dark:to-transparent" />
          <div className="absolute inset-0 bg-red/10 mix-blend-overlay" />
        </div>
        
        <div className="relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.8 }} 
            className="inline-block"
          >
            <img 
              src="/escudo-hellcife.webp" 
              alt="HellCife Vôlei" 
              className="w-64 h-auto object-contain drop-shadow-[0_0_30px_rgba(217,4,41,0.6)]" 
            />
          </motion.div>
        </div>

        <div className="relative z-10 max-w-xl pb-10">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.8, delay: 0.2 }} 
            className="font-display text-6xl lg:text-7xl font-bold leading-tight mb-6 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-white/90 dark:to-white/40 drop-shadow-2xl"
          >
            DOMINE<br/>A QUADRA.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.8, delay: 0.4 }} 
            className="text-gray-600 dark:text-white/60 text-lg font-medium max-w-md"
          >
            A plataforma definitiva para organizar e elevar o nível das suas peladas. Conecte-se e respire o esporte.
          </motion.p>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* Right Side - Login Form (Centered on Mobile)         */}
      {/* ---------------------------------------------------- */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center items-center p-6 sm:p-12 relative z-10 overflow-x-hidden">
        
        {/* Animated Glowing Orbs Background (Vivid Red & Blue) */}
        <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-red/30 rounded-full blur-[140px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue/30 rounded-full blur-[140px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

        {/* Mobile Header (Hidden on Desktop) */}
        <div className="lg:hidden text-center mb-6 w-full mt-4">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, type: "spring" }} className="inline-block">
            <img 
              src="/escudo-hellcife.webp" 
              alt="HellCife Vôlei" 
              className="w-56 h-auto object-contain mx-auto drop-shadow-[0_0_30px_rgba(217,4,41,0.6)]" 
            />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          className="w-full max-w-md relative group/card"
        >
          {/* Animated Gradient Border Layer (Red to Blue) */}
          <div className="absolute -inset-[2px] bg-gradient-to-br from-red/80 via-transparent to-blue/80 rounded-[34px] opacity-50 group-hover/card:opacity-100 transition-opacity duration-700 blur-sm"></div>

          {/* Glassmorphic Card */}
          <div className="bg-white/80 lg:bg-white/60 dark:bg-[#050505]/80 dark:lg:bg-[#050505]/60 backdrop-blur-3xl rounded-[32px] p-8 sm:p-10 shadow-2xl dark:shadow-neon-blue border border-gray-200 dark:border-white/10 relative overflow-hidden transition-colors duration-300">
            {/* Ambient inner glow */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-red/60 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-blue/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-br from-black/5 dark:from-white/5 to-transparent pointer-events-none opacity-50" />

            <h2 className="font-display text-3xl tracking-widest mb-8 text-center relative z-10 font-bold uppercase text-neon-red">
              ACESSO
            </h2>

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red/10 border border-red/20 rounded-xl p-3 mb-6 text-red text-sm text-center relative z-10 font-medium backdrop-blur-sm">
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 relative z-10">
              
              {/* Premium Email Input */}
              <div className="relative">
                <input
                  {...register('email')}
                  type="email"
                  id="email"
                  placeholder=" "
                  className={cn(
                    "block w-full px-5 pt-6 pb-2 bg-gray-50/50 dark:bg-black/40 border border-gray-300 dark:border-white/10 rounded-2xl text-gray-900 dark:text-white text-base appearance-none focus:outline-none focus:ring-1 focus:ring-red focus:border-red focus:bg-white dark:focus:bg-black/60 transition-all peer backdrop-blur-md shadow-inner",
                    errors.email && 'border-red/50 focus:ring-red'
                  )}
                  autoComplete="email"
                />
                <label 
                  htmlFor="email" 
                  className="absolute text-xs font-bold text-gray-500 dark:text-white/40 duration-300 transform -translate-y-2 scale-75 top-3 z-10 origin-[0] left-5 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-focus:top-3 peer-focus:scale-75 peer-focus:-translate-y-2 peer-focus:text-red pointer-events-none uppercase tracking-wider"
                >
                  E-mail
                </label>
                {errors.email && <p className="text-red text-xs mt-1 ml-2 font-medium">{errors.email.message}</p>}
              </div>

              {/* Premium Password Input */}
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder=" "
                  className={cn(
                    "block w-full px-5 pt-6 pb-2 pr-12 bg-gray-50/50 dark:bg-black/40 border border-gray-300 dark:border-white/10 rounded-2xl text-gray-900 dark:text-white text-base appearance-none focus:outline-none focus:ring-1 focus:ring-red focus:border-red focus:bg-white dark:focus:bg-black/60 transition-all peer backdrop-blur-md shadow-inner",
                    errors.password && 'border-red/50 focus:ring-red'
                  )}
                  autoComplete="current-password"
                />
                <label 
                  htmlFor="password" 
                  className="absolute text-xs font-bold text-gray-500 dark:text-white/40 duration-300 transform -translate-y-2 scale-75 top-3 z-10 origin-[0] left-5 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-focus:top-3 peer-focus:scale-75 peer-focus:-translate-y-2 peer-focus:text-red pointer-events-none uppercase tracking-wider"
                >
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                {errors.password && <p className="text-red text-xs mt-1 ml-2 font-medium">{errors.password.message}</p>}
              </div>

              <div className="flex justify-end relative z-10">
                <Link to="/forgot-password" className="text-xs font-medium text-gray-500 dark:text-white/60 hover:text-red dark:hover:text-red transition-colors">
                  Esqueceu a senha?
                </Link>
              </div>

              {/* Glowing Submit Button using Project Neon Classes */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full relative group mt-8 overflow-hidden rounded-2xl p-[1px]"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-red to-blue opacity-70 group-hover:opacity-100 transition-opacity duration-300 blur-md"></span>
                <div className="relative bg-red hover:bg-red-dark text-white font-display tracking-widest text-sm py-4 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 shadow-neon-red">
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      ACESSANDO...
                    </>
                  ) : (
                    <>
                      ENTRAR NO SISTEMA
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>
            </form>
          </div>
          
          <p className="text-center text-gray-400 dark:text-white/30 text-[10px] mt-8 uppercase tracking-widest font-medium select-none">
            HellCife Vôlei © {new Date().getFullYear()} • Desenvolvido por DayFer
          </p>
        </motion.div>
      </div>
    </div>
  );
}
