import type { DBTeam, CourtTeam } from '@/types';

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
