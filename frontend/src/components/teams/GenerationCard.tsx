import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Trash2, Lock, UserCheck, Zap, Loader2, Shuffle, Plus, X, ArrowRightLeft, Trophy, History, Swords, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { teamsService } from '@/services';
import { formatDate } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';

export function GenerationCard({ gen, gameDays, allPlayers, canEdit, onConfirmDialog }: { 
  gen: any; 
  gameDays: any[]; 
  allPlayers: any[]; 
  canEdit: boolean;
  onConfirmDialog: (config: any) => void;
}) {
  const qc = useQueryClient();

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

  const addPlayerMutation = useMutation({
    mutationFn: ({ genId, playerId, teamId }: { genId: number, playerId: number, teamId: number }) => 
       teamsService.addPlayer(genId, playerId, teamId),
    onSuccess: () => {
       qc.invalidateQueries({ queryKey: ['team-generations-history'] });
       toast.success('Jogador adicionado ao time!');
    }
  });

  const removePlayerMutation = useMutation({
    mutationFn: ({ genId, playerId }: { genId: number, playerId: number }) => 
       teamsService.removePlayer(genId, playerId),
    onSuccess: () => {
       qc.invalidateQueries({ queryKey: ['team-generations-history'] });
       toast.success('Jogador removido do time!');
    }
  });

  const addTeamMutation = useMutation({
    mutationFn: (genId: number) => teamsService.addTeam(genId),
    onSuccess: () => {
       qc.invalidateQueries({ queryKey: ['team-generations-history'] });
       toast.success('Novo time vazio adicionado!');
    }
  });

  const removeTeamMutation = useMutation({
    mutationFn: ({ genId, teamId }: { genId: number, teamId: number }) => teamsService.removeTeam(genId, teamId),
    onSuccess: () => {
       qc.invalidateQueries({ queryKey: ['team-generations-history'] });
       toast.success('Time removido com sucesso!');
    }
  });

  const autoAllocateMutation = useMutation({
    mutationFn: (genId: number) => teamsService.autoAllocate(genId),
    onSuccess: (res) => {
       qc.invalidateQueries({ queryKey: ['team-generations-history'] });
       toast.success(res.detail || 'Jogadores alocados com sucesso!');
    }
  });

  const shuffleMutation = useMutation({
    mutationFn: (genId: number) => teamsService.shuffle(genId),
    onSuccess: (res) => {
       qc.invalidateQueries({ queryKey: ['team-generations-history'] });
       toast.success(res.detail || 'Times embaralhados com sucesso!');
    }
  });

  const checkinCount = gameDays.find((gd: any) => gd.id === gen.gameday)?.total_court_checkins || 0;
  const playersInGen = gen.teams.reduce((acc: number, t: any) => acc + t.team_players.length, 0);
  const unassignedCount = Math.max(0, checkinCount - playersInGen);
  const progress = checkinCount > 0 ? (playersInGen / checkinCount) * 100 : 100;
  const isComplete = unassignedCount === 0;

  return (
    <div key={gen.id} className={`card p-5 border-l-2 ${gen.is_locked ? 'border-border opacity-70' : 'border-red shadow-neon-red shadow-red/10'}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="font-medium text-text-primary text-lg flex items-center gap-2">
            {gen.modality_display} — {gen.gameday ? `${formatDate(gameDays.find((gd: any) => gd.id === gen.gameday)?.date || '')} ${gameDays.find((gd: any) => gd.id === gen.gameday)?.location ? `(${gameDays.find((gd: any) => gd.id === gen.gameday)?.location})` : ''}` : 'Avulso'}
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
          <div className="text-right border-l border-border pl-3">
            <span className="text-xs text-text-muted uppercase tracking-wider block">Balanceamento</span>
            <span className="text-green-400 font-bold text-lg">{(10 - (gen.balance_score || 0) * 10).toFixed(1)}%</span>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 border-l border-border pl-3">
              <button
                onClick={() => {
                  onConfirmDialog({
                    isOpen: true,
                    title: 'Excluir Geração',
                    desc: 'Tem certeza que deseja excluir esta geração de times?',
                    onConfirm: () => deleteGenMutation.mutate(gen.id)
                  });
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

      <div className="mb-4 bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
        <div className="flex justify-between items-center p-2.5 bg-surface-hover border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <UserCheck size={14} className={isComplete ? "text-green-500" : "text-yellow-500"} />
            <span className="font-bold text-xs text-text-primary">Sincronização Quadra</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
              {playersInGen} / {checkinCount}
            </span>
            <div className="w-16 sm:w-24 bg-border h-1.5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, progress)}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full ${isComplete ? 'bg-green-500' : 'bg-yellow-500'}`}
              />
            </div>
          </div>
        </div>
        
        {!gen.is_locked && (
          <div className={`p-3 flex flex-col md:flex-row justify-between items-center gap-4 ${!isComplete ? 'bg-yellow-500/10' : ''}`}>
            <div className="flex-1 text-center md:text-left">
              {isComplete ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-green-500 font-bold flex items-center gap-1.5 justify-center md:justify-start">
                    <Check size={14} /> Todos os jogadores da quadra estão nos times
                  </span>
                  <span className="text-[10px] text-text-muted leading-tight mt-1">
                    Para adicionar novos jogadores, certifique-se primeiro de que ele está confirmado no <strong className="text-text-primary">Circuito</strong>, depois confirme a presença dele na <strong className="text-text-primary">Tiragem de Falta</strong> e volte aqui.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-yellow-500 font-bold flex items-center gap-1.5 justify-center md:justify-start">
                    ⚠️ {unassignedCount} jogador{unassignedCount > 1 ? 'es' : ''} aguardando na quadra
                  </span>
                  <span className="text-[10px] text-text-muted leading-tight mt-1">
                    Você tirou a falta de novos jogadores! Clique em <strong className="text-text-primary">Completar</strong> para preencher as vagas vazias, ou <strong className="text-text-primary">Embaralhar</strong> para refazer o sorteio do zero.
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex w-full md:w-auto items-center gap-2 mt-2 md:mt-0">
              {!isComplete && (
                <button 
                  onClick={() => autoAllocateMutation.mutate(gen.id)}
                  disabled={autoAllocateMutation.isPending || shuffleMutation.isPending}
                  className="flex-1 md:flex-none text-[11px] bg-red text-white hover:bg-red/90 px-4 py-2 rounded font-bold shadow-neon-red flex items-center justify-center gap-1.5 transition-all"
                  title="Mantém os times atuais e apenas preenche as vagas vazias"
                >
                  {autoAllocateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  COMPLETAR
                </button>
              )}
              <button 
                onClick={() => {
                  onConfirmDialog({
                    isOpen: true,
                    title: 'Embaralhar Jogadores',
                    desc: 'Tem certeza que deseja embaralhar TODOS os jogadores presentes na quadra (Isso refará todos os times)?',
                    onConfirm: () => shuffleMutation.mutate(gen.id)
                  });
                }}
                disabled={shuffleMutation.isPending || autoAllocateMutation.isPending}
                className="flex-1 md:flex-none text-[11px] bg-blue text-white hover:bg-blue/90 px-4 py-2 rounded font-bold shadow-neon-blue flex items-center justify-center gap-1.5 transition-all"
              >
                {shuffleMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Shuffle size={14} />}
                EMBARALHAR
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between mt-2 mb-2">
        <h3 className="font-display text-xs text-text-muted">TIMES GERADOS</h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {gen.teams.map((team: any) => (
          <div key={team.id} className="bg-surface rounded-lg border border-border overflow-hidden">
            <div className="flex justify-between items-center p-2 bg-surface-hover border-b border-border-subtle">
              <span className="font-display text-xs" style={{ color: team.color_hex }}>{team.name.toUpperCase()}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${team.color_hex}20`, color: team.color_hex }}>
                  OVR: {team.avg_overall.toFixed(1)}
                </span>
                {canEdit && !gen.is_locked && team.team_players.length === 0 && (
                  <button
                    onClick={() => {
                      onConfirmDialog({
                        isOpen: true,
                        title: 'Excluir Time',
                        desc: `Excluir o ${team.name}?`,
                        onConfirm: () => removeTeamMutation.mutate({ genId: gen.id, teamId: team.id })
                      });
                    }}
                    className="text-text-muted hover:text-red transition-colors"
                    title="Excluir Time Vazio"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="p-1.5 flex flex-col gap-0.5">
              {team.team_players.map((p: any) => (
                <div key={p.id} className="flex justify-between items-center py-1 px-1 rounded hover:bg-surface-hover group transition-colors">
                  <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                    {canEdit && !gen.is_locked && (
                      <button
                        onClick={() => {
                          onConfirmDialog({
                            isOpen: true,
                            title: 'Remover Jogador',
                            desc: `Remover ${p.player_name} da pelada? Se ele foi embora, ele não voltará no sorteio.`,
                            onConfirm: () => removePlayerMutation.mutate({ genId: gen.id, playerId: p.player })
                          });
                        }}
                        className="text-text-muted hover:text-red opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        title="Remover Jogador"
                      >
                        <X size={12} />
                      </button>
                    )}
                    <span className="text-text-secondary font-medium text-xs leading-tight">
                      {p.player_name}
                      {p.player_is_guest && (
                        <span className="ml-1 text-[8px] bg-blue/20 text-blue px-1 py-0.5 rounded uppercase font-bold inline-block">
                          Conv
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="scale-75 origin-right">
                      <PositionBadge position={allPlayers.find((ap: any) => ap.id === p.player)?.main_position || 'universal'} />
                    </div>
                    <span className="text-[10px] text-text-muted font-bold w-5 text-right">{p.player_overall}</span>
                    {canEdit && !gen.is_locked && (
                      <div className="relative">
                        <select 
                          className="opacity-100 md:opacity-0 focus:opacity-100 md:group-hover:opacity-100 transition-opacity bg-surface border border-border rounded text-[9px] text-text-primary h-4 pr-3 pl-1 outline-none cursor-pointer appearance-none"
                          onChange={(e) => {
                            if (e.target.value) {
                              movePlayerMutation.mutate({ genId: gen.id, playerId: p.player, targetTeamId: Number(e.target.value) });
                              e.target.value = '';
                            }
                          }}
                          disabled={movePlayerMutation.isPending}
                          title="Mover para outro time"
                        >
                          <option value="">⇄</option>
                          {gen.teams.filter((t: any) => t.id !== team.id).map((t: any) => (
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
            {(() => {
              if (gen.is_locked) return <><History size={18} /> Ver Histórico da Pelada</>;
              const isStarted = localStorage.getItem(`hellcife_bracket_${gen.id}`)?.includes('"isStarted":true');
              return (
                <>
                  {isStarted ? <Swords size={18} /> : <Trophy size={18} />}
                  {isStarted ? 'Voltar para o Jogo (Placar)' : 'Fila e Partidas'}
                </>
              );
            })()}
          </Link>
        </div>
      )}
    </div>
  );
}
