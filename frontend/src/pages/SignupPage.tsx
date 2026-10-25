import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, Eye, EyeOff, Loader2, MailCheck, X } from 'lucide-react';
import { signupService } from '@/services/signup';
import { regulationService } from '@/services';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import { cn } from '@/lib/utils';
import { formatCpf, isValidCpf } from '@/lib/identity';
import { AuthShell } from '@/components/auth/AuthShell';
import { authInput, authLabel, authMuted } from '@/components/auth/authStyles';
import { GENDER_LABELS, GENDER_ORDER, type Gender, type Position } from '@/types';

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'outside', label: 'Ponteiro' },
  { value: 'setter', label: 'Levantador' },
  { value: 'middle', label: 'Central' },
  { value: 'opposite', label: 'Oposto' },
  { value: 'libero', label: 'Líbero' },
  { value: 'universal', label: 'Universal' },
];

interface Form {
  name: string;
  legal_name: string;
  cpf: string;
  nickname: string;
  email: string;
  password: string;
  password_confirm: string;
  phone: string;
  gender: '' | Gender;
  main_position: '' | Position;
  secondary_position: '' | Position;
  age: string;
  height: string;
  instagram: string;
  accept_terms: boolean;
  website: string; // isca para robôs: escondida da pessoa
}

const EMPTY: Form = {
  name: '', legal_name: '', cpf: '', nickname: '', email: '', password: '', password_confirm: '', phone: '',
  gender: '', main_position: '', secondary_position: '', age: '', height: '', instagram: '', accept_terms: false, website: '',
};

type Errors = Partial<Record<keyof Form | 'avatar' | 'detail', string>>;

/** Primeira mensagem de cada campo que a API recusou. */
function apiErrors(data: unknown): Errors {
  if (!data || typeof data !== 'object') return { detail: 'Não foi possível enviar o cadastro. Tente de novo.' };
  const errors: Errors = {};
  for (const [field, value] of Object.entries(data as Record<string, unknown>)) {
    const message = Array.isArray(value) ? String(value[0]) : String(value);
    errors[field as keyof Errors] = message;
  }
  return errors;
}

function Field({ id, label, required, error, hint, children }: {
  id: string; label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={authLabel}>
        {label}{required && <span className="text-red"> *</span>}
      </label>
      {children}
      {error ? <p className="text-red text-xs font-medium">{error}</p> : hint && <p className={`text-[11px] ${authMuted}`}>{hint}</p>}
    </div>
  );
}

/** Cadastro de novos integrantes: confirma o e-mail e espera a aprovação da organização. */
export function SignupPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [doneEmail, setDoneEmail] = useState('');
  const [resent, setResent] = useState('');
  const [regulation, setRegulation] = useState<string | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const openRegulation = async () => {
    setRegulation('');
    try {
      setRegulation((await regulationService.get()).content);
    } catch {
      setRegulation('<p>Não foi possível carregar o regulamento agora. Tente de novo em instantes.</p>');
    }
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (form.name.trim().length < 2) e.name = 'Informe como você quer ser chamado no app.';
    if (!isValidCpf(form.cpf)) e.cpf = 'CPF inválido. Confira os números.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Informe um e-mail válido.';
    if (form.password.length < 8) e.password = 'A senha precisa ter pelo menos 8 caracteres.';
    if (form.password !== form.password_confirm) e.password_confirm = 'As senhas não são iguais.';
    if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Informe o WhatsApp com DDD.';
    if (!form.gender) e.gender = 'Escolha uma opção.';
    if (!form.main_position) e.main_position = 'Escolha a sua posição.';
    if (avatar && avatar.size > 5 * 1024 * 1024) e.avatar = 'A foto precisa ter até 5 MB.';
    if (!form.accept_terms) e.accept_terms = 'Para se cadastrar, aceite o regulamento e o uso dos seus dados.';
    return e;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== '' && value !== null) data.append(key, String(value));
    });
    if (avatar) data.append('avatar', avatar);

    setSending(true);
    try {
      await signupService.signup(data);
      setDoneEmail(form.email.trim().toLowerCase());
    } catch (err: any) {
      setErrors(err.response?.status === 429
        ? { detail: 'Muitas tentativas. Espere um pouco e tente de novo.' }
        : apiErrors(err.response?.data));
    } finally {
      setSending(false);
    }
  };

  const resend = async () => {
    try {
      setResent((await signupService.resendConfirmation(doneEmail)).detail);
    } catch {
      setResent('Não foi possível reenviar agora. Espere um pouco e tente de novo.');
    }
  };

  return (
    <>
    <AuthShell
      title="Criar conta"
      subtitle={doneEmail ? undefined : 'Cadastre-se para jogar com o Hellcife Vôlei.'}
      footer={(
        <Link to="/login" className={`${authMuted} hover:text-red transition-colors inline-flex items-center gap-2`}>
          <ArrowLeft size={16} /> Já tenho conta
        </Link>
      )}
    >
          {doneEmail ? (
            <div className="text-center py-2 space-y-4">
              <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto border border-green-500/30">
                <MailCheck size={32} />
              </div>
              <h2 className="text-xl font-bold">Confira o seu e-mail</h2>
              <p className={`text-sm ${authMuted}`}>
                Enviamos um link para <strong>{doneEmail}</strong>. Clique nele para confirmar o cadastro (vale por 48 horas).
                Depois, a organização aprova e você já pode usar o app.
              </p>
              <p className={`text-xs ${authMuted}`}>Não chegou? Olhe a caixa de spam ou peça outro link.</p>
              {resent && <p className="text-green-400 text-xs">{resent}</p>}
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button type="button" onClick={resend} className="btn-secondary justify-center">Reenviar link</button>
                <Link to="/login" className="btn-primary justify-center">Ir para o login</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-6" noValidate>
              {errors.detail && (
                <div className="p-3 bg-red/10 border border-red/20 rounded-lg flex items-center gap-3 text-red text-sm font-medium">
                  <AlertCircle size={18} className="shrink-0" /> <span>{errors.detail}</span>
                </div>
              )}

              {/* Isca para robôs: invisível para pessoas */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website}
                onChange={(e) => set('website', e.target.value)} className="hidden" aria-hidden />

              <section className="space-y-4">
                <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-white/40">Quem é você</h2>
                <Field id="signup-name" label="Nome social" required error={errors.name} hint="Como você quer ser chamado no app.">
                  <input id="signup-name" className={authInput} value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="nickname" />
                </Field>
                <Field id="signup-legal" label="Nome completo (civil)" error={errors.legal_name} hint="Opcional. Só a organização vê.">
                  <input id="signup-legal" className={authInput} value={form.legal_name} onChange={(e) => set('legal_name', e.target.value)} autoComplete="name" />
                </Field>
                <Field id="signup-cpf" label="CPF" required error={errors.cpf} hint="Só para evitar cadastro repetido. Fica guardado cifrado: ninguém vê o número.">
                  <input id="signup-cpf" inputMode="numeric" className={authInput} value={form.cpf} placeholder="000.000.000-00"
                    onChange={(e) => set('cpf', formatCpf(e.target.value))} autoComplete="off" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field id="signup-nickname" label="Apelido" error={errors.nickname} hint="Opcional.">
                    <input id="signup-nickname" className={authInput} value={form.nickname} onChange={(e) => set('nickname', e.target.value)} />
                  </Field>
                  <Field id="signup-gender" label="Gênero" required error={errors.gender}>
                    <select id="signup-gender" className={authInput} value={form.gender} onChange={(e) => set('gender', e.target.value as Form['gender'])}>
                      <option value="">Selecione…</option>
                      {GENDER_ORDER.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
                    </select>
                  </Field>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-white/40">Acesso</h2>
                <Field id="signup-email" label="E-mail" required error={errors.email} hint="Vamos mandar um link para confirmar.">
                  <input id="signup-email" type="email" className={authInput} value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field id="signup-password" label="Senha" required error={errors.password} hint="Pelo menos 8 caracteres.">
                    <div className="relative">
                      <input id="signup-password" type={showPassword ? 'text' : 'password'} className={cn(authInput, 'pr-10')} value={form.password}
                        onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
                      <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                        aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </Field>
                  <Field id="signup-password2" label="Repita a senha" required error={errors.password_confirm}>
                    <input id="signup-password2" type={showPassword ? 'text' : 'password'} className={authInput} value={form.password_confirm}
                      onChange={(e) => set('password_confirm', e.target.value)} autoComplete="new-password" />
                  </Field>
                </div>
                <Field id="signup-phone" label="WhatsApp" required error={errors.phone}>
                  <input id="signup-phone" type="tel" inputMode="tel" className={authInput} placeholder="(81) 99999-9999" value={form.phone}
                    onChange={(e) => set('phone', e.target.value)} autoComplete="tel" />
                </Field>
              </section>

              <section className="space-y-4">
                <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-white/40">Na quadra</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field id="signup-position" label="Posição principal" required error={errors.main_position}>
                    <select id="signup-position" className={authInput} value={form.main_position} onChange={(e) => set('main_position', e.target.value as Form['main_position'])}>
                      <option value="">Selecione…</option>
                      {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </Field>
                  <Field id="signup-position2" label="Posição secundária" error={errors.secondary_position} hint="Opcional.">
                    <select id="signup-position2" className={authInput} value={form.secondary_position} onChange={(e) => set('secondary_position', e.target.value as Form['secondary_position'])}>
                      <option value="">Nenhuma</option>
                      {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </Field>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-white/40">Opcional</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field id="signup-age" label="Idade" error={errors.age}>
                    <input id="signup-age" type="number" inputMode="numeric" min={10} max={99} className={authInput} value={form.age} onChange={(e) => set('age', e.target.value)} />
                  </Field>
                  <Field id="signup-height" label="Altura (m)" error={errors.height}>
                    <input id="signup-height" type="number" inputMode="decimal" step="0.01" min={1} max={2.5} placeholder="1,75" className={authInput}
                      value={form.height} onChange={(e) => set('height', e.target.value)} />
                  </Field>
                </div>
                <Field id="signup-instagram" label="Instagram" error={errors.instagram}>
                  <input id="signup-instagram" className={authInput} placeholder="@seuperfil" value={form.instagram} onChange={(e) => set('instagram', e.target.value)} />
                </Field>
                <Field id="signup-avatar" label="Foto" error={errors.avatar} hint="Imagem de até 5 MB.">
                  <label htmlFor="signup-avatar" className={cn(authInput, 'flex items-center gap-2 cursor-pointer text-gray-500 dark:text-white/50')}>
                    <Camera size={16} className="shrink-0" />
                    <span className="truncate">{avatar ? avatar.name : 'Escolher foto'}</span>
                    {avatar && (
                      <button type="button" onClick={(e) => { e.preventDefault(); setAvatar(null); }} className="ml-auto" aria-label="Tirar foto">
                        <X size={14} />
                      </button>
                    )}
                  </label>
                  <input id="signup-avatar" type="file" accept="image/*" className="sr-only"
                    onChange={(e) => { setAvatar(e.target.files?.[0] ?? null); setErrors((er) => ({ ...er, avatar: undefined })); }} />
                </Field>
              </section>

              <div className="space-y-1">
                <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-white/70 cursor-pointer">
                  <input type="checkbox" checked={form.accept_terms} onChange={(e) => set('accept_terms', e.target.checked)} className="mt-1 w-4 h-4 accent-red shrink-0" />
                  <span>
                    Li e aceito o{' '}
                    <button type="button" onClick={openRegulation} className="text-red font-semibold underline underline-offset-2">regulamento</button>
                    {' '}e autorizo o uso dos meus dados pelo Hellcife Vôlei para organizar os jogos (presença, times e rankings),
                    inclusive o gênero informado, que serve só para equilibrar os times, e o CPF, guardado cifrado só para
                    evitar cadastros repetidos.
                  </span>
                </label>
                {errors.accept_terms && <p className="text-red text-xs font-medium">{errors.accept_terms}</p>}
              </div>

              <button type="submit" disabled={sending} className="btn-primary w-full flex items-center justify-center gap-2 shadow-neon-red-sm disabled:opacity-50">
                {sending ? <><Loader2 size={16} className="animate-spin" /> Enviando…</> : <><CheckCircle2 size={16} /> Criar minha conta</>}
              </button>
            </form>
          )}
    </AuthShell>

      {/* Regulamento */}
      {regulation !== null && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Regulamento">
          <div className="card w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-display text-lg text-text-primary tracking-wider">REGULAMENTO</h2>
              <button type="button" onClick={() => setRegulation(null)} className="text-text-muted hover:text-text-primary" aria-label="Fechar">
                <X size={20} />
              </button>
            </div>
            <div className={cn('p-4 overflow-y-auto prose prose-invert prose-sm max-w-none text-text-secondary', !regulation && 'flex justify-center')}>
              {regulation ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(regulation) }} /> : <Loader2 className="animate-spin text-text-muted" />}
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <button type="button" onClick={() => { set('accept_terms', true); setRegulation(null); }} className="btn-primary">Li e aceito</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
