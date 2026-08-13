import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');
    
    try {
      await api.post('/auth/forgot-password/', { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ocorreu um erro ao tentar recuperar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-red/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <img src="/logo_simbolo.png" alt="Hellcife" className="w-16 h-16 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(217,4,41,0.5)]" />
          <h1 className="text-2xl sm:text-3xl font-display text-white mb-2 uppercase tracking-wide">
            Recuperar Senha
          </h1>
          <p className="text-text-muted text-sm px-4">
            Digite seu e-mail abaixo e enviaremos instruções de como redefinir sua senha.
          </p>
        </div>

        <div className="card p-6 sm:p-8 backdrop-blur-xl bg-surface/80 border border-white/10 shadow-2xl">
          {success ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-4"
            >
              <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">E-mail Enviado!</h2>
              <p className="text-text-secondary text-sm mb-6">
                Se o e-mail <strong>{email}</strong> estiver cadastrado em nosso sistema, você receberá um link de recuperação em instantes.
              </p>
              <Link to="/login" className="btn-primary w-full justify-center">
                Voltar para o Login
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-red/10 border border-red/20 rounded-lg flex items-center gap-3 text-red text-sm font-medium">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="email" className="block text-text-secondary text-xs font-bold uppercase tracking-wider">
                  E-mail cadastrado
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-glass pl-10 w-full"
                    placeholder="voce@email.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="btn-primary w-full justify-center shadow-neon-red-sm disabled:opacity-50 disabled:shadow-none transition-all"
              >
                {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
              </button>
            </form>
          )}
        </div>

        {!success && (
          <div className="mt-6 text-center">
            <Link to="/login" className="text-text-muted hover:text-white transition-colors text-sm flex items-center justify-center gap-2">
              <ArrowLeft size={16} /> Voltar para o Login
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
