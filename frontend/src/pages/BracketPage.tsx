import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, Swords, Shield, Zap, Shuffle, ArrowRightLeft, RotateCcw, Power, Play, Lock, History, UserCheck, ArrowUp, ArrowDown, ChevronsUp } from 'lucide-react';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { SyncButton } from '@/components/ui/SyncButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { teamsService, matchesService } from '@/services';
import type { DBTeam, QuickMatchData, Modality, Match, CourtTeam } from '@/types';
import toast from 'react-hot-toast';
import { MatchCard } from '@/components/matches/MatchCard';
import { CourtCheckinModal } from '@/components/attendance/CourtCheckinModal';
import { useAuth } from '@/store/AuthContext';
import { borrowKeeping, borrowPlayersForTeam, borrowedPlayerIds, rotateAfterMatch, withoutPlayers } from '@/components/bracket/bracket-utils';
import { CourtScoreboard } from '@/components/bracket/CourtScoreboard';
import { CourtSyncBar } from '@/components/bracket/CourtSyncBar';
import { useBracketSync } from '@/components/bracket/useBracketSync';
import { COURT_COLORS } from '@/components/teams/court-plan';
import { SaveMatchModal } from '@/components/bracket/SaveMatchModal';

interface BracketState {
  isStarted: boolean;
  queue: DBTeam[];
  courtA: CourtTeam | null;
  courtB: CourtTeam | null;
  scoreA: number;
  scoreB: number;
  consecutiveA: number;
  consecutiveB: number;
  matchNumber: number;
  showSaveModal: boolean;
  borrowCounts: Record<number, number>;
  transitionMessage: string | null;
  transitionColor: string | null;
  /** Emprestados já anunciados para o próximo time da fila: são eles que entram quando o time entrar. */
  nextBorrow?: { teamId: number; playerIds: number[] } | null;
}

export function BracketPage() {
  const { user } = useAuth();
  const isAdmin = user?.profile === 'admin' || user?.profile === 'moderator';
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', desc: '', onConfirm: () => {} });
  const storageKey = `hellcife_bracket_${id}`;

  const { data: generation, isLoading, error } = useQuery({
    queryKey: ['team-generation', id],
    queryFn: () => teamsService.get(Number(id)),
    enabled: !!id,
    refetchInterval: 10000, // Sincroniza a cada 10s caso alguém altere os times pelo backend
  });

  const { data: matchesData } = useQuery({
    queryKey: ['matches', generation?.id],
    queryFn: () => matchesService.list({ team_generation: generation?.id }),
    enabled: !!generation?.id,
  });
  const matches = matchesData?.results || [];

  const autoAllocateMutation = useMutation({
    mutationFn: (genId: number) => teamsService.autoAllocate(genId),
    onSuccess: (res) => {
       qc.invalidateQueries({ queryKey: ['team-generation', id] });
       // Mostra quem entrou em qual time (ex.: "Ana, Bia → Time Azul")
       toast.success(res.detail || 'Jogadores alocados com sucesso!', { duration: 6000 });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Erro ao completar os times.'),
  });

  const [state, setState] = useState<BracketState>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved bracket state', e);
      }
    }
    return {
      isStarted: false,
      queue: [],
      courtA: null,
      courtB: null,
      scoreA: 0,
      scoreB: 0,
      consecutiveA: 0,
      consecutiveB: 0,
      matchNumber: 1,
      showSaveModal: false,
      borrowCounts: {},
      transitionMessage: null,
      transitionColor: null,
    };
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  // Fila e placar no servidor: qualquer celular vê e continua; quem não está marcando só acompanha
  const sync = useBracketSync({ generationId: Number(id), enabled: !!generation && !generation.is_locked, state, setState });
  const readOnly = !sync.loaded || sync.otherScorerActive;

  // Sincronização ao vivo de jogadores nos times e novos times
  useEffect(() => {
    if (generation) {
      setState(prev => {
        let changed = false;
        
        const syncQueueTeam = (t: DBTeam) => {
           const freshTeam = generation.teams.find((genT: any) => genT.id === t.id);
           if (!freshTeam) { changed = true; return null; }
           if (JSON.stringify(freshTeam.team_players) !== JSON.stringify(t.team_players)) {
             changed = true;
             return { ...t, team_players: freshTeam.team_players, avg_overall: freshTeam.avg_overall };
           }
           return t;
        };

        let newQueue = prev.queue.map(syncQueueTeam).filter(Boolean) as DBTeam[];
        if (prev.queue.length !== newQueue.length) changed = true;

        // Antes do primeiro ponto, o time em quadra acompanha as mudanças: se alguém saiu (ou chegou), os
        // emprestados são escolhidos de novo para completar, sem cancelar o jogo. Depois do primeiro ponto,
        // quem está em quadra não muda: quem chegou ou saiu vale na próxima partida.
        const syncCourtTeam = (t: CourtTeam | null, other: CourtTeam | null): CourtTeam | null => {
          if (!t) return null;
          const freshTeam = generation.teams.find((genT: any) => genT.id === t.id);
          if (!freshTeam) {
            changed = true;
            return null; // Time foi excluído
          }
          const ids = (players: Array<{ player: number }>) => players.map(p => p.player).join(',');
          if (ids(freshTeam.team_players) === ids(t.team_players.filter(p => !p.is_borrowed))) return t;
          changed = true;
          return borrowKeeping(
            freshTeam, [...borrowedPlayerIds(t)], other?.avg_overall || 0, generation.modality,
            withoutPlayers(newQueue, borrowedPlayerIds(other)), prev.borrowCounts,
          );
        };
        const matchUnderway = prev.scoreA + prev.scoreB > 0;
        const newCourtA = matchUnderway ? prev.courtA : syncCourtTeam(prev.courtA, prev.courtB);
        const newCourtB = matchUnderway ? prev.courtB : syncCourtTeam(prev.courtB, newCourtA);

        // Verifica novos times criados
        const currentIds = new Set([
          newCourtA?.id,
          newCourtB?.id,
          ...newQueue.map(t => t.id)
        ].filter(Boolean));

        const newTeams = generation.teams.filter((t: any) => !currentIds.has(t.id));
        if (newTeams.length > 0) {
          changed = true;
          newQueue = [...newQueue, ...newTeams];
        }

        if (changed) {
          return { ...prev, courtA: newCourtA, courtB: newCourtB, queue: newQueue };
        }
        return prev;
      });
    }
  }, [generation]);

  const shuffleQueue = () => {
    sync.markUserAction();
    setState(prev => {
      const newQueue = [...prev.queue].sort(() => Math.random() - 0.5);
      return { ...prev, queue: newQueue };
    });
  };

  const moveInQueue = (index: number, direction: 'up' | 'down' | 'top') => {
    sync.markUserAction();
    setState(prev => {
      const newQueue = [...prev.queue];
      if (direction === 'up' && index > 0) {
        [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];
      } else if (direction === 'down' && index < newQueue.length - 1) {
        [newQueue[index + 1], newQueue[index]] = [newQueue[index], newQueue[index + 1]];
      } else if (direction === 'top' && index > 0) {
        const item = newQueue.splice(index, 1)[0];
        newQueue.unshift(item);
      }
      return { ...prev, queue: newQueue };
    });
  };

  // Quem o próximo time da fila vai pegar emprestado: a escolha fica guardada (nextBorrow) e é a mesma na
  // hora de entrar. Quem está jogando emprestado agora não entra na conta.
  const nextBorrowPreview = (s: BracketState) => {
    const next = s.queue[0];
    if (!next || !generation) return null;
    const keep = s.nextBorrow?.teamId === next.id ? s.nextBorrow.playerIds : [];
    const pool = withoutPlayers(s.queue.slice(1), borrowedPlayerIds(s.courtA, s.courtB));
    return borrowKeeping(next, keep, 0, generation.modality, pool, s.borrowCounts);
  };
  const borrowedQueue0 = useMemo(() => nextBorrowPreview(state), [state.queue, state.courtA, state.courtB, state.nextBorrow, state.borrowCounts, generation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guarda a escolha do próximo emprestado (só quem está marcando: os outros celulares recebem pelo servidor)
  useEffect(() => {
    if (!generation || !state.isStarted || readOnly) return;
    setState(prev => {
      const preview = nextBorrowPreview(prev);
      const ids = preview ? preview.team_players.filter(p => p.is_borrowed).map(p => p.player) : [];
      const nextBorrow = preview && ids.length ? { teamId: preview.id, playerIds: ids } : null;
      if (JSON.stringify(nextBorrow) === JSON.stringify(prev.nextBorrow ?? null)) return prev;
      return { ...prev, nextBorrow };
    });
  }, [generation, state.isStarted, state.queue, state.courtA, state.courtB, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const startPelada = () => {
    sync.markUserAction();
    if (state.queue.length < 2) {
      toast.error('É preciso no mínimo 2 times para iniciar.');
      return;
    }
    setState(prev => {
      const q = [...prev.queue];
      let courtA: CourtTeam = { ...q.shift()!, team_players: [] } as any; 
      let courtB: CourtTeam = { ...q.shift()!, team_players: [] } as any; 
      // Recover original players to avoid ts errors in initial setup
      courtA = borrowPlayersForTeam(prev.queue[0], prev.queue[1].avg_overall, generation!.modality, q, prev.borrowCounts);
      // Quem já foi emprestado para o lado A não pode ir também para o B
      courtB = borrowPlayersForTeam(prev.queue[1], courtA.avg_overall, generation!.modality, withoutPlayers(q, borrowedPlayerIds(courtA)), prev.borrowCounts);
      
      return {
        ...prev,
        isStarted: true,
        courtA,
        courtB,
        scoreA: 0,
        scoreB: 0,
        queue: q,
      };
    });
  };

  const updateScore = (team: 'A' | 'B', delta: number) => {
    sync.markUserAction();
    setState(prev => ({
      ...prev,
      scoreA: team === 'A' ? Math.max(0, prev.scoreA + delta) : prev.scoreA,
      scoreB: team === 'B' ? Math.max(0, prev.scoreB + delta) : prev.scoreB,
    }));
  };

  const cancelMatch = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cancelar Jogo Atual?',
      desc: 'Os times voltarão para o topo da fila e a pontuação atual será apagada. Tem certeza?',
      onConfirm: () => {
        sync.markUserAction();
        setState(prev => {
          const q = [...prev.queue];
          // Restaura os times originais, sem os empréstimos (se não salvarmos o resultado, o jogo não aconteceu)
          const originalCourtB = generation!.teams.find((t: any) => t.id === prev.courtB?.id) || prev.courtB;
          const originalCourtA = generation!.teams.find((t: any) => t.id === prev.courtA?.id) || prev.courtA;
          
          if (originalCourtB) q.unshift(originalCourtB as any);
          if (originalCourtA) q.unshift(originalCourtA as any);
          
          return {
            ...prev,
            isStarted: false,
            courtA: null,
            courtB: null,
            scoreA: 0,
            scoreB: 0,
            queue: q,
          };
        });
      }
    });
  };

  const saveMutation = useMutation({
    mutationFn: (data: QuickMatchData) => matchesService.quickCreate(data),
    onSuccess: () => {
      toast.success('Resultado salvo com sucesso!');
      advanceBracket();
      qc.invalidateQueries({ queryKey: ['matches', generation?.id] });
    },
    onError: () => toast.error('Erro ao salvar o resultado.'),
  });

  const handleSaveResult = () => {
    if (!state.courtA || !state.courtB) return;
    if (state.scoreA === state.scoreB) {
      toast.error('O jogo não pode terminar empatado no rodízio.');
      return;
    }

    const data: QuickMatchData = {
      // O mesmo jogo salvo por dois celulares vira uma partida só
      bracket_key: `${generation!.id}:${state.matchNumber}`,
      match: {
        date: new Date().toLocaleDateString('en-CA'),
        modality: generation!.modality as Modality,
        team_generation: generation!.id,
        gameday: generation!.gameday,
      },
      teams: [
        {
          team_id: state.courtA.id,
          team_name: state.courtA.name,
          color_hex: state.courtA.color_hex,
          score: state.scoreA,
          player_ids: state.courtA.team_players.map((p: any) => p.player),
          borrowed_ids: state.courtA.team_players.filter((p: any) => p.is_borrowed).map((p: any) => p.player),
        },
        {
          team_id: state.courtB.id,
          team_name: state.courtB.name,
          color_hex: state.courtB.color_hex,
          score: state.scoreB,
          player_ids: state.courtB.team_players.map((p: any) => p.player),
          borrowed_ids: state.courtB.team_players.filter((p: any) => p.is_borrowed).map((p: any) => p.player),
        }
      ]
    };

    saveMutation.mutate(data);
  };

  const advanceBracket = () => {
    sync.markUserAction();
    setState(prev => {
      const winnerIsA = prev.scoreA > prev.scoreB;
      const winnerCourt = winnerIsA ? prev.courtA! : prev.courtB!;
      const loserCourt = winnerIsA ? prev.courtB! : prev.courtA!;

      // Cada time volta com os jogadores atuais dele: emprestados retornam aos seus times e quem chegou
      // durante a partida entra agora. Time excluído no meio do jogo (ex.: Embaralhar) sai do rodízio.
      const baseOf = (t: CourtTeam): DBTeam | null =>
        (generation!.teams.find((g: any) => g.id === t.id) as DBTeam | undefined) ?? null;
      const winner = baseOf(winnerCourt);
      const loser = baseOf(loserCourt);

      // Incrementa quem jogou emprestado nesta rodada
      const newBorrowCounts = { ...prev.borrowCounts };
      const recordBorrows = (t: CourtTeam) => {
        t.team_players.forEach(p => {
          if (p.is_borrowed) {
            newBorrowCounts[p.player] = (newBorrowCounts[p.player] || 0) + 1;
          }
        });
      };
      recordBorrows(prev.courtA!);
      recordBorrows(prev.courtB!);

      const newConsecutiveA = winnerIsA ? prev.consecutiveA + 1 : 0;
      const newConsecutiveB = !winnerIsA ? prev.consecutiveB + 1 : 0;
      const winnerConsecutive = winnerIsA ? newConsecutiveA : newConsecutiveB;

      // Sai depois de 2 seguidas só se houver 2 times completos esperando fora (senão fica até perder).
      // Quem emprestou jogador para esta partida não conta como completo lá fora.
      const lentPlayerIds = borrowedPlayerIds(prev.courtA, prev.courtB);
      const rotation = rotateAfterMatch({
        winner, loser, winnerIsA, winnerConsecutive, queue: prev.queue, modality: generation!.modality, lentPlayerIds,
      });
      const q = rotation.queue;
      const nextABase = rotation.nextA;
      const nextBBase = rotation.nextB;
      const nextConsecutiveA = winnerIsA && rotation.winnerStays ? newConsecutiveA : 0;
      const nextConsecutiveB = !winnerIsA && rotation.winnerStays ? newConsecutiveB : 0;
      const message = rotation.winnerLeft
        ? `${winnerCourt.name.toUpperCase()} atingiu 2 vitórias seguidas e dá lugar na quadra!`
        : `${winnerCourt.name.toUpperCase()} venceu e continua na quadra!`;

      // Aplicar o empréstimo nos times que vão entrar, usando a fila ATUALIZADA (q) e os novos contadores
      // Quem a fila anunciou como emprestado do time que entra é quem entra (só troca quem não está mais
      // disponível). Esse time é montado primeiro; o outro não pode usar os mesmos jogadores.
      const announced = (base: DBTeam | null) => (base && prev.nextBorrow?.teamId === base.id ? prev.nextBorrow.playerIds : []);
      const build = (base: DBTeam | null, opposingAvg: number, pool: DBTeam[]) =>
        base ? borrowKeeping(base, announced(base), opposingAvg, generation!.modality, pool, newBorrowCounts) : null;

      let finalNextA: CourtTeam | null;
      let finalNextB: CourtTeam | null;
      if (announced(nextBBase).length && !announced(nextABase).length) {
        finalNextB = build(nextBBase, nextABase?.avg_overall || 0, q);
        finalNextA = build(nextABase, finalNextB?.avg_overall || 0, withoutPlayers(q, borrowedPlayerIds(finalNextB)));
      } else {
        finalNextA = build(nextABase, nextBBase?.avg_overall || 0, q);
        finalNextB = build(nextBBase, finalNextA?.avg_overall || 0, withoutPlayers(q, borrowedPlayerIds(finalNextA)));
      }

      return {
        ...prev,
        courtA: finalNextA,
        courtB: finalNextB,
        queue: q,
        scoreA: 0,
        scoreB: 0,
        consecutiveA: nextConsecutiveA,
        consecutiveB: nextConsecutiveB,
        matchNumber: prev.matchNumber + 1,
        showSaveModal: false,
        borrowCounts: newBorrowCounts,
        nextBorrow: null, // o próximo da fila ganha a sua escolha a seguir
        transitionMessage: message,
        transitionColor: winnerCourt.color_hex,
      };
    });
  };

  const lockMutation = useMutation({
    mutationFn: () => teamsService.lock(generation!.id),
    onSuccess: (res) => {
      localStorage.removeItem(storageKey);
      qc.invalidateQueries({ queryKey: ['team-generations-history'] });
      // Com várias quadras, só esta encerra; o circuito fecha quando a última terminar
      toast.success(res?.detail || 'Pelada encerrada e times trancados no histórico.');
      navigate('/teams');
    },
    onError: () => {
      toast.error('Erro ao encerrar a pelada.');
    }
  });

  // Com várias quadras no circuito, a tela mostra qual é; encerrar fecha só esta quadra (o circuito, na última)
  const courtLabel = generation && (generation.circuit_courts || 1) > 1 ? `Quadra ${generation.court}` : null;
  const otherCourtsOpen = !!generation && !generation.is_locked && (generation.open_courts || 1) > 1;

  const finishPelada = () => {
    setConfirmDialog({
      isOpen: true,
      title: otherCourtsOpen ? `Encerrar ${courtLabel}` : 'Encerrar Pelada e Circuito',
      desc: otherCourtsOpen
        ? 'O histórico desta quadra será salvo e trancado. As outras quadras continuam jogando; o circuito fecha quando a última terminar.'
        : 'Tem certeza que deseja encerrar? O circuito inteiro será finalizado, e o histórico será salvo e trancado.',
      onConfirm: () => {
        if (!generation?.is_locked) {
          lockMutation.mutate();
        } else {
          localStorage.removeItem(storageKey);
          navigate('/teams');
        }
      }
    });
  };

  if (isLoading) return <PageLoading />;
  if (error || !generation) return <ErrorState message="Geração não encontrada." />;

  const syncBar = (
    <CourtSyncBar
      courtLabel={courtLabel ?? 'Pelada'}
      color={COURT_COLORS[((generation.court || 1) - 1) % COURT_COLORS.length]}
      status={sync.status}
      notice={sync.notice}
      onDismissNotice={sync.dismissNotice}
      controller={sync.controller}
      isScorer={sync.isScorer}
      otherScorerActive={sync.otherScorerActive}
      seenAgoMs={sync.seenAgoMs}
      onTakeControl={() => setConfirmDialog({
        isOpen: true,
        title: 'Assumir o placar',
        desc: `${sync.controller?.name ?? 'Outra pessoa'} está marcando esta quadra em outro celular. Ao assumir, o placar passa a ser marcado aqui e o outro celular fica só acompanhando.`,
        onConfirm: () => {
          setConfirmDialog(s => ({ ...s, isOpen: false }));
          void sync.takeControl();
        },
      })}
    />
  );

  // Se a pelada já foi encerrada, mostra a tela read-only
  if (generation?.is_locked) {
    return (
      <div className="flex flex-col h-full space-y-4 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3 mt-4">
          <button onClick={() => navigate('/teams')} className="btn-ghost p-2 rounded-full hover:bg-surface border border-border">
            <ArrowLeft size={24} />
          </button>
          <h1 className="page-title mb-0">Histórico da Pelada</h1>
        </div>

        <div className="bg-red/10 border border-red/30 rounded-xl p-6 text-center space-y-2">
          <Lock size={32} className="text-red mx-auto mb-2" />
          <h2 className="font-display text-2xl text-red uppercase tracking-widest">Pelada Encerrada</h2>
          <p className="text-text-muted">As atividades desta pelada foram concluídas. Você pode conferir os jogos realizados abaixo.</p>
        </div>

        {matches.length > 0 ? (
          <div className="mt-8 space-y-4">
            <h3 className="font-display text-lg text-text-primary uppercase tracking-wider flex items-center gap-2">
              <Swords size={20} className="text-red" />
              Histórico desta Pelada
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.map((match: Match, idx: number) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  idx={idx}
                  isAdmin={isAdmin}
                  isDeleting={false}
                  expanded={expandedMatchId === match.id}
                  onToggle={() => setExpandedMatchId(expandedMatchId === match.id ? null : match.id)}
                  onDelete={() => {}}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center text-text-muted mt-4">
            <History size={48} className="mx-auto mb-4 opacity-50" />
            <p>Nenhuma partida foi registrada durante esta pelada.</p>
          </div>
        )}
      </div>
    );
  }

  // Tela Inicial (Sorteio)
  if (!state.isStarted) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => navigate('/teams')} className="btn-ghost p-2 rounded-full hover:bg-surface border border-border">
              <ArrowLeft size={24} />
            </button>
            <h1 className="page-title mb-0 flex items-center gap-2">
              <Shuffle className="text-red" />
              Sorteio Inicial{courtLabel ? ` · ${courtLabel}` : ''}
            </h1>
          </div>
          <p className="page-subtitle ml-14">Defina a ordem dos times para começar o chaveamento.</p>
        </div>

        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onOpenChange={(isOpen) => setConfirmDialog(s => ({ ...s, isOpen }))}
          title={confirmDialog.title}
          description={confirmDialog.desc}
          onConfirm={confirmDialog.onConfirm}
        />
        {syncBar}

        <div className="card p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-display text-lg tracking-wider">FILA DE ENTRADA</h2>
            <button onClick={shuffleQueue} disabled={readOnly} className="btn-ghost flex items-center gap-2 disabled:opacity-40">
              <RotateCcw size={16} /> Embaralhar
            </button>
          </div>

          <div className="space-y-3 mb-8">
            <AnimatePresence>
              {state.queue.map((team, idx) => (
                <motion.div
                  key={team.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center justify-between p-4 rounded-xl border ${idx < 2 ? 'border-red/50 bg-red/10' : 'border-border bg-surface'}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-display text-xl w-6 text-text-muted">{idx + 1}°</span>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team.color_hex }} />
                    <span className="font-bold text-lg" style={{ color: team.color_hex }}>{team.name.toUpperCase()}</span>
                    {idx < 2 && (
                      <span className="text-[10px] uppercase font-bold text-red bg-red/20 px-2 py-0.5 rounded-full ml-2 hidden sm:inline-block">
                        Joga 1°
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold opacity-50 mr-2 md:mr-4">{team.avg_overall.toFixed(1)}</span>
                    <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
                      <button 
                        onClick={() => moveInQueue(idx, 'top')} 
                        disabled={idx === 0 || readOnly}
                        className="p-1 rounded text-text-muted hover:bg-surface-hover hover:text-red disabled:opacity-20 transition-colors"
                        title="Mover para o topo"
                      >
                         <ChevronsUp size={16} />
                      </button>
                      <button 
                        onClick={() => moveInQueue(idx, 'up')} 
                        disabled={idx === 0 || readOnly}
                        className="p-1 rounded text-text-muted hover:bg-surface-hover hover:text-text-primary disabled:opacity-20 transition-colors"
                      >
                         <ArrowUp size={16} />
                      </button>
                      <button 
                        onClick={() => moveInQueue(idx, 'down')} 
                        disabled={idx === state.queue.length - 1 || readOnly}
                        className="p-1 rounded text-text-muted hover:bg-surface-hover hover:text-text-primary disabled:opacity-20 transition-colors"
                      >
                         <ArrowDown size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <button onClick={startPelada} disabled={readOnly} className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-40">
            <Trophy size={20} />
            Iniciar Pelada
          </button>
        </div>
      </div>
    );
  }

  // Tela de Transição de Fim de Jogo
  if (state.transitionMessage) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center max-w-3xl mx-auto space-y-8 p-6 py-20">
        <Trophy size={80} style={{ color: state.transitionColor || '#fff' }} className="mb-4 animate-bounce" />
        <h1 className="font-display text-4xl md:text-5xl leading-tight" style={{ color: state.transitionColor || '#fff' }}>
          {state.transitionMessage}
        </h1>
        <p className="text-text-muted text-lg md:text-xl">A quadra foi atualizada para a próxima partida.</p>
        <button 
          onClick={() => setState(s => ({ ...s, transitionMessage: null, transitionColor: null }))}
          className="btn-primary py-5 px-10 text-2xl font-bold flex items-center gap-3 w-full md:w-auto justify-center shadow-lg"
        >
          <Play size={28} /> Próximo Jogo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 max-w-7xl mx-auto w-full">
      <SyncButton 
        onSync={() => {
          qc.invalidateQueries({ queryKey: ['team-generation', id] });
          qc.invalidateQueries({ queryKey: ['gameday', generation?.gameday] });
          toast.success('Placar sincronizado!');
        }} 
      />

      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        onOpenChange={(isOpen) => setConfirmDialog(s => ({ ...s, isOpen }))}
        title={confirmDialog.title}
        description={confirmDialog.desc}
        onConfirm={confirmDialog.onConfirm}
      />

      <div className="flex items-center justify-between">
        <div className="flex-1 flex gap-2">
          <button onClick={() => navigate('/teams')} className="btn-ghost p-2 rounded-full hover:bg-surface border border-border" title="Voltar">
            <ArrowLeft size={24} />
          </button>
          
          {generation.gameday && (
            <button onClick={() => setShowCheckinModal(true)} className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm rounded-lg border-border" title="Tiragem de Falta">
              <UserCheck size={18} className="text-red" />
              <span className="hidden md:inline font-bold">Tiragem de Falta</span>
            </button>
          )}
        </div>
        <div className="text-center flex-1 min-w-[200px]">
          {/* Visível também no celular: cada operador precisa saber em que quadra está */}
          {courtLabel && (
            <p className="font-display text-xs md:text-sm tracking-[0.3em] text-red uppercase mb-1">{courtLabel}</p>
          )}
          <h1 className="font-display text-2xl md:text-4xl tracking-widest text-text-primary uppercase flex items-center justify-center gap-3">
            <Swords className="text-red hidden md:block" />
            JOGO {state.matchNumber}
            <Swords className="text-red hidden md:block" />
          </h1>
          <p className="text-sm md:text-base text-text-muted hidden md:block mt-1">Pelada de Vôlei — {state.queue.length + 2} times</p>
        </div>
        <div className="flex-1 flex justify-end">
          <button onClick={finishPelada} className="btn-ghost text-text-muted hover:text-red hover:bg-red/10 flex items-center gap-2 px-3 py-2 text-sm rounded-lg">
            <Power size={18} />
            <span className="hidden md:inline font-bold">{otherCourtsOpen ? `Encerrar ${courtLabel}` : 'Encerrar Pelada e Circuito'}</span>
          </button>
        </div>
      </div>

      {syncBar}

      {/* Banner de Arbitragem */}
      {state.queue.length > 0 && (
        <div 
          className="card p-3 flex flex-wrap items-center justify-center gap-2 border-l-4 border-red shadow-lg bg-surface/80"
          style={{ borderLeftColor: state.queue[0].color_hex }}
        >
          <Shield size={20} className="text-yellow-400" />
          <span className="font-bold text-sm md:text-base text-text-primary uppercase tracking-widest text-center">
            Arbitragem (Rede / Marcação):
          </span>
          <span className="font-bold text-sm md:text-base text-center flex items-center gap-2" style={{ color: state.queue[0].color_hex }}>
            {state.queue[0].name.toUpperCase()}
            {borrowedQueue0 && borrowedQueue0.team_players.length > state.queue[0].team_players.length && (
              <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20 font-bold hidden sm:inline-block">
                +{borrowedQueue0.team_players.length - state.queue[0].team_players.length} p/ entrar
              </span>
            )}
          </span>
        </div>
      )}

      {/* Arena — Placar Gigante */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 flex-1">
        
        {/* Court A */}
        <CourtScoreboard
          team={state.courtA}
          score={state.scoreA}
          consecutive={state.consecutiveA}
          onUpdateScore={(delta) => updateScore('A', delta)}
          disabled={readOnly}
        />

        {/* VS Separator (Desktop) */}
        <div className="hidden md:flex flex-col items-center justify-center px-4">
          <span className="font-display text-2xl text-text-muted tracking-widest mb-4">VS</span>
          <Swords size={56} className="text-border" />
        </div>

        {/* Court B */}
        <CourtScoreboard
          team={state.courtB}
          score={state.scoreB}
          consecutive={state.consecutiveB}
          isReversed
          onUpdateScore={(delta) => updateScore('B', delta)}
          disabled={readOnly}
        />

      </div>

      <div className="flex flex-col-reverse md:flex-row justify-center items-center mt-6 gap-4">
        <button 
          onClick={cancelMatch}
          disabled={readOnly}
          className="btn-secondary w-full md:w-auto px-6 py-4 text-sm md:text-base font-bold flex items-center justify-center gap-2 border-border hover:border-red hover:text-red transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-inherit"
        >
          <RotateCcw size={20} />
          Cancelar Jogo
        </button>

        <button 
          onClick={() => setState(s => ({ ...s, showSaveModal: true }))}
          disabled={readOnly}
          className="btn-primary w-full md:w-auto md:px-24 py-5 md:py-6 text-xl md:text-3xl font-bold flex items-center justify-center gap-4 shadow-neon-red shadow-red/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trophy size={32} />
          Confirmar Resultado
        </button>
      </div>

      {/* Fila */}
      {state.queue.length > 0 && (
        <div className="card p-5 mt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
              <ArrowRightLeft size={16} /> Na fila de espera
            </h3>
            
            {/* Botão de Auto-alocar (Vem da Quadra) */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={shuffleQueue} disabled={readOnly} className="btn-ghost flex items-center gap-2 text-xs py-2 px-3 border border-border hover:bg-surface rounded-lg disabled:opacity-40">
                <RotateCcw size={14} /> Embaralhar Fila
              </button>
              {(() => {
                if (!generation?.gameday) return null;
                
                const unassignedCount = generation.waiting_players?.length || 0;

                if (unassignedCount > 0 && !generation.is_locked) {
                  return (
                    <button 
                      onClick={() => autoAllocateMutation.mutate(generation.id)}
                      disabled={autoAllocateMutation.isPending}
                      className="text-xs bg-red text-white hover:bg-red/90 px-3 py-2 rounded-lg font-bold uppercase shadow-neon-red flex items-center gap-2 transition-all w-full sm:w-auto justify-center"
                      title="Alocar jogadores na fila"
                    >
                      <Zap size={14} />
                      Completar Vagas ({unassignedCount} aguardando)
                    </button>
                  );
                }
                return null;
              })()}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {state.queue.map((team, idx) => {
              const displayTeam = (idx === 0 && borrowedQueue0) ? borrowedQueue0 : team;
              return (
              <div key={team.id} className="flex flex-col justify-center bg-surface border border-border rounded-xl px-4 py-3 relative group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    <span className="text-text-muted font-bold text-sm md:text-base">{idx + 1}°</span>
                    <div className="w-4 h-4 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: team.color_hex }} />
                    <span className="text-sm md:text-lg font-bold truncate" style={{ color: team.color_hex }}>{team.name}</span>
                  </div>
                  
                  {/* Botões de movimentação */}
                  <div className="flex gap-1 bg-background/50 border border-border rounded-lg p-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => moveInQueue(idx, 'top')} 
                        disabled={idx === 0 || readOnly}
                        className="p-1 rounded text-text-muted hover:bg-surface-hover hover:text-red disabled:opacity-20 transition-colors"
                        title="Mover para o topo"
                      >
                         <ChevronsUp size={14} />
                      </button>
                      <button 
                        onClick={() => moveInQueue(idx, 'up')} 
                        disabled={idx === 0 || readOnly}
                        className="p-1 rounded text-text-muted hover:bg-surface-hover hover:text-text-primary disabled:opacity-20 transition-colors"
                      >
                         <ArrowUp size={14} />
                      </button>
                      <button 
                        onClick={() => moveInQueue(idx, 'down')} 
                        disabled={idx === state.queue.length - 1 || readOnly}
                        className="p-1 rounded text-text-muted hover:bg-surface-hover hover:text-text-primary disabled:opacity-20 transition-colors"
                      >
                         <ArrowDown size={14} />
                      </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {displayTeam.team_players.map((p: any) => (
                    <span key={p.player} className={`text-[10px] px-2 py-0.5 rounded-full border truncate max-w-full flex items-center gap-1 ${p.is_borrowed ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'text-text-muted bg-background/50 border-border/50'}`}>
                      {p.player_name}
                      {p.is_borrowed && <span className="text-[9px] uppercase font-bold opacity-80">(Emp)</span>}
                    </span>
                  ))}
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {/* Histórico da Pelada */}
      {matches.length > 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="font-display text-lg text-text-primary uppercase tracking-wider flex items-center gap-2">
            <Swords size={20} className="text-red" />
            Histórico desta Pelada
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map((match: Match, idx: number) => (
              <MatchCard
                key={match.id}
                match={match}
                idx={idx}
                isAdmin={isAdmin}
                isDeleting={false}
                expanded={expandedMatchId === match.id}
                onToggle={() => setExpandedMatchId(expandedMatchId === match.id ? null : match.id)}
                onDelete={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal Salvar Resultado */}
      <SaveMatchModal
        isOpen={state.showSaveModal}
        onClose={() => setState(s => ({ ...s, showSaveModal: false }))}
        onSave={handleSaveResult}
        isSaving={saveMutation.isPending}
        courtA={state.courtA}
        courtB={state.courtB}
        scoreA={state.scoreA}
        scoreB={state.scoreB}
      />

      {generation.gameday && (
        <CourtCheckinModal
          gamedayId={generation.gameday}
          isOpen={showCheckinModal}
          onClose={() => setShowCheckinModal(false)}
        />
      )}
    </div>
  );
}
