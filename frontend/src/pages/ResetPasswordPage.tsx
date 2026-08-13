import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid || !token) {
      setError('Link de recuperação inválido ou expirado.');
    }
  }, [uid, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword || !uid || !token) return;

    if (newPassword !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await api.post('/auth/reset-password/', { 
        uidb64: uid,
        token: token,
        new_password: newPassword,
        new_password_confirm: confirmPassword
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.token || err.response?.data?.detail || 'Ocorreu um erro ao tentar redefinir a senha.');
    } finally {
      setLoading(false);
    }
  };

  if (!uid || !token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
        <div className="card p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Link Inválido</h2>
          <p className="text-text-muted mb-6">O link de recuperação de senha é inválido ou já expirou.</p>
          <Link to="/forgot-password" className="btn-primary w-full justify-center">
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

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
            Criar Nova Senha
          </h1>
          <p className="text-text-muted text-sm px-4">
            Digite sua nova senha abaixo para recuperar seu acesso.
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
              <h2 className="text-xl font-bold text-white mb-2">Senha Redefinida!</h2>
              <p className="text-text-secondary text-sm mb-6">
                Sua senha foi alterada com sucesso. Redirecionando para o login...
              </p>
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
                <label htmlFor="newPassword" className="block text-text-secondary text-xs font-bold uppercase tracking-wider">
                  Nova Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-glass pl-10 w-full"
                    placeholder="Mínimo de 6 caracteres"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="confirmPassword" className="block text-text-secondary text-xs font-bold uppercase tracking-wider">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-glass pl-10 w-full"
                    placeholder="Repita a senha"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="btn-primary w-full justify-center shadow-neon-red-sm disabled:opacity-50 disabled:shadow-none transition-all"
              >
                {loading ? 'Salvando...' : 'Salvar Nova Senha'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
