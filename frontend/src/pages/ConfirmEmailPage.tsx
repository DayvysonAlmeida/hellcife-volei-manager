import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { signupService } from '@/services/signup';
import { AuthShell } from '@/components/auth/AuthShell';
import { authInput, authLabel, authMuted } from '@/components/auth/authStyles';

type State = { kind: 'loading' } | { kind: 'ok'; message: string } | { kind: 'error'; message: string; code?: string };

/** Abre pelo link do e-mail de cadastro: confirma o e-mail e explica que falta a aprovação da organização. */
export function ConfirmEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [email, setEmail] = useState('');
  const [resent, setResent] = useState('');
  const sent = useRef(false); // o link vale uma vez: não pode confirmar duas vezes (ex.: StrictMode)

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (!token) {
      setState({ kind: 'error', message: 'Link inválido. Confira se copiou o link inteiro.', code: 'invalid' });
      return;
    }
    signupService.confirmEmail(token)
      .then((r) => setState({ kind: 'ok', message: r.detail }))
      .catch((err) => setState({
        kind: 'error',
        message: err.response?.data?.detail || 'Não foi possível confirmar agora. Tente de novo em instantes.',
        code: err.response?.data?.code,
      }));
  }, [token]);

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setResent((await signupService.resendConfirmation(email.trim())).detail);
    } catch {
      setResent('Não foi possível reenviar agora. Espere um pouco e tente de novo.');
    }
  };

  return (
    <AuthShell title="Confirmação de e-mail">
        <div className="text-center space-y-4">
          {state.kind === 'loading' && (
            <p className="text-sm flex items-center justify-center gap-2 text-gray-500 dark:text-white/50"><Loader2 size={16} className="animate-spin" /> Confirmando…</p>
          )}
          {state.kind === 'ok' && (
            <>
              <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto border border-green-500/30">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-xl font-bold">E-mail confirmado ✅</h2>
              <p className={`text-sm ${authMuted}`}>{state.message} Você recebe um aviso quando o cadastro for aprovado.</p>
              <Link to="/login" className="btn-primary w-full justify-center">Entrar no app</Link>
            </>
          )}
          {state.kind === 'error' && (
            <>
              <div className="w-16 h-16 bg-red/10 text-red rounded-full flex items-center justify-center mx-auto border border-red/20">
                <AlertCircle size={32} />
              </div>
              <p className={`text-sm ${authMuted}`}>{state.message}</p>
              {state.code === 'expired' || state.code === 'invalid' ? (
                <form onSubmit={resend} className="space-y-3 text-left">
                  <label htmlFor="confirm-email" className={authLabel}>Receber um link novo</label>
                  <input id="confirm-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} placeholder="voce@email.com" />
                  <button type="submit" className="btn-primary w-full justify-center">Reenviar link</button>
                  {resent && <p className="text-green-400 text-xs text-center">{resent}</p>}
                </form>
              ) : (
                <Link to="/login" className="btn-primary w-full justify-center">Ir para o login</Link>
              )}
            </>
          )}
        </div>
    </AuthShell>
  );
}
