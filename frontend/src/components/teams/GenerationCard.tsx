import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Trash2, Lock, UserCheck, Zap, Loader2, Shuffle, X, ArrowRightLeft, Trophy, History, Swords, Check, LogOut, Undo2, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { teamsService } from '@/services';
import { formatDate } from '@/lib/utils';
import { PositionBadge } from '@/components/ui/Badges';
import { courtOptionLabel, courtOptions, suggestedCourts } from '@/components/teams/court-plan';

export function GenerationCard({ gen, gameDays, allPlayers, canEdit, onConfirmDialog, siblingCourts = [] }: { 
  gen: any; 
  gameDays: any[]; 
  allPlayers: any[]; 
  canEdit: boolean;
  onConfirmDialog: (config: any) => void;
  /** Outras quadras abertas do mesmo circuito: destinos do "mover". */
  siblingCourts?: any[];
}) {
  const qc = useQueryClient();
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  // Com mais de uma quadra no circuito, o card mostra qual é
  const courtLabel = (gen.circuit_courts || 1) > 1 ? `Quadra ${gen.court}` : null;

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
    onSuccess: (res) => {
       qc.invalidateQueries({ queryKey: ['team-generations-history'] });
       toast.success(res?.detail || 'Jogador transferido com sucesso!');
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Erro ao mover o jogador.'),
  });

  const removePlayerMutation = useMutation({
    mutationFn: ({ genId, playerId }: { genId: number, playerId: number }) => 
       teamsService.removePlayer(genId, playerId),
    onSuccess: () => {
       qc.invalidateQueries({ queryKey: ['team-generations-history'] });
       toast.success('Jogador saiu da pelada (presença na quadra mantida).');
    }
  });

  const restorePlayerMutation = useMutation({
    mutationFn: ({ genId, playerId }: { genId: number, playerId: number }) =>
       teamsService.restorePlayer(genId, playerId),
    onSuccess: (res) => {
       qc.invalidateQueries({ queryKey: ['team-generations-history'] });
       toast.success(res.detail || 'Jogador de volta!');
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Erro ao trazer o jogador de volta.'),
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
       // Mostra quem entrou em qual time (ex.: "Ana, Bia → Time Azul")
       toast.success(res.detail || 'Jogadores alocados com sucesso!', { duration: 6000 });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Erro ao completar os times.'),
  });

  const shuffleMutation = useMutation({
    mutationFn: (genId: number) => teamsService.shuffle(genId),
    onSuccess: (res) => {
       qc.invalidateQueries({ queryKey: ['team-generations-history'] });
       toast.success(res.detail || 'Times embaralhados com sucesso!');
    }
  });

  // Trocar a modalidade só desta quadra (os times dela são refeitos; as outras quadras não mudam)
  const [showModality, setShowModality] = useState(false);
  const changeModalityMutation = useMutation({
    mutationFn: (modality: number) => teamsService.shuffle(gen.id, modality),
    onSuccess: (res) => {
       qc.invalidateQueries({ queryKey: ['team-generations-history'] });
       setShowModality(false);
       toast.success(res.detail);
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Erro ao trocar a modalidade.'),
  });

  const playersInGen = gen.teams.reduce((acc: number, t: any) => acc + t.team_players.length, 0);
  const removedPlayers: Array<{ id: number; name: string }> = gen.removed_players || [];
  // Quem chegou à quadra e ainda não está num time, por ordem de chegada (quem saiu da pelada não entra)
  const waitingPlayers: Array<{ id: number; name: string }> = gen.waiting_players || [];
  const unassignedCount = waitingPlayers.length;
  const activeCount = playersInGen + unassignedCount;
  const progress = activeCount > 0 ? (playersInGen / activeCount) * 100 : 100;
  const isComplete = unassignedCount === 0;

  // Dividir em quadras: pelada de uma quadra só com gente demais (mais de ~20 por quadra)
  const canSplit = canEdit && !gen.is_locked && !!gen.gameday && (gen.open_courts || 1) === 1
    && suggestedCourts(activeCount, gen.modality) > 1;
  const splitOptions = courtOptions(activeCount, gen.modality).filter((o) => o.courts > 1);
  const suggestedSplit = suggestedCourts(activeCount, gen.modality);
  // Com várias quadras abertas, cada pessoa que aguarda pode ir direto para uma delas
  const allCourts = [gen, ...siblingCourts].sort((a: any, b: any) => (a.court || 1) - (b.court || 1));

  const splitMutation = useMutation({
    mutationFn: (courts: number) => teamsService.splitCourts(gen.id, courts),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['team-generations-history'] });
      toast.success(res.detail);
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Erro ao dividir em quadras.'),
  });

  const sendToCourtMutation = useMutation({
    mutationFn: ({ genId, playerId }: { genId: number; playerId: number }) => teamsService.autoAllocate(genId, [playerId]),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['team-generations-history'] });
      toast.success(res.detail);
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Erro ao mandar para a quadra.'),
  });

  return (
    <div key={gen.id} className={`card p-5 border-l-2 ${gen.is_locked ? 'border-border opacity-70' : 'border-red shadow-neon-red shadow-red/10'}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="font-medium text-text-primary text-lg flex items-center gap-2 flex-wrap">
            {courtLabel && (
              <span className="font-display text-xs tracking-widest uppercase bg-red text-white px-2 py-0.5 rounded">{courtLabel}</span>
            )}
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
          {canEdit && !gen.is_locked && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setShowModality((v) => !v)}
                className="text-[11px] font-bold text-text-muted hover:text-text-primary border border-border rounded px-2 py-1"
              >
                {showModality ? 'Fechar' : 'Trocar modalidade'}
              </button>
              {showModality && [2, 3, 4, 5, 6].map((m) => {
                const enough = playersInGen + unassignedCount >= m * 2; // pelo menos 2 times
                return (
                  <button
                    key={m}
                    disabled={m === gen.modality || !enough || changeModalityMutation.isPending}
                    title={enough ? undefined : `Precisa de ${m * 2} atletas`}
                    onClick={() => onConfirmDialog({
                      isOpen: true,
                      title: `Mudar ${courtLabel ?? 'a pelada'} para ${m}x${m}`,
                      desc: `Os times ${courtLabel ? `da ${courtLabel}` : 'desta pelada'} serão refeitos em ${m}x${m} com quem está nela e quem está aguardando${courtLabel ? '. As outras quadras não mudam' : ''}. Um jogo em andamento termina com os times atuais.`,
                      onConfirm: () => changeModalityMutation.mutate(m),
                    })}
                    className={`text-[11px] font-bold px-2 py-1 rounded border transition-all disabled:cursor-not-allowed ${
                      m === gen.modality ? 'bg-red/10 border-red/30 text-red' : 'border-border text-text-secondary hover:border-red/50 disabled:opacity-40'
                    }`}
                  >
                    {m}x{m}
                  </button>
                );
              })}
            </div>
          )}
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
              {playersInGen} / {activeCount}
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
                  {allCourts.length > 1 ? (
                    // Várias quadras: cada pessoa vai direto para a quadra escolhida
                    <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                      {waitingPlayers.map((p) => (
                        <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface pl-2.5 pr-1 py-0.5 text-xs text-text-primary">
                          {p.name}
                          {allCourts.map((court: any) => (
                            <button
                              key={court.id}
                              onClick={() => sendToCourtMutation.mutate({ genId: court.id, playerId: p.id })}
                              disabled={sendToCourtMutation.isPending}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red/15 text-red hover:bg-red hover:text-white transition-colors"
                              title={`Mandar ${p.name} para a Quadra ${court.court}`}
                            >
                              Q{court.court}
                            </button>
                          ))}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-text-primary font-medium">
                      {waitingPlayers.map((p) => p.name).join(', ')}
                    </span>
                  )}
                  <span className="text-[10px] text-text-muted leading-tight mt-1">
                    <strong className="text-text-primary">Completar</strong> coloca quem chegou nos times que faltam gente, na ordem de chegada (quem já está num time continua nele). <strong className="text-text-primary">Embaralhar</strong> refaz todos os times equilibrando o nível.
                    {allCourts.length > 1 && <> <strong className="text-text-primary">Q1, Q2...</strong> manda a pessoa direto para aquela quadra.</>}
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
                    desc: removedPlayers.length > 0
                      ? `Refazer todos os times com quem está na quadra? Quem saiu da pelada (${removedPlayers.length}) não volta para o sorteio.`
                      : 'Refazer todos os times com quem está na quadra?',
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
      
      {canSplit && (
        <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-[11px] text-text-secondary flex-1">
            <strong className="text-text-primary">{activeCount} atletas</strong> numa quadra só. Dividir em quadras refaz os times equilibrados e cria as outras quadras.
          </span>
          <div className="flex gap-2">
            {splitOptions.map((option) => (
              <button
                key={option.courts}
                disabled={!option.ok || splitMutation.isPending}
                onClick={() => onConfirmDialog({
                  isOpen: true,
                  title: `Dividir em ${option.courts} quadras`,
                  desc: `Os times desta pelada serão refeitos com quem está na quadra e quem está aguardando, distribuídos em ${option.courts} quadras (${courtOptionLabel(option)}). Partidas já salvas continuam no histórico. Se a fila já começou, ela recebe os times novos.`,
                  onConfirm: () => splitMutation.mutate(option.courts),
                })}
                className={`flex-1 sm:flex-none text-[11px] px-3 py-2 rounded font-bold border transition-all disabled:opacity-40 ${
                  option.courts === suggestedSplit
                    ? 'bg-red text-white border-red shadow-neon-red'
                    : 'bg-surface text-text-primary border-border hover:border-red/50'
                }`}
              >
                {splitMutation.isPending ? <Loader2 size={12} className="inline animate-spin mr-1" /> : null}
                Dividir em {option.courts} quadras
                <span className="block text-[10px] font-medium opacity-80">{courtOptionLabel(option)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-2 mb-2">
        <h3 className="font-display text-xs text-text-muted">TIMES GERADOS</h3>
        {canEdit && !gen.is_locked && (
          <button
            onClick={() => setShowAddPlayer((v) => !v)}
            className="text-[11px] font-bold text-text-muted hover:text-text-primary flex items-center gap-1 border border-border rounded px-2 py-1"
          >
            <UserPlus size={12} /> {showAddPlayer ? 'Fechar' : 'Adicionar atleta'}
          </button>
        )}
      </div>

      {showAddPlayer && canEdit && !gen.is_locked && (
        <AddPlayerPanel gen={gen} allPlayers={allPlayers} onDone={() => setShowAddPlayer(false)} />
      )}
      
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
                          // Largura fixa: sem ela o seletor cresce até a opção mais longa ("Time Vermelho (Quadra 2)") e corta o nome do atleta
                          className="w-8 opacity-100 md:opacity-0 focus:opacity-100 md:group-hover:opacity-100 transition-opacity bg-surface border border-border rounded text-[9px] text-text-primary h-4 pr-3 pl-1 outline-none cursor-pointer appearance-none"
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
                          {siblingCourts.map((court: any) => (
                            <optgroup key={court.id} label={`Quadra ${court.court}`}>
                              {court.teams.map((t: any) => (
                                <option key={t.id} value={t.id}>{t.name} (Quadra {court.court})</option>
                              ))}
                            </optgroup>
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

      {removedPlayers.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-surface/40 p-3">
          <p className="font-display text-xs text-text-muted flex items-center gap-1.5 mb-2">
            <LogOut size={12} /> SAÍRAM DA PELADA ({removedPlayers.length})
            <span className="font-sans normal-case text-[10px] text-text-muted/70 ml-1">— presença na quadra mantida, não voltam no Embaralhar</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {removedPlayers.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-secondary">
                {p.name}
                {canEdit && !gen.is_locked && (
                  <button
                    onClick={() => restorePlayerMutation.mutate({ genId: gen.id, playerId: p.id })}
                    disabled={restorePlayerMutation.isPending}
                    className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-400 hover:text-green-300"
                    title="Voltou para o jogo: entra no próximo Embaralhar ou Completar"
                  >
                    <Undo2 size={11} /> Voltar
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {canEdit && (
        <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Jogo em andamento (placar salvo no servidor): dá para acompanhar sem abrir a quadra */}
          {gen.live ? (
            <p className="text-xs text-text-secondary flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <strong className="text-text-primary">Jogo {gen.live.match_number}:</strong>
              <span style={{ color: gen.live.color_a }}>{gen.live.team_a}</span>
              <strong className="text-text-primary tabular-nums">{gen.live.score_a} x {gen.live.score_b}</strong>
              <span style={{ color: gen.live.color_b }}>{gen.live.team_b}</span>
              {gen.live.controller_name && <span className="text-text-muted">· marcando: {gen.live.controller_name}</span>}
            </p>
          ) : <span />}
          <Link
            to={`/bracket/${gen.id}`}
            className={`px-6 py-3 flex items-center gap-2 w-full sm:w-auto justify-center ${gen.is_locked ? 'btn-secondary text-text-secondary border border-border bg-surface/50 hover:bg-surface' : 'btn-primary'}`}
          >
            {(() => {
              if (gen.is_locked) return <><History size={18} /> Ver Histórico da Pelada</>;
              const isStarted = !!gen.live || localStorage.getItem(`hellcife_bracket_${gen.id}`)?.includes('"isStarted":true');
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

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Adicionar atleta manualmente a um time (ex.: quem veio de uma quadra encerrada ou um ajuste na hora).
 * Se ele ainda não fez check-in, o check-in na quadra é feito junto.
 */
function AddPlayerPanel({ gen, allPlayers, onDone }: { gen: any; allPlayers: any[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [player, setPlayer] = useState<any | null>(null);
  // Por padrão, o time com menos gente
  const smallest = [...gen.teams].sort((a: any, b: any) => a.team_players.length - b.team_players.length)[0];
  const [teamId, setTeamId] = useState<number | null>(smallest?.id ?? null);

  const inThisCourt = new Set(gen.teams.flatMap((t: any) => t.team_players.map((p: any) => p.player)));
  const matches = query.trim().length >= 2
    ? allPlayers
        .filter((p) => !inThisCourt.has(p.id) && normalize(`${p.display_name} ${p.name}`).includes(normalize(query.trim())))
        .slice(0, 6)
    : [];
  const team = gen.teams.find((t: any) => t.id === teamId);

  const addMutation = useMutation({
    mutationFn: () => teamsService.addPlayer(gen.id, player.id, teamId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-generations-history'] });
      toast.success(`${player.display_name} entrou no ${team?.name}.`);
      onDone();
    },
    // Ex.: quem joga em outra quadra precisa ser movido de lá
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Erro ao adicionar o atleta.'),
  });

  return (
    <div className="mb-3 rounded-lg border border-border bg-surface/40 p-3 space-y-2">
      <input
        type="text"
        autoFocus
        value={player ? player.display_name : query}
        onChange={(e) => { setPlayer(null); setQuery(e.target.value); }}
        placeholder="Buscar atleta pelo nome..."
        className="input w-full text-sm"
      />
      {!player && matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {matches.map((p) => (
            <button key={p.id} onClick={() => setPlayer(p)} className="text-xs px-2.5 py-1 rounded-full border border-border bg-surface hover:border-red/50">
              {p.display_name}
            </button>
          ))}
        </div>
      )}
      {!player && query.trim().length >= 2 && matches.length === 0 && (
        <p className="text-[11px] text-text-muted">Nenhum atleta encontrado (quem já está nesta quadra não aparece).</p>
      )}
      {player && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {gen.teams.map((t: any) => (
              <button
                key={t.id}
                onClick={() => setTeamId(t.id)}
                className="text-xs px-2.5 py-1 rounded border font-bold"
                style={teamId === t.id
                  ? { borderColor: t.color_hex, backgroundColor: `${t.color_hex}25`, color: t.color_hex }
                  : { borderColor: 'transparent', color: t.color_hex }}
              >
                {t.name} ({t.team_players.length})
              </button>
            ))}
          </div>
          <button
            onClick={() => addMutation.mutate()}
            disabled={!teamId || addMutation.isPending}
            className="btn-primary text-xs px-3 py-2 w-full sm:w-auto flex items-center justify-center gap-1.5"
          >
            {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Adicionar {player.display_name} ao {team?.name}
          </button>
        </>
      )}
    </div>
  );
}
