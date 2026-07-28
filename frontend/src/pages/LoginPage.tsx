import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/store/ThemeContext';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(4, 'Senha muito curta'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

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
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-hero-gradient pointer-events-none" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-red/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-blue/5 blur-3xl pointer-events-none" />

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 rounded-full bg-surface border border-border text-text-secondary hover:text-text-primary hover:scale-110 transition-all shadow-lg z-10"
        title="Alternar Tema"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md mx-4"
      >
        {/* Logo section */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-block mb-4"
          >
            <img
              src="/logo.png"
              alt="HellCife Vôlei"
              className="w-24 h-24 rounded-2xl object-cover mx-auto shadow-neon-red"
            />
          </motion.div>
          <h1 className="font-display text-5xl text-red tracking-widest">HELLCIFE</h1>
          <p className="text-text-muted text-sm tracking-widest uppercase mt-1">Vôlei Manager</p>
        </div>

        {/* Form card */}
        <div className="card p-8 border-border/50">
          <h2 className="font-display text-xl text-text-primary tracking-wider mb-6">ENTRAR</h2>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red/10 border border-red/30 rounded-lg p-3 mb-4 text-red text-sm"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">
                E-mail
              </label>
              <input
                {...register('email')}
                type="email"
                placeholder="admin@hellcife.com"
                className={cn('input w-full', errors.email && 'border-red/50 focus:ring-red/20')}
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-red text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={cn('input w-full pr-10', errors.password && 'border-red/50 focus:ring-red/20')}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-6"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Entrando...
                </>
              ) : (
                'ENTRAR'
              )}
            </button>
          </form>

          <p className="text-center text-text-muted text-xs mt-6">
            HellCife Vôlei Manager © {new Date().getFullYear()}
          </p>
          <p className="text-center text-text-muted/30 text-[10px] mt-2 uppercase tracking-widest font-medium select-none">
            Desenvolvido por DayFer
          </p>
        </div>
      </motion.div>
    </div>
  );
}
