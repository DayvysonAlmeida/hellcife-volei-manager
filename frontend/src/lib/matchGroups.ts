import { useState } from 'react';
import type { Match } from '@/types';

/** Partidas por circuito (ou por data, se avulsas): grupo mais recente primeiro e, dentro dele, a partida mais recente no topo. */
export function groupMatches(matches: Match[]) {
  const groups = matches.reduce((acc: Record<string, Match[]>, match) => {
    const key = match.gameday ? `gd-${match.gameday}` : `date-${match.date}`;
    (acc[key] ??= []).push(match);
    return acc;
  }, {});
  Object.values(groups).forEach((list) => list.sort((a, b) => b.id - a.id));
  const recency = (key: string) => new Date(groups[key][0].created_at || groups[key][0].date).getTime();
  return Object.keys(groups)
    .sort((a, b) => recency(b) - recency(a))
    .map((key) => ({ key, matches: groups[key] }));
}

/** Um circuito aberto por vez; até a pessoa mexer, o mais recente vem aberto. */
export function useOpenGroup(firstKey?: string) {
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const openKey = chosen === undefined ? firstKey ?? null : chosen;
  const toggle = (key: string) => setChosen(openKey === key ? null : key);
  return { openKey, toggle };
}
