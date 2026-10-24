import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { AuthShell } from '@/components/auth/AuthShell';
import { authInput, authLabel, authMuted } from '@/components/auth/authStyles';

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
      setError(err.response?.data?.detail || 'Não foi possível enviar agora. Tente de novo em instantes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle={success ? undefined : 'Digite seu e-mail e enviamos um link para você criar uma senha nova.'}
      footer={(
        <Link to="/login" className={`${authMuted} hover:text-red transition-colors inline-flex items-center gap-2`}>
          <ArrowLeft size={16} /> Voltar para o login
        </Link>
      )}
    >
      {success ? (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-500/15 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto border border-green-500/30">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-xl font-bold">Confira o seu e-mail</h2>
          <p className={`text-sm ${authMuted}`}>
            Se <strong className="text-gray-900 dark:text-white">{email}</strong> estiver cadastrado, você recebe um link em instantes.
            Olhe também a caixa de spam.
          </p>
          <Link to="/login" className="btn-primary w-full justify-center">Voltar para o login</Link>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red/10 border border-red/20 rounded-xl flex items-center gap-3 text-red text-sm font-medium">
              <AlertCircle size={18} className="shrink-0" /> <span>{error}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="email" className={authLabel}>E-mail cadastrado</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/40" size={18} />
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${authInput} pl-11`}
                placeholder="voce@email.com" autoComplete="email" required />
            </div>
          </div>
          <button type="submit" disabled={loading || !email} className="btn-primary w-full flex items-center justify-center gap-2 shadow-neon-red-sm disabled:opacity-50">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Enviando…</> : 'Enviar link de recuperação'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
