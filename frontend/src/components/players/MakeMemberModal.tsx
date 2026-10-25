import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MailCheck, Star, X } from 'lucide-react';
import { playersService, type MakeMemberResult } from '@/services/players';
import { WelcomeShare } from './WelcomeShare';
import { GENDER_LABELS, GENDER_ORDER, POSITION_LABELS, type Gender, type Player, type Position } from '@/types';

const label = 'block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1';

/** (81) 99999-9999 enquanto digita. */
function formatPhone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`;
}

const cleanName = (name: string) => name.replace(/\s*\(Conv\. de [^)]*\)\s*$/, '').trim();

/**
 * Convidado vira membro: confere os dados, opcionalmente manda o convite por e-mail para criar a senha
 * e, no fim, deixa a mensagem de boas-vindas pronta para mandar no WhatsApp.
 */
export function MakeMemberModal({ guest, onClose }: { guest: Player | null; onClose: () => void }) {
  return (
    <Dialog.Root open={!!guest} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[94%] max-w-md max-h-[90vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-5 shadow-2xl">
          {guest && <MakeMemberForm key={guest.id} guest={guest} onClose={onClose} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MakeMemberForm({ guest, onClose }: { guest: Player; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: cleanName(guest.name),
    phone: formatPhone(guest.phone ?? ''),
    gender: guest.gender,
    main_position: guest.main_position,
    email: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<MakeMemberResult | null>(null);
  // A lista de convidados não traz o WhatsApp: busca o cadastro completo para a staff conferir o número
  const { data: detail } = useQuery({ queryKey: ['player', guest.id], queryFn: () => playersService.get(guest.id) });
  useEffect(() => {
    if (detail?.phone) setForm((f) => (f.phone ? f : { ...f, phone: formatPhone(detail.phone!) }));
  }, [detail]);

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const save = useMutation({
    mutationFn: () => playersService.makeMember(guest.id, { ...form, email: form.email.trim() || undefined }),
    onSuccess: (result) => {
      setDone(result);
      qc.invalidateQueries({ queryKey: ['players'] });
      qc.invalidateQueries({ queryKey: ['guests'] });
    },
    onError: (err: any) => {
      const data = err.response?.data ?? {};
      setErrors(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? String(v[0]) : String(v)])));
    },
  });

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-4">
        <Dialog.Title className="font-display text-2xl tracking-wider flex items-center gap-2">
          <Star size={20} className="text-yellow-500" /> {done ? 'NOVO MEMBRO!' : 'TORNAR MEMBRO'}
        </Dialog.Title>
        <Dialog.Close className="-m-1 rounded-md p-1 text-text-muted hover:text-text-primary" aria-label="Fechar"><X size={20} /></Dialog.Close>
      </div>

      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-text-primary"><strong>{form.name}</strong> agora é membro do Hellcife Vôlei. O histórico de partidas e o Elo continuam.</p>
          {done.invite_sent && (
            <p className="flex items-start gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-text-secondary">
              <MailCheck size={15} className="text-green-500 shrink-0" />
              <span>Convite enviado para <strong>{form.email}</strong>: a pessoa cria a senha pelo link (vale 3 dias).</span>
            </p>
          )}
          <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Mensagem de boas-vindas</p>
          <WelcomeShare text={done.welcome_text} whatsappUrl={done.whatsapp_url} />
          <button type="button" className="btn-ghost text-sm w-full" onClick={onClose}>Fechar</button>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }} noValidate>
          <Dialog.Description className="text-xs text-text-muted">
            Confira os dados. O nome sai sem o "(Conv. de …)" e o histórico do convidado continua.
          </Dialog.Description>
          <div>
            <label htmlFor="mm-name" className={label}>Nome social</label>
            <input id="mm-name" className="input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} />
            {errors.name && <p className="text-red text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="mm-phone" className={label}>WhatsApp *</label>
            <input id="mm-phone" type="tel" inputMode="tel" className="input w-full" value={form.phone} placeholder="(81) 99999-9999"
              onChange={(e) => set('phone', formatPhone(e.target.value))} />
            {errors.phone ? <p className="text-red text-xs mt-1">{errors.phone}</p>
              : <p className="text-[11px] text-text-muted mt-1">É com ele que a pessoa confirma presença pelo link do grupo.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="mm-gender" className={label}>Gênero</label>
              <select id="mm-gender" className="input w-full" value={form.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
                {GENDER_ORDER.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="mm-position" className={label}>Posição</label>
              <select id="mm-position" className="input w-full" value={form.main_position} onChange={(e) => set('main_position', e.target.value as Position)}>
                {(Object.keys(POSITION_LABELS) as Position[]).map((p) => <option key={p} value={p}>{POSITION_LABELS[p]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="mm-email" className={label}>E-mail (opcional)</label>
            <input id="mm-email" type="email" className="input w-full" value={form.email} placeholder="pessoa@email.com"
              onChange={(e) => set('email', e.target.value)} />
            {errors.email ? <p className="text-red text-xs mt-1">{errors.email}</p>
              : <p className="text-[11px] text-text-muted mt-1">Com e-mail, a pessoa recebe o convite para criar a senha e entrar no app.</p>}
          </div>
          {errors.detail && <p className="text-red text-xs">{errors.detail}</p>}
          <button type="submit" disabled={save.isPending} className="btn-primary w-full text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} />} Tornar membro
          </button>
        </form>
      )}
    </>
  );
}
