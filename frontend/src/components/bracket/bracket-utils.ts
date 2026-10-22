import type { DBTeam, CourtTeam } from '@/types';

/**
 * Regra do rodízio (vale para 2x2, 3x3, 4x4...): quem ganha 2 seguidas sai da quadra só se houver
 * 2 times completos esperando fora. Senão, o vencedor continua até perder.
 * `waitingTeams` são os times que estavam fora durante a partida (a fila). Time que emprestou jogador
 * para quem está em quadra (`lentPlayerIds`) não está completo lá fora.
 */
export function winnerMustLeave(
  winnerConsecutive: number,
  waitingTeams: DBTeam[],
  modality: number,
  lentPlayerIds: Set<number> = new Set(),
): boolean {
  const completeWaiting = waitingTeams.filter(
    (t) => t.team_players.filter((p) => !lentPlayerIds.has(p.player)).length >= modality,
  ).length;
  return winnerConsecutive >= 2 && completeWaiting >= 2;
}

/** Jogadores emprestados nos times em quadra. */
export function borrowedPlayerIds(...teams: Array<CourtTeam | null | undefined>): Set<number> {
  return new Set(teams.flatMap((t) => (t?.team_players || []).filter((p) => p.is_borrowed).map((p) => p.player)));
}

/** Times da fila sem os jogadores indicados (ex.: já emprestados para o outro lado da quadra). */
export function withoutPlayers(teams: DBTeam[], playerIds: Set<number>): DBTeam[] {
  if (playerIds.size === 0) return teams;
  return teams.map((t) => ({ ...t, team_players: t.team_players.filter((p) => !playerIds.has(p.player)) }));
}

/**
 * Completa o time com emprestados mantendo primeiro quem já tinha sido escolhido (`keep`): quem a fila mostrou
 * como "vai entrar emprestado" é quem entra. Só escolhe outro para a vaga de quem não está mais disponível
 * (o time dele entrou em quadra ou ele saiu da pelada) ou quando falta mais gente.
 */
export function borrowKeeping(
  team: DBTeam,
  keep: number[],
  opposingAvg: number,
  modality: number,
  availableTeams: DBTeam[],
  borrowCounts: Record<number, number> = {},
): CourtTeam {
  const needed = modality - team.team_players.length;
  const kept: Array<CourtTeam['team_players'][number] & { original_team_id: number }> = [];
  for (const id of keep) {
    if (kept.length >= needed) break;
    for (const t of availableTeams) {
      const found = t.team_players.find((p) => p.player === id);
      if (found) {
        kept.push({ ...found, is_borrowed: true, original_team_id: t.id });
        break;
      }
    }
  }
  if (kept.length === 0) return borrowPlayersForTeam(team, opposingAvg, modality, availableTeams, borrowCounts);

  // Os mantidos entram como se já fossem do time; o algoritmo só completa o que ainda faltar
  const keptIds = new Set(kept.map((p) => p.player));
  const base: DBTeam = { ...team, team_players: [...team.team_players, ...kept] };
  const rest = borrowPlayersForTeam(base, opposingAvg, modality, withoutPlayers(availableTeams, keptIds), borrowCounts);
  const players = rest.team_players.map((p) => kept.find((k) => k.player === p.player) ?? p);
  const sum = players.reduce((acc, p) => acc + (Number(p.player_overall) || 0), 0);
  return { ...rest, team_players: players, avg_overall: players.length ? sum / players.length : 0 };
}

interface RotationInput {
  winner: DBTeam | null; // null: o time foi excluído no meio do jogo (ex.: Embaralhar com menos times)
  loser: DBTeam | null;
  winnerIsA: boolean;
  winnerConsecutive: number;
  queue: DBTeam[]; // quem estava esperando durante a partida
  modality: number;
  lentPlayerIds?: Set<number>; // quem jogou emprestado na partida que acabou
}

/** Quem entra na próxima partida e como fica a fila, pela regra do rodízio. */
export function rotateAfterMatch({ winner, loser, winnerIsA, winnerConsecutive, queue, modality, lentPlayerIds }: RotationInput) {
  const q = [...queue];
  if (winnerMustLeave(winnerConsecutive, queue, modality, lentPlayerIds)) {
    const first = q.shift() || null; // entram os dois que estavam esperando
    const second = q.shift() || null;
    if (winner) q.unshift(winner); // vencedor é o próximo a entrar
    if (loser) q.push(loser); // perdedor vai para o fim da fila
    return { nextA: first, nextB: second, queue: q, winnerLeft: true, winnerStays: false };
  }
  if (loser) q.push(loser);
  const stays = winner ?? q.shift() ?? null;
  const challenger = q.shift() || null;
  return {
    nextA: winnerIsA ? stays : challenger,
    nextB: winnerIsA ? challenger : stays,
    queue: q,
    winnerLeft: false,
    winnerStays: !!winner,
  };
}

// Algoritmo de empréstimo para balancear o overall do time que está precisando
export function borrowPlayersForTeam(
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
