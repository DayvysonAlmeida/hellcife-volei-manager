import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Camera, Eye, EyeOff, KeyRound, Loader2, Lock, Trash2 } from 'lucide-react';
import { PageLoading } from '@/components/ui/Loading';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/store/AuthContext';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { GENDER_LABELS, GENDER_ORDER, HAND_LABELS, type DominantHand, type Gender, type Player } from '@/types';

const card = 'rounded-[28px] border border-border/30 bg-surface/70 p-5';
const sectionTitle = 'font-display text-lg text-text-primary tracking-wider';
const label = 'block text-xs font-bold uppercase tracking-wider text-text-secondary';
const MAX_PHOTO = 5 * 1024 * 1024;
const MIN_PASSWORD = 8;

type Errors = Record<string, string | undefined>;

/** Primeira mensagem de cada campo que a API recusou. */
function apiErrors(data: unknown, fallback: string): Errors {
  if (!data || typeof data !== 'object') return { detail: fallback };
  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>).map(([field, value]) => [field, Array.isArray(value) ? String(value[0]) : String(value)]),
  );
}

/** (81) 99999-9999 enquanto digita; com código do país fica só os números. */
function formatPhone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 13);
  if (d.length > 11) return d;
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`;
}

const decimal = (v?: number | string | null) => (v == null || v === '' ? '' : String(v).replace('.', ','));

function Field({ id, title, required, error, hint, children }: {
  id: string; title: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1 min-w-0">
      <label htmlFor={id} className={label}>{title}{required && <span className="text-red"> *</span>}</label>
      {children}
      {error ? <p className="text-red text-xs font-medium">{error}</p> : hint && <p className="text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}

/** Meu perfil > Editar: o atleta muda os próprios dados. Posições, camisa e status ficam com a staff. */
export function EditMyProfilePage() {
  const { data: player, isLoading } = useQuery<Player>({
    queryKey: ['athlete-me'],
    queryFn: () => api.get('/players/me/').then((r) => r.data),
  });

  if (isLoading) return <PageLoading />;
  if (!player) return (
    <div className="card p-10 text-center">
      <p className="text-text-muted">Perfil não vinculado. Fale com o administrador.</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-10">
      <div className="flex flex-col gap-2">
        <Link to="/athlete/profile" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-red transition-colors w-fit">
          <ArrowLeft size={16} /> Meu perfil
        </Link>
        <h1 className="font-display text-3xl text-text-primary tracking-wider">EDITAR PERFIL</h1>
      </div>
      <ProfileForm player={player} />
      <StaffOnlyCard player={player} />
      <PasswordForm />
    </div>
  );
}

function ProfileForm({ player }: { player: Player }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: player.name,
    legal_name: player.legal_name ?? '',
    nickname: player.nickname ?? '',
    gender: player.gender,
    phone: formatPhone(player.phone ?? ''),
    instagram: player.instagram ?? '',
    age: player.age != null ? String(player.age) : '',
    height: decimal(player.height),
    weight: decimal(player.weight),
    dominant_hand: player.dominant_hand,
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [preview, setPreview] = useState<string | undefined>();
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!photo) return setPreview(undefined);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const pickPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > MAX_PHOTO) {
      setErrors((e) => ({ ...e, avatar: 'A foto precisa ser uma imagem de até 5 MB.' }));
      return;
    }
    setErrors((e) => ({ ...e, avatar: undefined }));
    setPhoto(file);
    setRemovePhoto(false);
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (form.name.trim().length < 2) e.name = 'Informe como você quer ser chamado no app.';
    if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Informe o WhatsApp com DDD.';
    return e;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      // Vazio apaga o valor opcional (a API entende "" como sem idade, sem altura…)
      data.append(key, key === 'height' || key === 'weight' ? value.replace(',', '.') : value);
    });
    if (photo) data.append('avatar', photo);
    else if (removePhoto) data.append('remove_avatar', 'true');

    setSaving(true);
    try {
      const saved = (await api.patch<Player>('/players/me/', data)).data;
      queryClient.setQueryData(['athlete-me'], saved);
      queryClient.invalidateQueries({ queryKey: ['athlete-stats'] });
      if (user && user.name !== saved.name) updateUser({ ...user, name: saved.name });
      toast.success('Perfil atualizado!');
      navigate('/athlete/profile');
    } catch (err: any) {
      setErrors(apiErrors(err.response?.data, 'Não foi possível salvar agora. Tente de novo.'));
    } finally {
      setSaving(false);
    }
  };

  const shownPhoto = preview ?? (removePhoto ? undefined : player.avatar_url);

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {errors.detail && <p className="rounded-2xl border border-red/30 bg-red/10 p-3 text-sm font-medium text-red">{errors.detail}</p>}

      <section className={cn(card, 'flex flex-col sm:flex-row items-center gap-5')}>
        <Avatar name={form.name || player.name} src={shownPhoto} size="xl" className="!w-24 !h-24 shrink-0 ring-2 ring-red/40" />
        <div className="flex flex-col items-center sm:items-start gap-2 min-w-0">
          <h2 className={sectionTitle}>FOTO</h2>
          <p className="text-xs text-text-muted text-center sm:text-left">Aparece no seu player card. Imagem de até 5 MB.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <label className="btn-secondary cursor-pointer inline-flex items-center gap-2 text-sm">
              <Camera size={16} /> {shownPhoto ? 'Trocar foto' : 'Escolher foto'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
            </label>
            {shownPhoto && (
              <button type="button" onClick={() => { setPhoto(null); setRemovePhoto(true); }}
                className="btn-ghost inline-flex items-center gap-2 text-sm text-text-muted hover:text-red">
                <Trash2 size={16} /> Remover
              </button>
            )}
          </div>
          {errors.avatar && <p className="text-red text-xs font-medium">{errors.avatar}</p>}
        </div>
      </section>

      <section className={cn(card, 'space-y-4')}>
        <h2 className={sectionTitle}>QUEM É VOCÊ</h2>
        <Field id="me-name" title="Nome social" required error={errors.name} hint="Como você quer ser chamado no app.">
          <input id="me-name" className="input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={150} />
        </Field>
        <Field id="me-legal" title="Nome completo (civil)" error={errors.legal_name} hint="Opcional. Só você e a organização veem.">
          <input id="me-legal" className="input w-full" value={form.legal_name} onChange={(e) => set('legal_name', e.target.value)} maxLength={150} autoComplete="name" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="me-nickname" title="Apelido" error={errors.nickname} hint="Opcional.">
            <input id="me-nickname" className="input w-full" value={form.nickname} onChange={(e) => set('nickname', e.target.value)} maxLength={80} />
          </Field>
          <Field id="me-gender" title="Gênero" required error={errors.gender} hint="Usado só para equilibrar os times.">
            <select id="me-gender" className="input w-full" value={form.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
              {GENDER_ORDER.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section className={cn(card, 'space-y-4')}>
        <h2 className={sectionTitle}>CONTATO</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="me-phone" title="WhatsApp" required error={errors.phone}>
            <input id="me-phone" type="tel" inputMode="tel" className="input w-full" value={form.phone} placeholder="(81) 99999-9999"
              onChange={(e) => set('phone', formatPhone(e.target.value))} autoComplete="tel" />
          </Field>
          <Field id="me-instagram" title="Instagram" error={errors.instagram} hint="Opcional.">
            <input id="me-instagram" className="input w-full" value={form.instagram} placeholder="@seuperfil"
              onChange={(e) => set('instagram', e.target.value)} maxLength={100} />
          </Field>
        </div>
      </section>

      <section className={cn(card, 'space-y-4')}>
        <h2 className={sectionTitle}>CORPO</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field id="me-age" title="Idade" error={errors.age}>
            <input id="me-age" type="number" inputMode="numeric" min={10} max={99} className="input w-full" value={form.age} onChange={(e) => set('age', e.target.value)} />
          </Field>
          <Field id="me-height" title="Altura (m)" error={errors.height}>
            <input id="me-height" inputMode="decimal" className="input w-full" value={form.height} placeholder="1,75" onChange={(e) => set('height', e.target.value)} />
          </Field>
          <Field id="me-weight" title="Peso (kg)" error={errors.weight}>
            <input id="me-weight" inputMode="decimal" className="input w-full" value={form.weight} placeholder="70" onChange={(e) => set('weight', e.target.value)} />
          </Field>
          <Field id="me-hand" title="Mão" error={errors.dominant_hand}>
            <select id="me-hand" className="input w-full" value={form.dominant_hand} onChange={(e) => set('dominant_hand', e.target.value as DominantHand)}>
              {(Object.keys(HAND_LABELS) as DominantHand[]).map((h) => <option key={h} value={h}>{HAND_LABELS[h]}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
        {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando…</> : 'Salvar alterações'}
      </button>
    </form>
  );
}

/** O que mexe no jogo ou no acesso: o atleta vê, mas quem muda é a organização. */
function StaffOnlyCard({ player }: { player: Player }) {
  const { user } = useAuth();
  const rows = [
    { label: 'E-mail de acesso', value: user?.email },
    { label: 'Posição principal', value: player.main_position_display },
    { label: 'Posição secundária', value: player.secondary_position_display || 'Nenhuma' },
    { label: 'Número da camisa', value: player.shirt_number != null ? String(player.shirt_number) : '—' },
    { label: 'Situação', value: player.status_display },
  ];
  return (
    <section className={card}>
      <div className="flex items-center gap-2">
        <Lock size={16} className="text-text-muted" />
        <h2 className={sectionTitle}>SÓ A ORGANIZAÇÃO ALTERA</h2>
      </div>
      <p className="text-xs text-text-muted mt-1 mb-3">
        Estes dados influenciam o sorteio dos times ou o seu acesso. Para mudar, fale com a organização.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-2.5 border-b border-border/30 min-w-0">
            <span className="text-text-muted text-sm shrink-0">{row.label}</span>
            <span className="text-text-primary text-sm font-medium truncate">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = current.length > 0 && next.length >= MIN_PASSWORD && next === confirm && !saving;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErrors({});
    try {
      const { data } = await api.post<{ access?: string; refresh?: string }>('/auth/change-password/', { old_password: current, new_password: next, new_password_confirm: confirm });
      // Os outros aparelhos saem; este recebe um login novo para continuar dentro
      if (data.access && data.refresh) {
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
      }
      toast.success('Senha trocada! Os outros aparelhos vão precisar entrar de novo.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err: any) {
      setErrors(apiErrors(err.response?.data, 'Não foi possível trocar a senha agora. Tente de novo.'));
    } finally {
      setSaving(false);
    }
  };

  const type = show ? 'text' : 'password';

  return (
    <form onSubmit={submit} className={cn(card, 'space-y-4')} noValidate>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-text-muted" />
          <h2 className={sectionTitle}>TROCAR SENHA</h2>
        </div>
        <button type="button" onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-red"
          aria-label={show ? 'Esconder senhas' : 'Mostrar senhas'}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />} {show ? 'Esconder' : 'Mostrar'}
        </button>
      </div>
      {errors.detail && <p className="text-red text-xs font-medium">{errors.detail}</p>}
      <Field id="pw-current" title="Senha atual" error={errors.old_password}>
        <input id="pw-current" type={type} className="input w-full" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="pw-new" title="Nova senha" error={errors.new_password ?? (tooShort ? `Pelo menos ${MIN_PASSWORD} caracteres.` : undefined)}
          hint={`Pelo menos ${MIN_PASSWORD} caracteres.`}>
          <input id="pw-new" type={type} className="input w-full" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field id="pw-confirm" title="Repita a nova senha" error={errors.new_password_confirm ?? (mismatch ? 'As senhas não são iguais.' : undefined)}>
          <input id="pw-confirm" type={type} className="input w-full" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>
      <button type="submit" disabled={!canSubmit} className="btn-secondary w-full flex items-center justify-center gap-2 disabled:opacity-50">
        {saving ? <><Loader2 size={16} className="animate-spin" /> Trocando…</> : 'Trocar senha'}
      </button>
    </form>
  );
}
