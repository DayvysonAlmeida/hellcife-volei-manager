import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Shuffle, Zap, Save, RefreshCw, Users, Send, Trash2, ArrowRightLeft, Trophy, Lock, History } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { OverallBadge } from '@/components/ui/OverallBadge';
import { PositionBadge } from '@/components/ui/Badges';
import { PageLoading } from '@/components/ui/Loading';
import { teamsService, attendanceService } from '@/services';
import { MODALITY_LABELS } from '@/types';
import type { GenerateTeamsResult, GeneratedTeam, Modality } from '@/types';
import { useAuth } from '@/store/AuthContext';
import { formatDate } from '@/lib/utils';

const MODALITIES: Modality[] = [2, 3, 4, 5, 6];

export function TeamsPage() {
  const { user } = useAuth();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';

  const qc = useQueryClient();

  const [modality, setModality] = useState<Modality>(6);
  const [selectedGameDayId, setSelectedGameDayId] = useState<number | null>(null);
  const [result, setResult] = useState<GenerateTeamsResult | null>(null);
  const [saving, setSaving] = useState(false);

  const deleteGenMutation = useMutation({
    mutationFn: (id: number) => teamsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-generations-history'] });
      toast.success('Geração excluída!');
    },
  });

  const movePlayerMutation = useMutation({
    mutationFn: ({ genId, playerId, targetTeamId }: { genId: number, playerId: number, targetTeamId: number }) => 
       teamsService.movePlayer(genId, playerId, targetTeamId),
    onSuccess: () => {
       qc.invalidateQueries({ queryKey: ['team-generations-history'] });
       toast.success('Jogador transferido com sucesso!');
    }
  });

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
    mutationFn: () => {
      if (!selectedGameDayId) {
        toast.error('Selecione um Dia de Jogo para poder salvar os times!');
        return Promise.reject(new Error('No gameday selected'));
      }
      if (!result) {
        return Promise.reject(new Error('No result to save'));
      }
      return teamsService.saveGenerated({
        modality,
        gameday_id: selectedGameDayId,
        result: result,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-generations-history'] });
      toast.success('Times salvos com sucesso no histórico!');
    },
  });

  const handleShareWhatsApp = () => {
    if (!result) return;
    
    let text = `🏆 *TIMES GERADOS - HELLCIFE VÔLEI* 🏆\n\n`;
    text += `Modalidade: ${modality}v${modality}\n`;
    text += `Balanceamento: ${(10 - result.balance_score * 10).toFixed(1)}%\n\n`;

    result.teams.forEach((team) => {
      text += `*${team.name.toUpperCase()}* (Overall: ${team.avg_overall.toFixed(1)})\n`;
      team.players.forEach((p, idx) => {
        const posStr = p.main_position.charAt(0).toUpperCase() + p.main_position.slice(1);
        text += `${idx + 1}. ${p.display_name} (${posStr})\n`;
      });
      text += '\n';
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

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

  const { data: historyData } = useQuery({
    queryKey: ['team-generations-history'],
    queryFn: () => teamsService.list(),
  });
  const history = historyData?.results || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Peladas</h1>
        <p className="page-subtitle">Sorteio e histórico de times da sua pelada.</p>
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
              className="input w-full"
              value={selectedGameDayId || ''}
              onChange={(e) => setSelectedGameDayId(Number(e.target.value) || null)}
            >
              <option value="">Selecione uma pelada</option>
              {gameDays.map(gd => (
                <option key={gd.id} value={gd.id}>
                  {formatDate(gd.date)} {gd.time ? `- ${gd.time.slice(0, 5)}` : ''} ({gd.total_present} confirmados) {gd.location ? `- ${gd.location}` : ''}
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
            <>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="btn-secondary flex items-center gap-2"
              >
                <Save size={16} />
                Salvar times
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="btn-ghost flex items-center gap-2"
              >
                <Send size={16} className="text-green-500" />
                Compartilhar no WhatsApp
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {generateMutation.isError && (
        <div className="card p-4 border-red/20 text-red text-sm">
          {(generateMutation.error as any)?.response?.data?.detail || 'Erro ao gerar times. Verifique se há atletas suficientes para a modalidade escolhida.'}
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
      
      {/* History */}
      {history.length > 0 && (
        <div className="mt-12 space-y-6 pt-8 border-t border-border">
          <h2 className="font-display text-2xl tracking-wider text-text-primary uppercase flex items-center gap-2">
            <Shuffle className="text-red" />
            Histórico de Gerações
          </h2>
          <div className="space-y-6">
            {history.map(gen => (
              <div key={gen.id} className="card p-5 border-l-2 border-red">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-medium text-text-primary text-lg flex items-center gap-2">
                      {gen.modality_display} — {gen.gameday ? `${formatDate(gen.gameday_date || '')} ${gen.gameday_location ? `(${gen.gameday_location})` : ''}` : 'Avulso'}
                      {gen.is_locked && (
                        <span title="Pelada Encerrada" className="text-red/70 flex items-center bg-red/10 px-2 py-0.5 rounded-full text-xs gap-1">
                          <Lock size={12} />
                          Encerrada
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-text-muted mt-0.5">
                      Gerado em {formatDate(gen.created_at)} por {gen.created_by_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs text-text-muted uppercase tracking-wider block">Balanceamento</span>
                      <span className="text-green-400 font-bold text-lg">{(10 - (gen.balance_score || 0) * 10).toFixed(1)}%</span>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-2 border-l border-border pl-3">
                        <button
                          onClick={() => {
                            if (confirm('Tem certeza que deseja excluir esta geração de times?')) {
                              deleteGenMutation.mutate(gen.id);
                            }
                          }}
                          disabled={deleteGenMutation.isPending}
                          className="btn-ghost p-1.5 hover:bg-red/10 hover:text-red rounded-lg transition-colors text-text-muted"
                          title="Excluir Geração"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Generated Teams Mini-grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {gen.teams.map(team => (
                    <div key={team.id} className="bg-surface rounded-lg p-3 border border-border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-display text-sm" style={{ color: team.color_hex }}>{team.name.toUpperCase()}</span>
                        <span className="font-bold text-xs" style={{ color: team.color_hex }}>{team.avg_overall.toFixed(1)}</span>
                      </div>
                      <div className="space-y-1">
                        {team.team_players.map(p => (
                          <div key={p.id} className="flex justify-between items-center text-xs group">
                            <span className="text-text-secondary truncate pr-2">{p.player_name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-text-muted">{p.player_overall}</span>
                              {canEdit && !gen.is_locked && (
                                <div className="relative">
                                  <select 
                                    className="opacity-100 md:opacity-0 focus:opacity-100 md:group-hover:opacity-100 transition-opacity bg-surface border border-border rounded text-[10px] text-text-primary h-5 pr-4 pl-1 outline-none cursor-pointer appearance-none"
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        movePlayerMutation.mutate({ genId: gen.id, playerId: p.player, targetTeamId: Number(e.target.value) });
                                        e.target.value = '';
                                      }
                                    }}
                                    disabled={movePlayerMutation.isPending}
                                    title="Mover para outro time"
                                  >
                                    <option value="">⇄ Mover</option>
                                    {gen.teams.filter(t => t.id !== team.id).map(t => (
                                      <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                  </select>
                                  <div className="absolute inset-0 pointer-events-none opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center bg-surface border border-border-subtle rounded group-hover:bg-blue/10 group-hover:border-blue/30 group-hover:text-blue text-text-muted">
                                    <ArrowRightLeft size={10} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {canEdit && (
                  <div className="mt-6 pt-4 border-t border-border flex justify-end">
                    <Link
                      to={`/bracket/${gen.id}`}
                      className={`px-6 py-3 flex items-center gap-2 w-full sm:w-auto justify-center ${gen.is_locked ? 'btn-secondary text-text-secondary border border-border bg-surface/50 hover:bg-surface' : 'btn-primary'}`}
                    >
                      {gen.is_locked ? <History size={18} /> : <Trophy size={18} />}
                      {gen.is_locked ? 'Ver Histórico da Pelada' : 'Abrir Placar / Chaveamento'}
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
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
