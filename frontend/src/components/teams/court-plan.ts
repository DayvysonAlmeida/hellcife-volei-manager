/** Até quantos atletas por quadra a sugestão considera confortável (dias de evento: 16 a 20 por quadra). */
const COMFORT_PER_COURT = 20;
const MAX_COURTS = 3;

/** Cor de cada quadra nos cabeçalhos (as mesmas do Time Vermelho, Azul e Verde). */
export const COURT_COLORS = ['#D90429', '#2563EB', '#16A34A'];

export interface CourtOption {
  courts: number;
  /** Dá para sortear: pelo menos 2 times por quadra. */
  ok: boolean;
  minimum: number;
  teamsPerCourt: number[];
}

/** O que sai com 1, 2 ou 3 quadras: quantos times em cada, ou quantos atletas são precisos. */
export function courtOptions(players: number, modality: number): CourtOption[] {
  const teams = Math.ceil(players / modality);
  return Array.from({ length: MAX_COURTS }, (_, i) => {
    const courts = i + 1;
    const base = Math.floor(teams / courts);
    const extra = teams % courts;
    return {
      courts,
      minimum: modality * 2 * courts,
      ok: players >= modality * 2 * courts,
      teamsPerCourt: Array.from({ length: courts }, (_, c) => base + (c < extra ? 1 : 0)),
    };
  });
}

/** Texto curto do que a opção gera: "6 times", "3 + 3 times" ou "precisa de 24". */
export function courtOptionLabel(option: CourtOption): string {
  if (!option.ok) return `precisa de ${option.minimum}`;
  return `${option.teamsPerCourt.join(' + ')} times`;
}

/** Menor número de quadras com até ~20 atletas em cada (sempre com pelo menos 2 times por quadra). */
export function suggestedCourts(players: number, modality: number): number {
  const possible = courtOptions(players, modality).filter((o) => o.ok);
  const comfortable = possible.find((o) => players / o.courts <= COMFORT_PER_COURT);
  return (comfortable ?? possible[possible.length - 1])?.courts ?? 1;
}
