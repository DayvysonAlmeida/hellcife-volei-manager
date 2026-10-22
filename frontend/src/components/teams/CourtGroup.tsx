import { useState } from 'react';
import { GenerationCard } from '@/components/teams/GenerationCard';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

/**
 * Circuito com várias quadras ao mesmo tempo: cabeçalho com os totais e uma aba por quadra.
 * Cada aba mostra o card da quadra (times, Completar, Embaralhar, Fila e Partidas).
 */
export function CourtGroup({ generations, gameDays, allPlayers, canEdit, onConfirmDialog }: {
  generations: any[]; // quadras abertas do mesmo circuito, em ordem
  gameDays: any[];
  allPlayers: any[];
  canEdit: boolean;
  onConfirmDialog: (config: any) => void;
}) {
  const [selectedId, setSelectedId] = useState<number>(generations[0].id);
  // Se a quadra escolhida foi encerrada, volta para a primeira que ainda está aberta
  const current = generations.find((g) => g.id === selectedId) || generations[0];

  const gameday = gameDays.find((gd: any) => gd.id === current.gameday);
  const place = gameday?.arena_name || gameday?.location || current.gameday_location;
  const time = (gameday?.time || current.gameday_time || '').slice(0, 5);
  const playersIn = (g: any) => g.teams.reduce((acc: number, t: any) => acc + t.team_players.length, 0);
  const inCourts = generations.reduce((acc, g) => acc + playersIn(g), 0);
  // Quem está aguardando é o mesmo em todas as quadras do circuito
  const waiting = current.waiting_players?.length || 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-sm tracking-wider text-text-primary uppercase">
          Circuito {formatDate(gameday?.date || current.gameday_date || '')}{time ? ` · ${time}` : ''}{place ? ` · ${place}` : ''}
        </p>
        <p className="text-xs text-text-muted">
          {generations.length} quadras · {inCourts} em quadra
          {waiting > 0 && <span className="text-yellow-500 font-bold"> · {waiting} aguardando</span>}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {generations.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedId(g.id)}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all',
              g.id === current.id
                ? 'bg-red text-white border-red shadow-neon-red'
                : 'bg-surface text-text-muted border-border hover:text-text-primary',
            )}
          >
            Quadra {g.court} <span className="opacity-70">({playersIn(g)})</span>
            {g.live && (
              <span className="block text-[10px] font-medium normal-case tracking-normal opacity-90 tabular-nums">
                Jogo {g.live.match_number} · {g.live.score_a} x {g.live.score_b}
              </span>
            )}
          </button>
        ))}
      </div>

      <GenerationCard
        key={current.id}
        gen={current}
        gameDays={gameDays}
        allPlayers={allPlayers}
        canEdit={canEdit}
        onConfirmDialog={onConfirmDialog}
        siblingCourts={generations.filter((g) => g.id !== current.id)}
      />
    </div>
  );
}
