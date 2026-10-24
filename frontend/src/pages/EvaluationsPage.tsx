import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Star, Search, ChevronLeft, ChevronDown, ArrowUp, ArrowDown, PenLine, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar } from '@/components/ui/Avatar';
import { AuthorChip } from '@/components/ui/AuthorChip';
import { OverallBadge, SkillBar } from '@/components/ui/OverallBadge';
import { PositionBadge } from '@/components/ui/Badges';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { evaluationsService } from '@/services';
import { playersService } from '@/services/players';
import { useDebounce } from '@/lib/useDebounce';
import { SKILL_LABELS } from '@/types';
import type { Evaluation, EvaluationSkills, Player } from '@/types';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';

const panel = 'relative bg-surface/70 border border-border/40 rounded-2xl shadow-sm';
const SKILLS = Object.keys(SKILL_LABELS) as (keyof EvaluationSkills)[];

/** Diferença para a avaliação anterior: ↑ verde, ↓ vermelho; nada quando não mudou. */
function Delta({ value, className }: { value?: number; className?: string }) {
  if (value == null || Math.abs(value) < 0.05) return null;
  const up = value > 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums', up ? 'text-green-600 dark:text-green-400' : 'text-red', className)}
      title={`${up ? '+' : ''}${value.toFixed(1)} em relação à avaliação anterior`}>
      {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(value).toFixed(1)}
    </span>
  );
}

/** Quem avaliou, quando foi registrada e, se mudou depois, quem editou. */
function Authorship({ evaluation }: { evaluation: Evaluation }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <AuthorChip label="Avaliado por" name={evaluation.evaluator_name} profile={evaluation.evaluator_profile} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-8">
        <span className="text-[11px] text-text-muted">Registrada em {formatDateTime(evaluation.created_at)}</span>
        {evaluation.last_edit && (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
            <PenLine size={11} /> Editada{evaluation.last_edit.by ? ` por ${evaluation.last_edit.by}` : ''} em {formatDateTime(evaluation.last_edit.at)}
          </span>
        )}
      </div>
    </div>
  );
}

function EvaluationDetail({ evaluation, previous }: { evaluation: Evaluation; previous?: Evaluation }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {SKILLS.map((skill) => {
          const value = evaluation[skill] ?? 0;
          return (
            <div key={skill}>
              <div className="flex items-center justify-between gap-2 text-xs mb-1">
                <span className="text-text-muted">{SKILL_LABELS[skill]}</span>
                <span className="flex items-center gap-1.5">
                  <Delta value={previous ? value - (previous[skill] ?? 0) : undefined} />
                  <span className="text-text-primary font-bold tabular-nums">{value.toFixed(1)}</span>
                </span>
              </div>
              <SkillBar value={value} />
            </div>
          );
        })}
      </div>
      {evaluation.notes && (
        <p className="text-text-secondary text-xs mt-4 border-t border-border/40 pt-3 whitespace-pre-line">{evaluation.notes}</p>
      )}
    </>
  );
}

function EvaluationHistory({ evaluations }: { evaluations: Evaluation[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [current, ...older] = evaluations;

  return (
    <div className="space-y-4">
      {/* Avaliação atual: completa */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn(panel, 'p-5 space-y-4 border-red/25')}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="inline-block rounded-full bg-red/10 text-red border border-red/30 px-2 py-px text-[10px] font-black uppercase tracking-wider">Avaliação atual</span>
            <p className="font-display text-xl text-text-primary tracking-wide">{formatDate(current.date)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <OverallBadge overall={current.overall} size="md" showLabel />
            <Delta value={older[0] ? current.overall - older[0].overall : undefined} className="text-xs" />
          </div>
        </div>
        <div className="rounded-xl bg-text-primary/[0.03] border border-border/40 px-3 py-2.5">
          <Authorship evaluation={current} />
        </div>
        <EvaluationDetail evaluation={current} previous={older[0]} />
      </motion.section>

      {/* Anteriores: resumidas, abrem com um toque */}
      {older.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-text-muted px-1">Avaliações anteriores ({older.length})</h3>
          {older.map((evaluation, idx) => {
            const isOpen = open === evaluation.id;
            const previous = older[idx + 1];
            return (
              <div key={evaluation.id} className={cn(panel, 'overflow-hidden')}>
                <button type="button" onClick={() => setOpen(isOpen ? null : evaluation.id)} aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-text-primary/[0.03] transition-colors">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-bold text-text-primary">{formatDate(evaluation.date)}</p>
                    <AuthorChip label="por" name={evaluation.evaluator_name} profile={evaluation.evaluator_profile} />
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <OverallBadge overall={evaluation.overall} size="sm" />
                    <Delta value={previous ? evaluation.overall - previous.overall : undefined} />
                  </div>
                  <ChevronDown size={16} className={cn('text-text-muted transition-transform shrink-0', isOpen && 'rotate-180')} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-4 border-t border-border/40 pt-4">
                        <Authorship evaluation={evaluation} />
                        <EvaluationDetail evaluation={evaluation} previous={previous} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

export function EvaluationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchPlayer, setSearchPlayer] = useState('');

  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';

  // Debounce na busca de atletas
  const debouncedSearch = useDebounce(searchPlayer, 300);

  const { data: playersData, isLoading: loadingPlayers } = useQuery({
    queryKey: ['players', debouncedSearch, 'active-for-eval'],
    queryFn: () => playersService.list({
      search: debouncedSearch || undefined,
      status: 'active',
      page_size: 500,  // Lista auxiliar — busca todos os atletas ativos de uma vez
      include_guests: 'true', // Permitir avaliar convidados
    }),
  });

  const { data: evaluations, isLoading: loadingEvals } = useQuery({
    queryKey: ['player-evaluations', selectedPlayer?.id],
    queryFn: () => evaluationsService.byPlayer(selectedPlayer!.id),
    enabled: !!selectedPlayer,
  });

  const players = playersData?.results || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Avaliações</h1>
        <p className="page-subtitle">Avaliação técnica e acompanhamento de desempenho dos atletas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
        {/* Player list */}
        <div className={cn(panel, 'lg:col-span-1 p-4 space-y-4', selectedPlayer ? 'hidden lg:block' : 'block')}>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              placeholder="Buscar atleta..."
              value={searchPlayer}
              onChange={(e) => setSearchPlayer(e.target.value)}
              className="input w-full pl-9 h-10 text-sm"
              aria-label="Buscar atleta"
            />
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
            {loadingPlayers ? (
              <p className="text-text-muted text-sm text-center py-4">Carregando...</p>
            ) : players.length === 0 ? (
              <EmptyState message="Nenhum atleta ativo." icon="🏐" />
            ) : (
              players.map((player) => (
                <button
                  key={player.id}
                  onClick={() => { setSelectedPlayer(player); setShowForm(false); }}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left border',
                    selectedPlayer?.id === player.id
                      ? 'bg-red/10 border-red/30'
                      : 'bg-transparent border-border/30 hover:bg-text-primary/[0.04] hover:border-border/60',
                  )}
                >
                  <Avatar name={player.display_name} src={player.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-sm font-medium truncate">{player.display_name}</p>
                    <PositionBadge position={player.main_position} />
                  </div>
                  <OverallBadge overall={player.latest_overall} size="sm" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Evaluation detail / form */}
        <div className={cn('lg:col-span-2 space-y-4', !selectedPlayer ? 'hidden lg:block' : 'block')}>
          {!selectedPlayer ? (
            <div className={cn(panel, 'flex items-center justify-center py-24')}>
              <div className="text-center">
                <Star size={40} className="text-red mx-auto mb-4 opacity-50" />
                <p className="text-text-muted">Selecione um atleta para ver ou adicionar avaliações</p>
              </div>
            </div>
          ) : (
            <>
              {/* Player header + new evaluation button */}
              <div className={cn(panel, 'p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4')}>
                <div className="flex items-center gap-4 min-w-0">
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="lg:hidden px-2 py-1.5 -ml-2 rounded-lg text-text-muted hover:bg-surface hover:text-text-primary transition-colors flex items-center gap-1 font-medium text-sm"
                    aria-label="Voltar aos atletas"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <Avatar name={selectedPlayer.display_name} src={selectedPlayer.avatar_url} size="md" />
                  <div className="min-w-0">
                    <h2 className="font-display text-xl text-text-primary tracking-wider truncate">
                      {selectedPlayer.display_name.toUpperCase()}
                    </h2>
                    <PositionBadge position={selectedPlayer.main_position} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <OverallBadge overall={selectedPlayer.latest_overall} size="md" showLabel />
                  {canEdit && (
                    <button
                      onClick={() => setShowForm(!showForm)}
                      className="btn-primary text-sm flex items-center gap-1"
                    >
                      <Plus size={14} />
                      Nova avaliação
                    </button>
                  )}
                </div>
              </div>

              {/* Evaluation form */}
              {showForm && canEdit && (
                <EvaluationForm
                  playerId={selectedPlayer.id}
                  evaluatorName={user?.name ?? ''}
                  initialValues={evaluations?.[0] as Record<string, number> | undefined}
                  onSuccess={() => {
                    setShowForm(false);
                    qc.invalidateQueries({ queryKey: ['player-evaluations', selectedPlayer.id] });
                    qc.invalidateQueries({ queryKey: ['player-radar', selectedPlayer.id] });
                    qc.invalidateQueries({ queryKey: ['players'] });
                  }}
                  onCancel={() => setShowForm(false)}
                />
              )}

              {/* Evaluation history */}
              {loadingEvals ? (
                <PageLoading />
              ) : !evaluations || evaluations.length === 0 ? (
                <EmptyState message="Nenhuma avaliação registrada para este atleta." icon="📊" />
              ) : (
                <EvaluationHistory evaluations={evaluations} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EvaluationForm({ playerId, evaluatorName, initialValues, onSuccess, onCancel }: {
  playerId: number;
  evaluatorName: string;
  initialValues?: Record<string, number>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    if (initialValues) {
      return Object.fromEntries(Object.keys(SKILL_LABELS).map(k => [k, initialValues[k] || 5]));
    }
    return Object.fromEntries(Object.keys(SKILL_LABELS).map(k => [k, 5]));
  });
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () => evaluationsService.create({
      player: playerId as unknown as number,
      date,
      notes,
      ...values,
    } as unknown as Partial<Evaluation>),
    onSuccess: () => {
      toast.success('Avaliação salva com sucesso!');
      onSuccess();
    },
    onError: () => {
      toast.error('Erro ao salvar a avaliação.');
    }
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(panel, 'p-6 border-red/30')}
    >
      <h3 className="font-display text-base tracking-wider text-text-primary mb-2 flex items-center gap-2">
        <Star size={14} className="text-red" />
        NOVA AVALIAÇÃO
      </h3>
      <p className="mb-4 flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/25 px-3 py-2 text-xs text-text-secondary">
        <ShieldCheck size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
        <span>Esta avaliação fica registrada em seu nome{evaluatorName ? <> (<strong className="text-text-primary">{evaluatorName}</strong>)</> : ''}.</span>
      </p>
      <div className="mb-4">
        <label htmlFor="evaluation-date" className="text-text-muted text-xs uppercase tracking-wider">Data</label>
        <input
          id="evaluation-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input w-full mt-1 text-sm h-10"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {(Object.entries(SKILL_LABELS) as [string, string][]).map(([skill, label]) => (
          <div key={skill}>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor={`skill-${skill}`} className="text-text-muted">{label}</label>
              <span className="text-text-primary font-bold tabular-nums">{values[skill].toFixed(1)}</span>
            </div>
            <input
              id={`skill-${skill}`}
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={values[skill]}
              onChange={(e) => setValues(v => ({ ...v, [skill]: parseFloat(e.target.value) }))}
              className="w-full accent-red h-1.5"
            />
          </div>
        ))}
      </div>
      <textarea
        placeholder="Observações (opcional)..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="input w-full resize-none mb-4 text-sm p-3"
        aria-label="Observações"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-secondary text-sm">Cancelar</button>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="btn-primary text-sm flex items-center gap-1"
        >
          {mutation.isPending && <Star size={12} className="animate-spin" />}
          Salvar avaliação
        </button>
      </div>
    </motion.div>
  );
}
