/**
 * Nível do convidado: avaliação temporária usada no sorteio até ele ter uma avaliação de verdade.
 * Sem nível escolhido, o sorteio usa 5.
 */
export const GUEST_LEVELS = [
  { label: 'Iniciante', values: [1, 2, 3] },
  { label: 'Intermediário', values: [4, 5, 6, 7] },
  { label: 'Avançado', values: [8, 9, 10] },
] as const;

export const DEFAULT_GUEST_LEVEL = 5;

/** "Iniciante · 2" */
export function guestLevelLabel(value: number) {
  const level = GUEST_LEVELS.find((l) => (l.values as readonly number[]).includes(value));
  return level ? `${level.label} · ${value}` : String(value);
}
