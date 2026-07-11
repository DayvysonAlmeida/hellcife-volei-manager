import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, Zap, Save, RefreshCw, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { OverallBadge } from '@/components/ui/OverallBadge';
import { PositionBadge } from '@/components/ui/Badges';
import { PageLoading } from '@/components/ui/Loading';
import { teamsService, attendanceService } from '@/services';
import { MODALITY_LABELS } from '@/types';
import type { GenerateTeamsResult, GeneratedTeam, Modality } from '@/types';
import { useAuth } from '@/store/AuthContext';

const MODALITIES: Modality[] = [2, 3, 4, 5, 6];

export function TeamsPage() {
  const { user } = useAuth();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';

  const [modality, setModality] = useState<Modality>(6);
  const [selectedGameDayId, setSelectedGameDayId] = useState<number | null>(null);
  const [result, setResult] = useState<GenerateTeamsResult | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: gameDaysData } = useQuery({
    queryKey: ['gamedays'],
    queryFn: () => attendanceService.listGameDays(),
  });

  const gameDays = gameDaysData?.results || [];

  const generateMutation = useMutation({
    mutationFn: () => teamsService.generate({
      modality,
      gameday_id: selectedGameDayId || undefined,
      save: false,
    }),
    onSuccess: (data) => setResult(data),
  });

  const saveMutation = useMutation({
    mutationFn: () => teamsService.generate({
      modality,
      gameday_id: selectedGameDayId || undefined,
      save: true,
    }),
    onSuccess: () => {
      setSaving(false);
      alert('Times salvos com sucesso!');
    },
  });

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">Gerador de Times</h1>
        <div className="card p-8 text-center">
          <Shuffle size={48} className="text-red mx-auto mb-4 opacity-50" />
          <p className="text-text-muted">Apenas administradores e moderadores podem gerar times.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Gerador de Times</h1>
        <p className="page-subtitle">Gere equipes balanceadas automaticamente com base no Overall dos atletas.</p>
      </div>

      {/* Config */}
      <div className="card p-6">
        <h2 className="font-display text-base tracking-wider text-text-primary mb-4">CONFIGURAÇÃO</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Modality */}
          <div>
            <label className="text-text-muted text-xs uppercase tracking-wider block mb-2">Modalidade</label>
            <div className="flex gap-2 flex-wrap">
              {MODALITIES.map((m) => (
                <button
                  key={m}
                  onClick={() => setModality(m)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all
                    ${modality === m
                      ? 'bg-red text-white shadow-neon-red-sm'
                      : 'bg-surface border border-border text-text-muted hover:border-border-subtle'
                    }`}
                >
                  {m}v{m}
                </button>
              ))}
            </div>
          </div>

          {/* Game day */}
          <div>
            <label className="text-text-muted text-xs uppercase tracking-wider block mb-2">
              Dia de jogo (filtra presentes)
            </label>
            <select
              value={selectedGameDayId || ''}
              onChange={(e) => setSelectedGameDayId(e.target.value ? Number(e.target.value) : null)}
              className="input w-full"
            >
              <option value="">Todos os atletas ativos</option>
              {gameDays.map((gd) => (
                <option key={gd.id} value={gd.id}>
                  {gd.date} — {gd.total_present} presentes
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {generateMutation.isPending ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Zap size={16} />
            )}
            {result ? 'Regerar times' : 'Gerar times'}
          </button>
          {result && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="btn-secondary flex items-center gap-2"
            >
              <Save size={16} />
              Salvar times
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {generateMutation.isError && (
        <div className="card p-4 border-red/20 text-red text-sm">
          Erro ao gerar times. Verifique se há atletas suficientes para a modalidade escolhida.
        </div>
      )}

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={JSON.stringify(result)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Summary */}
            <div className="card p-4 flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-red" />
                <span className="text-text-secondary text-sm">{result.total_players} atletas</span>
              </div>
              <div className="flex items-center gap-2">
                <Shuffle size={16} className="text-blue" />
                <span className="text-text-secondary text-sm">{result.n_teams} times</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-sm">
                  Balanceamento: <span className="text-green-400 font-bold">{(10 - result.balance_score * 10).toFixed(1)}%</span>
                </span>
              </div>
            </div>

            {/* Teams grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.teams.map((team, idx) => (
                <TeamCard key={team.order} team={team} idx={idx} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TeamCard({ team, idx }: { team: GeneratedTeam; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.1 }}
      className="card overflow-hidden"
    >
      {/* Color accent */}
      <div className="h-1.5" style={{ backgroundColor: team.color_hex }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg tracking-wider" style={{ color: team.color_hex }}>
            {team.name.toUpperCase()}
          </h3>
          <div className="text-right">
            <p className="font-display text-xl font-bold" style={{ color: team.color_hex }}>
              {team.avg_overall.toFixed(1)}
            </p>
            <p className="text-text-muted text-[10px] uppercase">Overall médio</p>
          </div>
        </div>

        <div className="space-y-2">
          {team.players.map((player, i) => (
            <div key={player.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface">
              <span className="text-text-muted text-xs w-4">{i + 1}</span>
              <Avatar name={player.display_name} src={player.avatar_url} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-text-primary text-xs font-medium truncate">{player.display_name}</p>
                <PositionBadge position={player.main_position} />
              </div>
              <OverallBadge overall={player.overall} size="sm" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
