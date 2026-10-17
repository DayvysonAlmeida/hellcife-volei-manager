import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Star, Search, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar } from '@/components/ui/Avatar';
import { OverallBadge, SkillBar } from '@/components/ui/OverallBadge';
import { PositionBadge } from '@/components/ui/Badges';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { evaluationsService } from '@/services';
import { playersService } from '@/services/players';
import { useDebounce } from '@/lib/useDebounce';
import { SKILL_LABELS } from '@/types';
import type { Evaluation, Player } from '@/types';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';

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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-96 bg-red/5 blur-[120px] rounded-full pointer-events-none -z-10" />

        {/* Player list */}
        <div className={`lg:col-span-1 relative bg-surface/30 backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-lg space-y-4 ${selectedPlayer ? 'hidden lg:block' : 'block'}`}>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              placeholder="Buscar atleta..."
              value={searchPlayer}
              onChange={(e) => setSearchPlayer(e.target.value)}
              className="input-glass w-full pl-9 h-10 text-sm"
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
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left border
                    ${selectedPlayer?.id === player.id
                      ? 'bg-red/10 border-red/30 shadow-[0_0_15px_rgba(217,4,41,0.1)]'
                      : 'bg-surface/20 border-white/5 hover:bg-surface/40 hover:border-white/10'
                    }`}
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
        <div className={`lg:col-span-2 space-y-4 ${!selectedPlayer ? 'hidden lg:block' : 'block'}`}>
          {!selectedPlayer ? (
            <div className="card flex items-center justify-center py-24">
              <div className="text-center">
                <Star size={40} className="text-red mx-auto mb-4 opacity-50" />
                <p className="text-text-muted">Selecione um atleta para ver ou adicionar avaliações</p>
              </div>
            </div>
          ) : (
            <>
              {/* Player header + new evaluation button */}
              <div className="relative bg-surface/30 backdrop-blur-md border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="lg:hidden px-3 py-1.5 -ml-2 rounded-lg text-text-muted hover:bg-surface hover:text-text-primary transition-colors flex items-center gap-1 font-medium text-sm"
                  >
                    <ChevronLeft size={20} />
                    Voltar aos Atletas
                  </button>
                  <Avatar name={selectedPlayer.display_name} src={selectedPlayer.avatar_url} size="md" />
                  <div>
                    <h2 className="font-display text-xl text-text-primary tracking-wider">
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
                <div className="space-y-3">
                  {evaluations.map((eval_: Evaluation, idx: number) => (
                    <motion.div
                      key={eval_.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="relative bg-surface/30 backdrop-blur-md border border-white/5 rounded-2xl p-5 shadow-lg overflow-hidden group hover:border-white/10 transition-colors"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-red/0 via-red/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-text-primary font-medium text-sm">{formatDate(eval_.date)}</p>
                          {eval_.evaluator_name && (
                            <p className="text-text-muted text-xs">por {eval_.evaluator_name}</p>
                          )}
                        </div>
                        <OverallBadge overall={eval_.overall} size="md" showLabel />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {(Object.keys(SKILL_LABELS) as (keyof typeof SKILL_LABELS)[]).map((skill) => (
                          <div key={skill}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-text-muted">{SKILL_LABELS[skill]}</span>
                              <span className="text-text-primary font-medium">{(eval_ as unknown as Record<string, number>)[skill]?.toFixed(1)}</span>
                            </div>
                            <SkillBar value={(eval_ as unknown as Record<string, number>)[skill] || 0} />
                          </div>
                        ))}
                      </div>
                      {eval_.notes && (
                        <p className="text-text-muted text-xs mt-3 border-t border-white/10 pt-3">{eval_.notes}</p>
                      )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EvaluationForm({ playerId, initialValues, onSuccess, onCancel }: {
  playerId: number;
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
      className="relative bg-surface/40 backdrop-blur-xl border border-red/20 rounded-2xl p-6 shadow-[0_0_30px_rgba(217,4,41,0.1)] overflow-hidden"
    >
      <h3 className="font-display text-base tracking-wider text-text-primary mb-4 flex items-center gap-2">
        <Star size={14} className="text-red" />
        NOVA AVALIAÇÃO
      </h3>
      <div className="mb-4">
        <label className="text-text-muted text-xs uppercase tracking-wider">Data</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input-glass w-full mt-1 text-sm h-10"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {(Object.entries(SKILL_LABELS) as [string, string][]).map(([skill, label]) => (
          <div key={skill}>
            <div className="flex justify-between text-xs mb-1">
              <label className="text-text-muted">{label}</label>
              <span className="text-text-primary font-bold">{values[skill].toFixed(1)}</span>
            </div>
            <input
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
        className="input-glass w-full resize-none mb-4 text-sm p-3"
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
