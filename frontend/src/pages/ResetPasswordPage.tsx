import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { AuthShell } from '@/components/auth/AuthShell';
import { authInput, authLabel, authMuted } from '@/components/auth/authStyles';
import { cn } from '@/lib/utils';

const MIN_LENGTH = 8;

/** Primeira mensagem que a API mandou (vem como texto ou como lista). */
function firstMessage(value: unknown) {
  return Array.isArray(value) ? String(value[0]) : value ? String(value) : '';
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(!uid || !token);

  const tooShort = newPassword.length > 0 && newPassword.length < MIN_LENGTH;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = newPassword.length >= MIN_LENGTH && newPassword === confirmPassword && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !uid || !token) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password/', { uidb64: uid, token, new_password: newPassword, new_password_confirm: confirmPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      const data = err.response?.data || {};
      if (data.token) {
        setExpired(true); // link vencido ou já usado
      } else {
        setError(firstMessage(data.new_password) || firstMessage(data.detail) || 'Não foi possível trocar a senha. Tente de novo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <Link to="/login" className={`${authMuted} hover:text-red transition-colors inline-flex items-center gap-2`}>
      <ArrowLeft size={16} /> Voltar para o login
    </Link>
  );

  if (expired) {
    return (
      <AuthShell title="Link vencido" footer={footer}>
        <div className="text-center space-y-4">
          <AlertCircle size={44} className="text-red mx-auto" />
          <p className={`text-sm ${authMuted}`}>
            Este link de troca de senha não vale mais: ele vence depois de um tempo e só pode ser usado uma vez. Peça outro, é rapidinho.
          </p>
          <Link to="/forgot-password" className="btn-primary w-full justify-center">Pedir outro link</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nova senha" subtitle={success ? undefined : 'Escolha a nova senha para entrar no app.'} footer={footer}>
      {success ? (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-3">
          <div className="w-16 h-16 bg-green-500/15 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto border border-green-500/30">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-xl font-bold">Senha trocada!</h2>
          <p className={`text-sm ${authMuted}`}>Levando você para o login…</p>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {error && (
            <div className="p-3 bg-red/10 border border-red/20 rounded-xl flex items-center gap-3 text-red text-sm font-medium">
              <AlertCircle size={18} className="shrink-0" /> <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="newPassword" className={authLabel}>Nova senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/40" size={18} />
              <input id="newPassword" type={show ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className={cn(authInput, 'pl-11 pr-11', tooShort && 'border-red/60')} autoComplete="new-password" />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/40 hover:text-red">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className={cn('text-[11px]', tooShort ? 'text-red' : authMuted)}>Pelo menos {MIN_LENGTH} caracteres.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className={authLabel}>Repita a nova senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/40" size={18} />
              <input id="confirmPassword" type={show ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className={cn(authInput, 'pl-11', mismatch && 'border-red/60')} autoComplete="new-password" />
            </div>
            {mismatch && <p className="text-[11px] text-red">As senhas não são iguais.</p>}
          </div>

          <button type="submit" disabled={!canSubmit} className="btn-primary w-full flex items-center justify-center gap-2 shadow-neon-red-sm disabled:opacity-50">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Salvando…</> : 'Salvar nova senha'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
