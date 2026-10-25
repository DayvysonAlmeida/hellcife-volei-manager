import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BellRing, CheckCircle2, Circle, IdCard, Rocket, ScrollText, Volleyball, X } from 'lucide-react';
import { useMyAthlete } from '@/hooks/useMyAthlete';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'complete_data', label: 'Complete seus dados (CPF e WhatsApp)', to: '/athlete/profile/edit', icon: IdCard },
  { key: 'notifications', label: 'Ative as notificações no celular', to: '/athlete/notifications#celular', icon: BellRing },
  { key: 'regulation', label: 'Leia o regulamento', to: '/athlete/regulation', icon: ScrollText },
  { key: 'first_checkin', label: 'Confirme presença no próximo circuito', to: '/athlete/checkin', icon: Volleyball },
] as const;

/** "Comece por aqui": os primeiros passos do membro novo, marcados conforme ele faz. */
export function OnboardingCard() {
  const qc = useQueryClient();
  const { data: athlete } = useMyAthlete();
  const steps = athlete?.onboarding;
  const dismiss = useMutation({
    mutationFn: () => api.post('/players/me/dismiss-onboarding/'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['athlete-me'] }),
  });
  if (!steps) return null;

  const doneCount = STEPS.filter((s) => steps[s.key]).length;
  return (
    <section className="rounded-[28px] border border-yellow-500/30 bg-yellow-500/[0.06] p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg tracking-wider text-text-primary flex items-center gap-2">
            <Rocket size={18} className="text-yellow-500" /> COMECE POR AQUI
          </h2>
          <p className="text-xs text-text-muted">Bem-vindo(a) ao Hellcife Vôlei! {doneCount} de {STEPS.length} feitos.</p>
        </div>
        <button type="button" onClick={() => dismiss.mutate()} aria-label="Dispensar o Comece por aqui"
          className="shrink-0 rounded-lg p-1 text-text-muted hover:text-text-primary"><X size={18} /></button>
      </div>
      <div className="h-1.5 rounded-full bg-surface-highlight overflow-hidden">
        <div className="h-full rounded-full bg-yellow-500 transition-all" style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {STEPS.map((step) => {
          const done = steps[step.key];
          return (
            <li key={step.key}>
              <Link to={step.to} className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                done ? 'border-green-500/30 bg-green-500/5 text-text-muted' : 'border-border/50 bg-surface/60 text-text-primary hover:border-yellow-500/50',
              )}>
                <step.icon size={16} className={done ? 'text-green-500' : 'text-yellow-500'} />
                <span className={cn('flex-1', done && 'line-through')}>{step.label}</span>
                {done ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-text-muted" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
