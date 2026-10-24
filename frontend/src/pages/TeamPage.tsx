import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Search, ShieldCheck, UserCog, Volleyball } from 'lucide-react';
import api from '@/lib/api';
import { PageLoading } from '@/components/ui/Loading';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/store/AuthContext';
import { PROFILE_LABELS } from '@/lib/roles';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

type Profile = User['profile'];
interface TeamMember {
  id: number;
  name: string;
  email: string;
  profile: Profile;
  player_id: number | null;
  avatar_url: string | null;
}

const card = 'rounded-[28px] border border-border/30 bg-surface/70 p-5';
const sectionTitle = 'font-display text-lg text-text-primary tracking-wider';

const ROLES: { profile: Profile; can: string }[] = [
  { profile: 'admin', can: 'Tudo, inclusive finanças, planos, excluir atletas, partidas e circuitos, fechar a temporada, regulamento e esta tela.' },
  { profile: 'moderator', can: 'O dia a dia: circuito, presença, convidados, marcar pagamento na quadra, times, partidas, avaliações, estrelas e aprovar cadastros.' },
  { profile: 'player', can: 'O portal do atleta: check-in, Meu perfil, rankings e notificações.' },
];

const badge: Record<Profile, string> = {
  admin: 'bg-red/15 text-red border-red/30',
  moderator: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  player: 'bg-surface text-text-muted border-border/50',
};

/** Equipe (só o admin): quem é admin ou moderador, e promover ou rebaixar. */
export function TeamPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<{ member: TeamMember; profile: Profile } | null>(null);

  const { data, isLoading } = useQuery<{ staff: TeamMember[]; athletes: TeamMember[] }>({
    queryKey: ['team'],
    queryFn: () => api.get('/auth/users/team/').then((r) => r.data),
  });

  const change = useMutation({
    mutationFn: ({ member, profile }: { member: TeamMember; profile: Profile }) => api.patch(`/auth/users/${member.id}/`, { profile }),
    onSuccess: (_r, { member, profile }) => {
      toast.success(`${member.name} agora é ${PROFILE_LABELS[profile]}.`);
      qc.invalidateQueries({ queryKey: ['team'] });
    },
    onError: (err: any) => {
      const message = err.response?.data?.profile;
      toast.error(Array.isArray(message) ? message[0] : message || 'Não foi possível mudar o acesso agora.');
    },
  });

  const athletes = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = data?.athletes ?? [];
    return term ? list.filter((a) => `${a.name} ${a.email}`.toLowerCase().includes(term)) : list;
  }, [data, search]);

  if (isLoading) return <PageLoading />;

  const ask = (member: TeamMember, profile: Profile) => setPending({ member, profile });
  const staff = data?.staff ?? [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      <div>
        <h1 className="font-display text-3xl text-text-primary tracking-wider">EQUIPE</h1>
        <p className="text-sm text-text-muted">Quem organiza o clube. Só o administrador muda o acesso das pessoas.</p>
      </div>

      <section className={cn(card, 'space-y-3')}>
        <h2 className={sectionTitle}>O QUE CADA UM FAZ</h2>
        <ul className="space-y-2">
          {ROLES.map((role) => (
            <li key={role.profile} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
              <span className={cn('shrink-0 w-fit rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider', badge[role.profile])}>
                {PROFILE_LABELS[role.profile]}
              </span>
              <span className="text-sm text-text-secondary">{role.can}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={cn(card, 'space-y-3')}>
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-text-muted" />
          <h2 className={sectionTitle}>STAFF</h2>
        </div>
        <ul className="divide-y divide-border/30">
          {staff.map((member) => {
            const isMe = member.id === user?.id;
            return (
              <li key={member.id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar name={member.name} src={member.avatar_url ?? undefined} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">
                      {member.name}{isMe && <span className="text-text-muted font-normal"> (você)</span>}
                    </p>
                    <p className="text-xs text-text-muted truncate">{member.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider', badge[member.profile])}>
                    {PROFILE_LABELS[member.profile]}
                  </span>
                  {member.player_id && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-text-muted" title="Também joga: aparece nas listas e rankings">
                      <Volleyball size={12} /> joga
                    </span>
                  )}
                  {!isMe && member.profile === 'moderator' && (
                    <>
                      <button type="button" className="btn-ghost text-xs" onClick={() => ask(member, 'admin')}>Tornar admin</button>
                      <button type="button" className="btn-ghost text-xs text-text-muted" onClick={() => ask(member, 'player')}>Só atleta</button>
                    </>
                  )}
                  {!isMe && member.profile === 'admin' && (
                    <button type="button" className="btn-ghost text-xs" onClick={() => ask(member, 'moderator')}>Tornar moderador</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={cn(card, 'space-y-3')}>
        <div className="flex items-center gap-2">
          <UserCog size={18} className="text-text-muted" />
          <h2 className={sectionTitle}>PROMOVER ATLETA</h2>
        </div>
        <p className="text-xs text-text-muted">Só aparecem atletas que já têm acesso ao app. A pessoa recebe um aviso e vê o painel ao abrir o app de novo.</p>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input className="input w-full pl-9" placeholder="Buscar por nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar atleta" />
        </div>
        <ul className="divide-y divide-border/30 max-h-[420px] overflow-y-auto custom-scrollbar">
          {athletes.length === 0 && <li className="py-6 text-center text-sm text-text-muted">Nenhum atleta encontrado.</li>}
          {athletes.map((member) => (
            <li key={member.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar name={member.name} src={member.avatar_url ?? undefined} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{member.name}</p>
                  <p className="text-xs text-text-muted truncate">{member.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={() => ask(member, 'moderator')}>Tornar moderador</button>
                <button type="button" className="btn-ghost text-xs" onClick={() => ask(member, 'admin')}>Admin</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        isOpen={!!pending}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title={pending ? `Tornar ${PROFILE_LABELS[pending.profile].toLowerCase()}?` : ''}
        description={pending
          ? `${pending.member.name} passa a ter acesso de ${PROFILE_LABELS[pending.profile]}. ${ROLES.find((r) => r.profile === pending.profile)?.can ?? ''}`
          : ''}
        confirmText="Confirmar"
        isDestructive={pending?.profile === 'player'}
        onConfirm={() => { if (pending) change.mutate(pending); setPending(null); }}
      />
    </div>
  );
}
