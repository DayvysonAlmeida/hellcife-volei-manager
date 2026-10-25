import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Link2, Loader2, MailWarning, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { signupService, type PendingSignup, type SignupCandidate } from '@/services/signup';

/** Atletas sem acesso com alguma palavra do nome do cadastro aparecem primeiro na lista. */
function sortCandidates(candidates: SignupCandidate[], signup: PendingSignup) {
  const words = `${signup.name} ${signup.legal_name}`.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const score = (c: SignupCandidate) => words.some((w) => `${c.name} ${c.nickname ?? ''}`.toLowerCase().includes(w)) ? 0 : 1;
  return [...candidates].sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}

function SignupCard({ signup, candidates }: { signup: PendingSignup; candidates: SignupCandidate[] }) {
  const qc = useQueryClient();
  // Membro antigo sem conta pedindo acesso: o "É o atleta X" já vem marcado
  const [linkTo, setLinkTo] = useState(signup.claims_player ? String(signup.claims_player) : '');
  const [confirmReject, setConfirmReject] = useState(false);
  const done = (message: string) => {
    toast.success(message);
    qc.invalidateQueries({ queryKey: ['pending-signups'] });
    qc.invalidateQueries({ queryKey: ['signup-candidates'] });
    qc.invalidateQueries({ queryKey: ['players'] });
  };
  const fail = (err: any) => toast.error(err.response?.data?.detail || 'Não foi possível concluir. Tente de novo.');

  const approve = useMutation({
    mutationFn: (playerId?: number) => signupService.approve(signup.id, playerId),
    onSuccess: (r) => done(r.detail),
    onError: fail,
  });
  const reject = useMutation({ mutationFn: () => signupService.reject(signup.id), onSuccess: () => done('Cadastro recusado.'), onError: fail });
  const busy = approve.isPending || reject.isPending;
  const phone = signup.phone ? signup.phone.replace(/\D/g, '') : '';
  // (81) 98888-7777
  const phoneLabel = phone.length >= 10 ? `(${phone.slice(0, 2)}) ${phone.slice(2, -4)}-${phone.slice(-4)}` : phone;
  const extras = [
    signup.age && `${signup.age} anos`,
    signup.height && `${String(signup.height).replace('.', ',')} m`,
    signup.instagram && `@${signup.instagram}`,
    signup.secondary_position_display && `também ${signup.secondary_position_display}`,
  ].filter(Boolean);

  return (
    <li className="rounded-xl border border-border bg-surface/50 p-3 sm:p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar name={signup.name} src={signup.avatar_url ?? undefined} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-text-primary">{signup.name}</p>
            <PositionBadge position={signup.main_position} />
            {!signup.email_confirmed && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded px-1.5 py-0.5">
                <MailWarning size={11} /> E-mail não confirmado
              </span>
            )}
          </div>
          {signup.legal_name && <p className="text-xs text-text-secondary">Nome civil: {signup.legal_name}</p>}
          <p className="text-xs text-text-muted break-all">
            {signup.email}
            {phone && <> · <a href={`https://wa.me/55${phone}`} target="_blank" rel="noreferrer" className="underline whitespace-nowrap">WhatsApp {phoneLabel}</a></>}
          </p>
          <p className="text-xs text-text-muted">
            {signup.gender_display}{extras.length > 0 && ` · ${extras.join(' · ')}`} · cadastro em {new Date(signup.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {signup.claims_player_name && (
        <p className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-text-primary">
          Parece ser <strong>{signup.claims_player_name}</strong>, que já é membro e ainda não tinha conta. Já deixamos marcado para ligar a conta a esse cadastro.
        </p>
      )}

      {/* Possível cadastro repetido: a staff confere antes de aprovar (ou liga ao atleta que já existe) */}
      {signup.duplicates?.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-text-primary">
          <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-px" />
          <div>
            <p className="font-bold">Pode ser cadastro repetido</p>
            <ul className="text-text-secondary">{signup.duplicates.map((d) => <li key={d}>{d}</li>)}</ul>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" disabled={busy} onClick={() => approve.mutate(undefined)} className="btn-primary text-xs justify-center inline-flex items-center gap-1.5">
          {approve.isPending && !linkTo ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} Aprovar como novo atleta
        </button>
        <div className="flex gap-2 flex-1 min-w-0">
          <select
            value={linkTo}
            onChange={(e) => setLinkTo(e.target.value)}
            className="input text-xs py-1.5 flex-1 min-w-0"
            aria-label={`Ligar ${signup.name} a um atleta que já existe`}
          >
            <option value="">É um atleta que já existe…</option>
            {sortCandidates(candidates, signup).map((c) => (
              <option key={c.id} value={c.id}>{c.nickname ? `${c.nickname} (${c.name})` : c.name}</option>
            ))}
          </select>
          <button type="button" disabled={busy || !linkTo} onClick={() => approve.mutate(Number(linkTo))}
            className="btn-secondary text-xs inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50">
            <Link2 size={13} /> Vincular
          </button>
        </div>
        {confirmReject ? (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => reject.mutate()} className="btn-ghost text-xs text-red inline-flex items-center gap-1">
              <Check size={13} /> Confirmar recusa
            </button>
            <button type="button" onClick={() => setConfirmReject(false)} className="btn-ghost text-xs" aria-label="Cancelar recusa"><X size={13} /></button>
          </div>
        ) : (
          <button type="button" disabled={busy} onClick={() => setConfirmReject(true)} className="btn-ghost text-xs text-text-muted hover:text-red">
            Recusar
          </button>
        )}
      </div>
    </li>
  );
}

/** Cadastros feitos pelo app esperando a staff (só aparece quando há algum). */
export function PendingSignups({ highlight }: { highlight?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { data: signups = [] } = useQuery({ queryKey: ['pending-signups'], queryFn: signupService.pending });
  const { data: candidates = [] } = useQuery({
    queryKey: ['signup-candidates'],
    queryFn: signupService.candidates,
    enabled: signups.length > 0,
  });

  // Veio do aviso "Novo cadastro": leva direto para a lista
  useEffect(() => {
    if (highlight && signups.length) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [highlight, signups.length]);

  if (signups.length === 0) return null;
  return (
    <section ref={ref} className="card p-4 sm:p-5 border border-yellow-500/30 space-y-3" aria-labelledby="pending-signups-title">
      <div>
        <h2 id="pending-signups-title" className="font-display text-xl text-text-primary tracking-wider">
          CADASTROS PENDENTES <span className="text-yellow-500">({signups.length})</span>
        </h2>
        <p className="text-xs text-text-muted">
          Pessoas que se cadastraram pelo app. Aprove como atleta novo ou, se a pessoa já joga com vocês, ligue a conta ao atleta que já existe.
        </p>
      </div>
      <ul className="space-y-2">
        {signups.map((s) => <SignupCard key={s.id} signup={s} candidates={candidates} />)}
      </ul>
    </section>
  );
}
