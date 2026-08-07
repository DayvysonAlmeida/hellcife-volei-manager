import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Shuffle, Zap, Save, RefreshCw, Users, Send, Trash2, ArrowRightLeft, Trophy, Lock, History, Plus, X, UserCheck, Loader2, Swords } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { OverallBadge } from '@/components/ui/OverallBadge';
import { PositionBadge } from '@/components/ui/Badges';
import { PageLoading } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SyncButton } from '@/components/ui/SyncButton';
import { teamsService, attendanceService } from '@/services';
import { playersService } from '@/services/players';
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
  const [activeTab, setActiveTab] = useState<'gerador' | 'historico'>('gerador');
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', desc: '', onConfirm: () => {} });

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

  const { data: allPlayersData } = useQuery({
    queryKey: ['all-players'],
    queryFn: () => playersService.list({ is_active: true, page_size: 200 }),
  });
  const allPlayers = allPlayersData?.results || [];

  const { data: gameDaysData } = useQuery({
    queryKey: ['gamedays'],
    queryFn: () => attendanceService.listGameDays({ page_size: 100 }),
  });

  const gameDays = gameDaysData?.results || [];

  const todayStr = new Date().toLocaleDateString('en-CA');
  
  const { upcomingGameDays, pastGameDays } = useMemo(() => {
    const upcomingGameDays = (gameDays?.filter(gd => !gd.is_closed && gd.date >= todayStr) || []).sort((a: any, b: any) => a.date.localeCompare(b.date));
    const pastGameDays = gameDays?.filter(gd => gd.is_closed || gd.date < todayStr) || [];
    return { upcomingGameDays, pastGameDays };
  }, [gameDays, todayStr]);

  // Auto-selecionar o próximo jogo se nenhum estiver selecionado
  useEffect(() => {
    if (gameDays.length > 0 && selectedGameDayId === null) {
      if (upcomingGameDays.length > 0) {
        setSelectedGameDayId(upcomingGameDays[upcomingGameDays.length - 1].id);
      }
    }
  }, [gameDays.length, selectedGameDayId, upcomingGameDays]);

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
        <h1 className="page-title">Geração de Times (Pelada)</h1>
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

  const handleGenerate = () => {
    if (!selectedGameDayId) {
      toast.error('Selecione um dia de jogo para gerar os times.');
      return;
    }

    const alreadyGenerated = history.some(h => h.gameday === selectedGameDayId);
    
    // Se já existe e a pessoa ainda não gerou um novo (result é null)
    if (alreadyGenerated && !result) {
      setConfirmDialog({
        isOpen: true,
        title: 'Pelada Já Gerada!',
        desc: 'Já existe um sorteio salvo para esta pelada no histórico. Tem certeza que deseja gerar uma nova combinação? Isso não apagará a anterior até que você decida salvá-la.',
        onConfirm: () => {
          setConfirmDialog(s => ({ ...s, isOpen: false }));
          generateMutation.mutate();
        }
      });
    } else {
      generateMutation.mutate();
    }
  };

  const renderGeneration = (gen: any) => {
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
                    setConfirmDialog({
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

        {/* Status da Quadra (Tiragem de Falta) */}
        {(() => {
          const checkinCount = gameDays.find((gd: any) => gd.id === gen.gameday)?.total_court_checkins || 0;
          const playersInGen = gen.teams.reduce((acc: number, t: any) => acc + t.team_players.length, 0);
          const unassignedCount = Math.max(0, checkinCount - playersInGen);
          const progress = checkinCount > 0 ? (playersInGen / checkinCount) * 100 : 100;
          const isComplete = unassignedCount === 0;

          return (
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
                <div className={`p-2 flex flex-col sm:flex-row justify-between items-center gap-2 ${!isComplete ? 'bg-yellow-500/10' : ''}`}>
                  <div className="flex-1 text-center sm:text-left">
                    {!isComplete ? (
                      <span className="text-[10px] text-yellow-500 font-bold">
                        ⚠️ {unassignedCount} jogadores aguardando
                      </span>
                    ) : checkinCount > 0 ? (
                      <span className="text-[10px] text-green-500 font-bold">
                        ✓ Todos alocados
                      </span>
                    ) : null}
                  </div>
                  
                  <div className="flex w-full sm:w-auto items-center gap-2">
                    {!isComplete && (
                      <button 
                        onClick={() => autoAllocateMutation.mutate(gen.id)}
                        disabled={autoAllocateMutation.isPending || shuffleMutation.isPending}
                        className="flex-1 sm:flex-none text-[10px] bg-red text-white hover:bg-red/90 px-3 py-1.5 rounded font-bold uppercase shadow-neon-red flex items-center justify-center gap-1.5 transition-all"
                        title="Mantém os times atuais e apenas preenche as vagas vazias"
                      >
                        {autoAllocateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                        Completar
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          title: 'Embaralhar Jogadores',
                          desc: 'Tem certeza que deseja embaralhar TODOS os jogadores presentes na quadra?',
                          onConfirm: () => shuffleMutation.mutate(gen.id)
                        });
                      }}
                      disabled={shuffleMutation.isPending || autoAllocateMutation.isPending}
                      className="flex-1 sm:flex-none text-[10px] bg-blue text-white hover:bg-blue/90 px-3 py-1.5 rounded font-bold uppercase shadow-neon-blue flex items-center justify-center gap-1.5 transition-all"
                    >
                      {shuffleMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Shuffle size={12} />}
                      Embaralhar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        
        {/* Generated Teams Mini-grid */}
        <div className="flex items-center justify-between mt-2 mb-2">
          <h3 className="font-display text-xs text-text-muted">TIMES GERADOS</h3>
          {canEdit && !gen.is_locked && (
            <button
              onClick={() => addTeamMutation.mutate(gen.id)}
              disabled={addTeamMutation.isPending}
              className="text-[10px] py-1 px-2 flex items-center gap-1 rounded bg-surface border border-border-subtle hover:border-red hover:text-red transition-all"
            >
              <Plus size={10} />
              Add Time
            </button>
          )}
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
                        setConfirmDialog({
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
                            setConfirmDialog({
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-text-muted font-bold w-4 text-right">{p.player_overall}</span>
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

                {/* Add Player Dropdown */}
                {canEdit && !gen.is_locked && (
                  <div className="mt-1 pt-1 border-t border-border-subtle px-1">
                    <select
                      className="w-full bg-transparent text-[10px] text-text-muted outline-none cursor-pointer hover:text-text-primary transition-colors"
                      onChange={(e) => {
                        if (e.target.value) {
                          addPlayerMutation.mutate({ genId: gen.id, playerId: Number(e.target.value), teamId: team.id });
                          e.target.value = '';
                        }
                      }}
                      disabled={addPlayerMutation.isPending}
                    >
                      <option value="">+ Adicionar Jogador</option>
                      {allPlayers
                        .filter((p: any) => !gen.teams.some((t: any) => t.team_players.some((tp: any) => tp.player === p.id)))
                        .sort((a: any, b: any) => a.display_name.localeCompare(b.display_name))
                        .map((p: any) => (
                          <option key={p.id} value={p.id}>{p.display_name} ({p.overall})</option>
                        ))}
                    </select>
                  </div>
                )}
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
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        onOpenChange={(isOpen) => setConfirmDialog(s => ({ ...s, isOpen }))}
        title={confirmDialog.title}
        description={confirmDialog.desc}
        onConfirm={confirmDialog.onConfirm}
      />

      <div className="flex justify-between items-start">
        <div>
          <h1 className="page-title">Geração de Times (Pelada)</h1>
          <p className="page-subtitle">Aqui você sorteia os times com base na presença (balanceando Overall, Posição e Sexo), e pode ir preenchendo as vagas livremente de acordo com quem vai chegando para adaptar o jogo atual.</p>
        </div>
      </div>
      
      <SyncButton 
        onSync={() => {
          qc.invalidateQueries({ queryKey: ['team-generations-history'] });
          qc.invalidateQueries({ queryKey: ['gamedays'] });
          qc.invalidateQueries({ queryKey: ['all-players'] });
          toast.success('Dados sincronizados!');
        }} 
      />

      <div className="flex gap-2 p-1 bg-surface border border-border rounded-xl">
        <button
          onClick={() => setActiveTab('gerador')}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
            activeTab === 'gerador'
              ? 'bg-red text-white shadow-neon-red'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          Sorteio e Pelada Ativa
        </button>
        <button
          onClick={() => setActiveTab('historico')}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
            activeTab === 'historico'
              ? 'bg-red text-white shadow-neon-red'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          Histórico
        </button>
      </div>

      {activeTab === 'gerador' && (
        <div className="space-y-4">
          {/* Config */}
          <div className="card p-4 md:p-5">
            <h2 className="font-display text-xs tracking-wider text-text-primary mb-3">CONFIGURAÇÃO DO SORTEIO</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Modality */}
              <div>
                <label className="text-text-muted text-[10px] uppercase tracking-wider block mb-1.5">Modalidade</label>
                <div className="flex gap-1.5 flex-wrap">
                  {MODALITIES.map((m) => (
                    <button
                      key={m}
                      onClick={() => setModality(m)}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-all
                        ${modality === m
                          ? 'bg-red text-white shadow-neon-red'
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
                <label className="text-text-muted text-[10px] uppercase tracking-wider block mb-1.5">
                  Dia de jogo (Filtra quem está na quadra)
                </label>
                <select
                  className="input w-full text-xs py-1.5 px-3 h-auto"
                  value={selectedGameDayId || ''}
                  onChange={(e) => setSelectedGameDayId(Number(e.target.value) || null)}
                >
                  <option value="">Selecione a pelada</option>
                  
                  {upcomingGameDays.length > 0 && (
                    <optgroup label="🔴 Peladas Abertas">
                      {upcomingGameDays.map(gd => (
                        <option key={gd.id} value={gd.id}>
                          {gd.date === todayStr ? '[HOJE] ' : ''}
                          {formatDate(gd.date)} {gd.time ? `- ${gd.time.slice(0, 5)}` : ''} {gd.location ? `- ${gd.location}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {pastGameDays.length > 0 && (
                    <optgroup label="🔒 Histórico (Encerradas)">
                      {pastGameDays.map(gd => (
                        <option key={gd.id} value={gd.id}>
                          {formatDate(gd.date)} {gd.time ? `- ${gd.time.slice(0, 5)}` : ''} {gd.location ? `- ${gd.location}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              {selectedGameDayId && gameDays.find((g: any) => g.id === selectedGameDayId)?.is_closed ? (
                <div className="flex items-center gap-1.5 text-red font-bold text-xs bg-red/10 px-3 py-1.5 rounded border border-red/20 w-full sm:w-auto">
                  <Lock size={14} />
                  Geração bloqueada (Encerrada).
                </div>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="btn-primary text-xs px-4 py-2 flex-1 sm:flex-none flex items-center justify-center gap-2"
                >
                  {generateMutation.isPending ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Zap size={14} />
                  )}
                  {result ? 'Regerar times' : 'Gerar times'}
                </button>
              )}
              
              {result && (
                <>
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="btn-secondary text-xs px-3 py-2 flex-1 sm:flex-none flex items-center justify-center gap-1.5"
                  >
                    <Save size={14} />
                    Salvar Sorteio
                  </button>
                  <button
                    onClick={handleShareWhatsApp}
                    className="btn-ghost text-xs px-3 py-2 flex-1 sm:flex-none flex items-center justify-center gap-1.5"
                  >
                    <Send size={14} className="text-green-500" />
                    <span className="hidden sm:inline">Compartilhar</span>
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
                <motion.div 
                  key={team.order}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: idx * 0.15, type: 'spring' }}
                >
                  <TeamCard team={team} idx={idx} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {history.filter(h => !h.is_locked).length > 0 && (
        <div className="mt-8 pt-8 border-t border-border">
          <h2 className="font-display text-2xl font-bold tracking-widest text-text-primary uppercase flex items-center gap-3 mb-6">
            <Trophy className="text-yellow-400" size={24} />
            Pelada Ativa (Jogando)
          </h2>
          <div className="space-y-6">
            {history.filter(h => !h.is_locked).map(gen => renderGeneration(gen))}
          </div>
        </div>
      )}
        </div>
      )}


      {activeTab === 'historico' && (
        <div className="space-y-6">
          {/* Past Generations */}
          {history.filter(h => h.is_locked).length > 0 ? (
            <div>
              <h2 className="font-display text-2xl font-bold tracking-widest text-text-primary uppercase flex items-center gap-3 mb-6">
                <History className="text-red" size={24} />
                Histórico de Peladas Anteriores
              </h2>
              <div className="space-y-6">
                {history.filter(h => h.is_locked).map(gen => renderGeneration(gen))}
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center text-text-muted">
              Nenhum histórico encontrado.
            </div>
          )}
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
      className="bg-surface rounded-lg border border-border overflow-hidden shadow-sm"
    >
      <div className="flex justify-between items-center p-2 bg-surface-hover border-b border-border-subtle">
        <span className="font-display text-xs" style={{ color: team.color_hex }}>{team.name.toUpperCase()}</span>
        <span className="font-bold text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${team.color_hex}20`, color: team.color_hex }}>
          OVR: {team.avg_overall.toFixed(1)}
        </span>
      </div>

      <div className="p-1.5 flex flex-col gap-0.5">
        {team.players.map((player, i) => (
          <div key={player.id} className="flex justify-between items-center py-1 px-1 rounded hover:bg-surface-hover transition-colors">
            <div className="flex items-center gap-1.5 overflow-hidden flex-1">
              <span className="text-text-muted text-[10px] w-3">{i + 1}</span>
              <Avatar name={player.display_name} src={player.avatar_url} size="sm" className="w-5 h-5 text-[8px]" />
              <div className="flex flex-col min-w-0">
                <p className="text-text-primary text-[11px] font-medium leading-tight flex flex-wrap items-center gap-1">
                  {player.display_name}
                  {player.is_guest && (
                    <span className="text-[7px] bg-blue/20 text-blue px-1 rounded uppercase font-bold inline-block">
                      Conv
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="scale-75 origin-right">
                <PositionBadge position={player.main_position} />
              </div>
              <div className="scale-90 origin-right">
                <OverallBadge overall={player.overall} size="sm" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
