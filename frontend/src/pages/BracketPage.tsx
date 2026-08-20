import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, Swords, Shield, Zap, Star, Shuffle, Save, ArrowRightLeft, RotateCcw, Power, Play, Lock, History, ClipboardList, Target, UserCheck, Hand, Flame, ArrowUp, ArrowDown, ChevronsUp, RefreshCw } from 'lucide-react';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { SyncButton } from '@/components/ui/SyncButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { teamsService, matchesService, attendanceService } from '@/services';
import type { DBTeam, QuickMatchData, Modality, Match, CourtTeam } from '@/types';
import toast from 'react-hot-toast';
import { MatchCard } from '@/components/matches/MatchCard';
import { CourtCheckinModal } from '@/components/attendance/CourtCheckinModal';
import { useAuth } from '@/store/AuthContext';

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
}

// Algoritmo de empréstimo para balancear o overall do time que está precisando
function borrowPlayersForTeam(
  team: DBTeam,
  opposingAvg: number,
  modality: number,
  availableTeams: DBTeam[],
  borrowCounts: Record<number, number> = {}
): CourtTeam {
  const needed = modality - team.team_players.length;
  const courtTeam: CourtTeam = {
    ...team,
    team_players: team.team_players.map(p => ({ ...p, is_borrowed: false }))
  };

  if (needed <= 0 || availableTeams.length === 0) return courtTeam;

  let candidates: any[] = [];
  if (availableTeams.length === 1) {
    // Se só tem 1 time na fila (total de 3 times), pega dele mesmo (o time que acabou de perder)
    candidates = [...availableTeams[0].team_players.map(p => ({
       ...p,
       is_borrowed: true,
       original_team_id: availableTeams[0].id 
    }))];
  } else {
    // Se passa de 4 times (2 na fila), não pega de quem acabou de sair (o último da fila). Pega do início.
    for (let i = 0; i < availableTeams.length - 1; i++) {
      candidates = [...candidates, ...availableTeams[i].team_players.map(p => ({
         ...p,
         is_borrowed: true,
         original_team_id: availableTeams[i].id 
      }))];
      if (candidates.length >= needed * 2) break; // Pegar um pouco mais para ter opções de balanceamento
    }
  }
  
  if (candidates.length === 0) return courtTeam;

  // Encontrar todas as combinações
  const getCombinations = (arr: any[], k: number): any[][] => {
    if (k === 1) return arr.map(a => [a]);
    const combs: any[][] = [];
    for (let i = 0; i < arr.length - k + 1; i++) {
      const head = arr.slice(i, i + 1);
      const tailCombs = getCombinations(arr.slice(i + 1), k - 1);
      tailCombs.forEach(tc => combs.push([...head, ...tc]));
    }
    return combs;
  };
  
  const combinations = getCombinations(candidates, Math.min(needed, candidates.length));
  
  let bestComb: any[] = [];
  let minScore = Infinity;
  const currentSum = team.team_players.reduce((acc, p) => acc + p.player_overall, 0);
  const targetAvg = opposingAvg || team.avg_overall; // Se não tiver adversário definido, tenta manter a própria média
  
  for (const comb of combinations) {
    const combSum = comb.reduce((acc, p) => acc + p.player_overall, 0);
    const newAvg = (currentSum + combSum) / (team.team_players.length + comb.length);
    const diff = Math.abs(newAvg - targetAvg);
    
    // Penalizar fortemente a pessoa que já foi emprestada muitas vezes
    const repeatedCount = comb.reduce((acc, p) => acc + (borrowCounts[p.player] || 0), 0);
    const score = diff + (repeatedCount * 2); 
    
    if (score < minScore) {
      minScore = score;
      bestComb = comb;
    }
  }
  
  courtTeam.team_players = [...courtTeam.team_players, ...bestComb];
  courtTeam.avg_overall = (currentSum + bestComb.reduce((acc, p) => acc + p.player_overall, 0)) / courtTeam.team_players.length;
  
  return courtTeam;
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

  const { data: gamedayData } = useQuery({
    queryKey: ['gameday', generation?.gameday],
    queryFn: () => attendanceService.getGameDay(generation!.gameday),
    enabled: !!generation?.gameday,
  });

  const autoAllocateMutation = useMutation({
    mutationFn: (genId: number) => teamsService.autoAllocate(genId),
    onSuccess: (res) => {
       qc.invalidateQueries({ queryKey: ['team-generation', Number(id)] });
       toast.success(res.detail || 'Jogadores alocados com sucesso!');
    }
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

  // Sincronização ao vivo de jogadores nos times e novos times
  useEffect(() => {
    if (generation) {
      setState(prev => {
        let changed = false;
        
        const syncTeam = (t: CourtTeam | null) => {
          if (!t) return null;
          const freshTeam = generation.teams.find((genT: any) => genT.id === t.id);
          if (!freshTeam) {
            changed = true;
            return null; // Time foi excluído
          }
          // Preservar jogadores emprestados, mas remover excessos se o time foi completado manualmente
          let borrowed = t.team_players.filter(p => p.is_borrowed);
          const needed = Math.max(0, generation.modality - freshTeam.team_players.length);
          borrowed = borrowed.slice(0, needed);
          
          const newPlayers = [...freshTeam.team_players.map((p: any) => ({ ...p, is_borrowed: false })), ...borrowed];
          
          if (JSON.stringify(newPlayers) !== JSON.stringify(t.team_players)) {
            changed = true;
            return { ...t, team_players: newPlayers, avg_overall: t.avg_overall }; // mantem o avg_overall calculado
          }
          return t;
        };

        const syncQueueTeam = (t: DBTeam) => {
           const freshTeam = generation.teams.find((genT: any) => genT.id === t.id);
           if (!freshTeam) { changed = true; return null; }
           if (JSON.stringify(freshTeam.team_players) !== JSON.stringify(t.team_players)) {
             changed = true;
             return { ...t, team_players: freshTeam.team_players, avg_overall: freshTeam.avg_overall };
           }
           return t;
        };

        const newCourtA = syncTeam(prev.courtA);
        const newCourtB = syncTeam(prev.courtB);
        let newQueue = prev.queue.map(syncQueueTeam).filter(Boolean) as DBTeam[];

        if (prev.queue.length !== newQueue.length) changed = true;
        if (prev.courtA !== null && newCourtA === null) changed = true;
        if (prev.courtB !== null && newCourtB === null) changed = true;

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
    setState(prev => {
      const newQueue = [...prev.queue].sort(() => Math.random() - 0.5);
      return { ...prev, queue: newQueue };
    });
  };

  const moveInQueue = (index: number, direction: 'up' | 'down' | 'top') => {
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

  const borrowedQueue0 = useMemo(() => {
    if (state.queue.length === 0 || !generation) return null;
    return borrowPlayersForTeam(state.queue[0], 0, generation.modality, state.queue.slice(1), state.borrowCounts);
  }, [state.queue, generation, state.borrowCounts]);

  const startPelada = () => {
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
      courtB = borrowPlayersForTeam(prev.queue[1], courtA.avg_overall, generation!.modality, q, prev.borrowCounts);
      
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
    setState(prev => {
      const q = [...prev.queue];
      const winnerIsA = prev.scoreA > prev.scoreB;
      const winnerCourt = winnerIsA ? prev.courtA! : prev.courtB!;
      const loserCourt = winnerIsA ? prev.courtB! : prev.courtA!;
      
      // Limpar os jogadores emprestados para que retornem aos seus times de origem na fila
      const stripTeam = (t: CourtTeam): DBTeam => ({
         ...t,
         team_players: t.team_players.filter(p => !p.is_borrowed)
      });
      const winner = stripTeam(winnerCourt);
      const loser = stripTeam(loserCourt);

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

      const totalTeams = prev.queue.length + 2;
      
      const allTeamsInPelada = [winnerCourt, loserCourt, ...prev.queue];
      const getBaseLength = (t: CourtTeam) => t.team_players.filter(p => !p.is_borrowed).length;
      const totalCompleteTeams = allTeamsInPelada.filter(t => getBaseLength(t as CourtTeam) >= generation!.modality).length;
      
      const winnerMustLeave = winnerConsecutive >= 2 && totalCompleteTeams >= 4;

      let nextABase: DBTeam | null = null;
      let nextBBase: DBTeam | null = null;
      let nextConsecutiveA = 0;
      let nextConsecutiveB = 0;

      let message = '';
      if (winnerMustLeave) {
        message = `${winner.name.toUpperCase()} atingiu 2 vitórias seguidas e dá lugar na quadra!`;
        
        if (totalTeams === 3) {
          q.unshift(winner); // Vencedor vira o próximo da fila
          nextABase = loser;     // Quem perdeu continua para jogar com quem tava de fora
          nextBBase = q.pop() || null; // Entra quem tava de fora
        } else {
          nextABase = q.shift() || null;
          nextBBase = q.shift() || null;
          q.unshift(winner); // Vencedor vira o próximo da fila (1º de fora)
          q.push(loser);     // Perdedor vai pro final da fila
        }
      } else {
        message = `${winner.name.toUpperCase()} venceu e continua na quadra!`;
        q.push(loser);
        if (winnerIsA) {
          nextABase = winner;
          nextBBase = q.shift() || null;
          nextConsecutiveA = newConsecutiveA;
        } else {
          nextBBase = winner;
          nextABase = q.shift() || null;
          nextConsecutiveB = newConsecutiveB;
        }
      }

      // Aplicar o empréstimo nos times que vão entrar, usando a fila ATUALIZADA (q) e os novos contadores
      let finalNextA: CourtTeam | null = null;
      let finalNextB: CourtTeam | null = null;

      if (nextABase) {
         finalNextA = borrowPlayersForTeam(nextABase, nextBBase?.avg_overall || 0, generation!.modality, q, newBorrowCounts);
      }
      if (nextBBase) {
         finalNextB = borrowPlayersForTeam(nextBBase, finalNextA?.avg_overall || 0, generation!.modality, q, newBorrowCounts);
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
        transitionMessage: message,
        transitionColor: winner.color_hex,
      };
    });
  };

  const lockMutation = useMutation({
    mutationFn: () => teamsService.lock(generation!.id),
    onSuccess: () => {
      localStorage.removeItem(storageKey);
      qc.invalidateQueries({ queryKey: ['team-generations-history'] });
      toast.success('Pelada encerrada e times trancados no histórico.');
      navigate('/teams');
    },
    onError: () => {
      toast.error('Erro ao encerrar a pelada.');
    }
  });

  const finishPelada = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Encerrar Pelada e Circuito',
      desc: 'Tem certeza que deseja encerrar? O circuito inteiro será finalizado, e o histórico será salvo e trancado.',
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
              Sorteio Inicial
            </h1>
          </div>
          <p className="page-subtitle ml-14">Defina a ordem dos times para começar o chaveamento.</p>
        </div>

        <div className="card p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-display text-lg tracking-wider">FILA DE ENTRADA</h2>
            <button onClick={shuffleQueue} className="btn-ghost flex items-center gap-2">
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
                        disabled={idx === 0}
                        className="p-1 rounded text-text-muted hover:bg-surface-hover hover:text-red disabled:opacity-20 transition-colors"
                        title="Mover para o topo"
                      >
                         <ChevronsUp size={16} />
                      </button>
                      <button 
                        onClick={() => moveInQueue(idx, 'up')} 
                        disabled={idx === 0}
                        className="p-1 rounded text-text-muted hover:bg-surface-hover hover:text-text-primary disabled:opacity-20 transition-colors"
                      >
                         <ArrowUp size={16} />
                      </button>
                      <button 
                        onClick={() => moveInQueue(idx, 'down')} 
                        disabled={idx === state.queue.length - 1}
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

          <button onClick={startPelada} className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2">
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

  const allPlayersInCourt = [...(state.courtA?.team_players || []), ...(state.courtB?.team_players || [])];

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
            <span className="hidden md:inline font-bold">Encerrar Pelada e Circuito</span>
          </button>
        </div>
      </div>

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
        <div className="flex-1 card flex flex-col overflow-hidden relative" style={{ borderColor: `${state.courtA?.color_hex}40` }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundColor: state.courtA?.color_hex }} />
          
          <div className="relative z-10 p-6 md:p-10 flex flex-col h-full">
            <div className="flex items-start justify-between mb-2">
              <div className="flex flex-col min-w-0 pr-2 flex-1">
                <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold truncate tracking-wider w-full" style={{ color: state.courtA?.color_hex }}>
                  {state.courtA?.name.toUpperCase()}
                </h2>
                <div className="flex flex-wrap gap-1 mt-1 w-full">
                  {state.courtA?.team_players.map((p: any) => (
                    <span key={p.player} className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full border truncate max-w-[100px] sm:max-w-[150px] flex items-center gap-1 ${p.is_borrowed ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'text-text-muted bg-surface/50 border-border/50'}`}>
                      {p.player_name}
                      {p.is_borrowed && <span className="text-[9px] uppercase font-bold opacity-80">(Emp)</span>}
                    </span>
                  ))}
                </div>
              </div>
              {state.consecutiveA > 0 && (
                <div className="flex text-yellow-400 flex-shrink-0 mt-1" title={`${state.consecutiveA} vitórias seguidas. Na 2ª, também sai!`}>
                  {Array.from({ length: state.consecutiveA }).map((_, i) => <Star key={i} size={24} className="fill-yellow-400 sm:w-8 sm:h-8" />)}
                  {state.consecutiveA === 1 && <Star size={24} className="opacity-20 sm:w-8 sm:h-8" />}
                </div>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center py-4 md:py-8 lg:py-12">
              <span className="text-[7rem] sm:text-[10rem] lg:text-[18rem] leading-none font-display font-bold tabular-nums tracking-tighter" style={{ color: state.courtA?.color_hex }}>
                {state.scoreA}
              </span>
            </div>

            <div className="flex gap-2 sm:gap-4 md:gap-8 mt-auto">
              <button onClick={() => updateScore('A', -1)} className="flex-1 h-16 sm:h-20 md:h-28 rounded-xl sm:rounded-2xl md:rounded-3xl bg-surface/80 hover:bg-surface border border-border text-4xl sm:text-5xl md:text-7xl font-bold text-text-muted transition-colors active:scale-95">
                -
              </button>
              <button onClick={() => updateScore('A', 1)} className="flex-[1.5] sm:flex-1 h-16 sm:h-20 md:h-28 rounded-xl sm:rounded-2xl md:rounded-3xl bg-surface/80 hover:bg-surface border text-4xl sm:text-5xl md:text-8xl font-bold transition-colors active:scale-95 shadow-lg flex items-center justify-center" style={{ borderColor: `${state.courtA?.color_hex}80`, color: state.courtA?.color_hex }}>
                +
              </button>
            </div>
          </div>
        </div>

        {/* VS Separator (Desktop) */}
        <div className="hidden md:flex flex-col items-center justify-center px-4">
          <span className="font-display text-2xl text-text-muted tracking-widest mb-4">VS</span>
          <Swords size={56} className="text-border" />
        </div>

        {/* Court B */}
        <div className="flex-1 card flex flex-col overflow-hidden relative" style={{ borderColor: `${state.courtB?.color_hex}40` }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundColor: state.courtB?.color_hex }} />
          
          <div className="relative z-10 p-6 md:p-10 flex flex-col h-full">
            <div className="flex items-start justify-between mb-2 flex-row-reverse">
              <div className="flex flex-col min-w-0 pl-2 flex-1">
                <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold truncate text-right tracking-wider w-full" style={{ color: state.courtB?.color_hex }}>
                  {state.courtB?.name.toUpperCase()}
                </h2>
                <div className="flex flex-wrap justify-end gap-1 mt-1 w-full">
                  {state.courtB?.team_players.map((p: any) => (
                    <span key={p.player} className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full border truncate max-w-[100px] sm:max-w-[150px] flex items-center gap-1 flex-row-reverse ${p.is_borrowed ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'text-text-muted bg-surface/50 border-border/50'}`}>
                      {p.player_name}
                      {p.is_borrowed && <span className="text-[9px] uppercase font-bold opacity-80">(Emp)</span>}
                    </span>
                  ))}
                </div>
              </div>
              {state.consecutiveB > 0 && (
                <div className="flex text-yellow-400 flex-row-reverse flex-shrink-0 mt-1" title={`${state.consecutiveB} vitórias seguidas. Na 2ª, também sai!`}>
                  {Array.from({ length: state.consecutiveB }).map((_, i) => <Star key={i} size={24} className="fill-yellow-400 sm:w-8 sm:h-8" />)}
                  {state.consecutiveB === 1 && <Star size={24} className="opacity-20 sm:w-8 sm:h-8" />}
                </div>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center py-4 md:py-8 lg:py-12">
              <span className="text-[7rem] sm:text-[10rem] lg:text-[18rem] leading-none font-display font-bold tabular-nums tracking-tighter" style={{ color: state.courtB?.color_hex }}>
                {state.scoreB}
              </span>
            </div>

            <div className="flex gap-2 sm:gap-4 md:gap-8 mt-auto">
              <button onClick={() => updateScore('B', -1)} className="flex-1 h-16 sm:h-20 md:h-28 rounded-xl sm:rounded-2xl md:rounded-3xl bg-surface/80 hover:bg-surface border border-border text-4xl sm:text-5xl md:text-7xl font-bold text-text-muted transition-colors active:scale-95">
                -
              </button>
              <button onClick={() => updateScore('B', 1)} className="flex-[1.5] sm:flex-1 h-16 sm:h-20 md:h-28 rounded-xl sm:rounded-2xl md:rounded-3xl bg-surface/80 hover:bg-surface border text-4xl sm:text-5xl md:text-8xl font-bold transition-colors active:scale-95 shadow-lg flex items-center justify-center" style={{ borderColor: `${state.courtB?.color_hex}80`, color: state.courtB?.color_hex }}>
                +
              </button>
            </div>
          </div>
        </div>

      </div>

      <div className="flex flex-col-reverse md:flex-row justify-center items-center mt-6 gap-4">
        <button 
          onClick={cancelMatch}
          className="btn-secondary w-full md:w-auto px-6 py-4 text-sm md:text-base font-bold flex items-center justify-center gap-2 border-border hover:border-red hover:text-red transition-all"
        >
          <RotateCcw size={20} />
          Cancelar Jogo
        </button>

        <button 
          onClick={() => setState(s => ({ ...s, showSaveModal: true }))}
          className="btn-primary w-full md:w-auto md:px-24 py-5 md:py-6 text-xl md:text-3xl font-bold flex items-center justify-center gap-4 shadow-neon-red shadow-red/20"
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
              <button onClick={shuffleQueue} className="btn-ghost flex items-center gap-2 text-xs py-2 px-3 border border-border hover:bg-surface rounded-lg">
                <RotateCcw size={14} /> Embaralhar Fila
              </button>
              {(() => {
                if (!generation?.gameday) return null;
                
                const checkinCount = gamedayData?.total_court_checkins || 0;
                const playersInGen = generation.teams.reduce((acc: number, t: any) => acc + t.team_players.length, 0);
                const unassignedCount = Math.max(0, checkinCount - playersInGen);

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
                        disabled={idx === 0}
                        className="p-1 rounded text-text-muted hover:bg-surface-hover hover:text-red disabled:opacity-20 transition-colors"
                        title="Mover para o topo"
                      >
                         <ChevronsUp size={14} />
                      </button>
                      <button 
                        onClick={() => moveInQueue(idx, 'up')} 
                        disabled={idx === 0}
                        className="p-1 rounded text-text-muted hover:bg-surface-hover hover:text-text-primary disabled:opacity-20 transition-colors"
                      >
                         <ArrowUp size={14} />
                      </button>
                      <button 
                        onClick={() => moveInQueue(idx, 'down')} 
                        disabled={idx === state.queue.length - 1}
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
      <AnimatePresence>
        {state.showSaveModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 md:p-8 border-b border-border bg-surface/50">
                <h2 className="font-display text-3xl mb-1 text-text-primary">Confirmar Resultado</h2>
                <p className="text-sm text-text-muted">Revise o placar final e, se quiser, escolha os destaques da partida.</p>
              </div>

              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex flex-col items-center">
                {/* Placar Final */}
                <div className="flex justify-center items-center gap-8 mb-10 w-full bg-surface p-6 rounded-2xl border border-border shadow-inner">
                  <div className="text-center w-1/3">
                    <span className="block text-sm md:text-base font-bold mb-2 uppercase tracking-wider truncate" style={{ color: state.courtA?.color_hex }}>{state.courtA?.name}</span>
                    <span className={`text-6xl md:text-7xl font-display font-bold ${state.scoreA >= state.scoreB ? 'text-yellow-400' : 'text-text-muted'}`}>{state.scoreA}</span>
                  </div>
                  <span className="text-text-muted text-2xl font-display opacity-50 flex-shrink-0">X</span>
                  <div className="text-center w-1/3">
                    <span className="block text-sm md:text-base font-bold mb-2 uppercase tracking-wider truncate" style={{ color: state.courtB?.color_hex }}>{state.courtB?.name}</span>
                    <span className={`text-6xl md:text-7xl font-display font-bold ${state.scoreB >= state.scoreA ? 'text-yellow-400' : 'text-text-muted'}`}>{state.scoreB}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-6 border-t border-border bg-surface/50 flex gap-4">
                <button
                  className="btn-secondary flex-1 py-4 text-lg font-bold"
                  onClick={() => setState(s => ({ ...s, showSaveModal: false }))}
                  disabled={saveMutation.isPending}
                >
                  Voltar
                </button>
                <button
                  className="btn-primary flex-[2] flex items-center justify-center gap-2 py-4 text-lg font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                  onClick={handleSaveResult}
                  disabled={saveMutation.isPending}
                >
                  <Save size={20} />
                  {saveMutation.isPending ? 'Salvando...' : 'Confirmar Resultado'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
