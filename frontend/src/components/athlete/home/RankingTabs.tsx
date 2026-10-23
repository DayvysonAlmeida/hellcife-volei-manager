import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Crown, Info, Share2, Star, Target, Trophy } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import type { DashboardStats, PlayerSeasonStats } from '@/types';

type Tab = 'fire' | 'wins' | 'stars';
const VISIBLE = 5;
const MINI_PER_BIG = 15;

interface Row {
  id: number;
  position: number;
  name: string;
  avatarUrl?: string | null;
  sub: string;
  sub2?: string;
  value: ReactNode;
}

interface RankingTabsProps {
  dashboard: DashboardStats;
  playerId?: number;
  season?: PlayerSeasonStats;
  myName: string;
  myAvatarUrl?: string | null;
  myStars: { big: number; mini: number };
  onShareFireShark?: () => void;
  onShareGladiator?: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Posições em ranking denso: quem empata em vitórias divide a posição (igual ao resto do app). */
function densePositions(values: number[]) {
  let pos = 0;
  let last: number | null = null;
  return values.map((v) => {
    if (v !== last) { pos += 1; last = v; }
    return pos;
  });
}

/** Pontos do Fire Shark (os mesmos que ordenam o ranking). */
function FireValue({ score }: { score: number }) {
  return <span className="inline-flex items-baseline gap-0.5">{score}<span className="font-sans text-[9px] font-bold uppercase tracking-wider opacity-70">pts</span></span>;
}

// Duas linhas curtas, para caber no celular: vitórias e derrotas; circuitos
const fireSubs = (wins: number, losses: number, circuits: number) => ({
  sub: `${wins}V · ${losses}D`,
  sub2: plural(circuits, 'circuito', 'circuitos'),
});

interface Goal { text: ReactNode; progress?: number; detail?: string; tips?: string }

const TABS: { key: Tab; label: string }[] = [
  { key: 'fire', label: 'Fire Shark' },
  { key: 'wins', label: 'Gladiadores' },
  { key: 'stars', label: 'Estrelas' },
];

export function RankingTabs({ dashboard, playerId, season, myName, myAvatarUrl, myStars, onShareFireShark, onShareGladiator }: RankingTabsProps) {
  const [tab, setTab] = useState<Tab>('fire');
  const [expanded, setExpanded] = useState(false);
  const values = dashboard.season?.fire_shark_points ?? { win: 3, loss: 1, circuit: 10 };
  const sharks = dashboard.fire_sharks ?? [];
  const winsList = dashboard.top_wins ?? [];

  const fireRows: Row[] = sharks.map((p, i) => ({
    id: p.id, position: i + 1, name: p.name, avatarUrl: p.avatar_url,
    ...fireSubs(p.wins, p.losses, p.circuits), value: <FireValue score={p.score} />,
  }));
  const winPositions = densePositions(winsList.map((p) => p.wins ?? 0));
  const winRows: Row[] = winsList.map((p, i) => ({
    id: p.id, position: winPositions[i], name: p.name, avatarUrl: p.avatar_url,
    sub: `${p.win_rate ?? 0}% de aproveitamento`, value: p.wins ?? 0,
  }));
  const starRows: Row[] = (dashboard.top_stars ?? []).map((p, i) => ({
    id: p.id, position: i + 1, name: p.name, avatarUrl: p.avatar_url,
    sub: `${p.big_stars ?? 0} grandes · ${p.mini_stars ?? 0} mini`,
    value: <span className="flex items-baseline gap-1.5"><span className="text-yellow-600 dark:text-yellow-400">🌟{p.big_stars ?? 0}</span><span className="text-orange-600 dark:text-orange-400 text-base">⭐{p.mini_stars ?? 0}</span></span>,
  }));

  // ── Seu próximo alvo: o que falta para subir, com números reais ──
  const fireTips = `Cada vitória vale +${values.win}, cada derrota +${values.loss} e cada circuito +${values.circuit}`;
  const fireGoal = (): Goal | null => {
    if (!season) return null;
    const rank = season.fire_shark_rank;
    if (rank == null || season.fire_score == null) {
      return { text: <>Jogue uma partida ou faça check-in num circuito para entrar no <b>Fire Shark</b>.</>, tips: fireTips };
    }
    const mine = season.fire_score;
    const parts = season.fire_points;
    const detail = parts ? `Seus pontos: ${parts.wins} das vitórias + ${parts.losses} das derrotas + ${parts.circuits} dos circuitos` : undefined;
    if (rank === 1) {
      const second = sharks[1];
      if (!second) return { text: <>Você é o <b>Tubarão da Quadra</b>. Segure o posto!</>, detail, tips: fireTips };
      const lead = mine - second.score;
      return {
        text: lead > 0
          ? <>Você é o <b>Tubarão da Quadra</b>. {second.name} está <b>{plural(lead, 'ponto', 'pontos')}</b> atrás.</>
          : <>Você é o <b>Tubarão da Quadra</b>, mas {second.name} tem os mesmos pontos: no empate vale quem tem mais vitórias.</>,
        detail, tips: fireTips,
      };
    }
    const above = rank <= sharks.length ? sharks[rank - 2] : sharks[sharks.length - 1];
    if (!above) return null;
    const need = above.score - mine + 1; // um ponto a mais para passar
    const what = rank <= sharks.length ? <>para passar <b>{above.name}</b> e subir para <b>#{rank - 1}</b></> : <>para entrar no <b>top {sharks.length}</b></>;
    return {
      text: (
        <>
          Faltam <b>{plural(need, 'ponto', 'pontos')}</b> {what}: {plural(Math.ceil(need / values.win), 'vitória', 'vitórias')} ou{' '}
          {plural(Math.ceil(need / values.circuit), 'circuito', 'circuitos')}.
        </>
      ),
      detail, tips: fireTips,
    };
  };

  const winsGoal = (): Goal | null => {
    if (!season) return null;
    const rank = season.gladiator_rank;
    const mine = season.wins;
    if (rank == null) return { text: <>Vença uma partida para entrar no ranking dos <b>Gladiadores</b>.</> };
    if (rank === 1) {
      const chaser = winsList.find((p) => (p.wins ?? 0) < mine);
      return { text: chaser ? <>Você lidera os <b>Gladiadores</b>. {chaser.name} está {plural(mine - (chaser.wins ?? 0), 'vitória', 'vitórias')} atrás.</> : <>Você lidera os <b>Gladiadores</b>.</> };
    }
    // O grupo logo acima (quem tem mais vitórias que você, com menos vitórias entre eles)
    const above = [...winsList].reverse().find((p) => (p.wins ?? 0) > mine);
    if (!above) return null;
    const need = (above.wins ?? 0) - mine + 1;
    const inList = winsList.some((p) => p.id === playerId);
    return {
      text: inList
        ? <>Faltam <b>{plural(need, 'vitória', 'vitórias')}</b> para passar <b>{above.name}</b>.</>
        : <>Faltam <b>{plural(need, 'vitória', 'vitórias')}</b> para você entrar no <b>top {winsList.length}</b>.</>,
      detail: `Você: ${mine} · ${above.name}: ${above.wins}`,
    };
  };

  const starsGoal = (): Goal => {
    const need = MINI_PER_BIG - (myStars.mini % MINI_PER_BIG);
    return {
      text: <>Faltam <b>{plural(need, 'mini estrela', 'mini estrelas')}</b> para a sua próxima <b>Grande Estrela</b>.</>,
      progress: ((myStars.mini % MINI_PER_BIG) / MINI_PER_BIG) * 100,
      detail: `${myStars.mini} de ${MINI_PER_BIG} mini estrelas · ${plural(myStars.big, 'Grande Estrela', 'Grandes Estrelas')} na carreira`,
    };
  };

  // Linha extra do atleta quando ele está fora do que aparece na lista
  const myExtraRow = (rows: Row[], shown: Row[]): Row | null => {
    if (!playerId || shown.some((r) => r.id === playerId)) return null;
    const inList = rows.find((r) => r.id === playerId);
    if (inList) return inList;
    if (tab === 'fire' && season?.fire_shark_rank && season.fire_score != null) {
      return {
        id: playerId, position: season.fire_shark_rank, name: myName, avatarUrl: myAvatarUrl,
        ...fireSubs(season.wins, season.losses, season.fire_circuits), value: <FireValue score={season.fire_score} />,
      };
    }
    if (tab === 'wins' && season?.gladiator_rank) {
      return { id: playerId, position: season.gladiator_rank, name: myName, avatarUrl: myAvatarUrl, sub: `${season.win_rate}% de aproveitamento`, value: season.wins };
    }
    return null;
  };

  const rows = tab === 'fire' ? fireRows : tab === 'wins' ? winRows : starRows;
  const podium = rows.slice(0, 3);
  const listed = rows.slice(3, expanded ? rows.length : VISIBLE);
  const extra = myExtraRow(rows, rows.slice(0, expanded ? rows.length : VISIBLE));
  const amRanked = !!playerId && rows.some((r) => r.id === playerId);
  const share = tab === 'fire' ? onShareFireShark : tab === 'wins' ? onShareGladiator : undefined;
  const goal = tab === 'fire' ? fireGoal() : tab === 'wins' ? winsGoal() : starsGoal();
  const seasonInfo = dashboard.season;

  const accent = {
    fire: { text: 'text-orange-600 dark:text-orange-400', ring: 'ring-orange-500', bar: 'from-red-600 via-orange-500 to-yellow-400', soft: 'border-orange-500/40 bg-orange-500/10' },
    wins: { text: 'text-yellow-600 dark:text-yellow-400', ring: 'ring-yellow-500', bar: 'from-yellow-600 to-yellow-300', soft: 'border-yellow-500/40 bg-yellow-500/10' },
    stars: { text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500', bar: 'from-blue-600 to-cyan-400', soft: 'border-blue-500/40 bg-blue-500/10' },
  }[tab];

  const header = {
    fire: (
      <div className="flex items-center gap-3">
        <img src="/fireshark.webp" alt="" className="w-16 h-16 object-contain flex-shrink-0 drop-shadow-[0_0_18px_rgba(249,115,22,0.55)]" />
        <div className="min-w-0">
          <h2 className="font-display text-3xl sm:text-4xl leading-none italic -skew-x-6 text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-orange-500 to-red-600">FIRE SHARK</h2>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted mt-1">
            Vitória {values.win} · derrota {values.loss} · circuito {values.circuit}
          </p>
        </div>
      </div>
    ),
    wins: (
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0"><Trophy size={30} className="text-yellow-500" /></div>
        <div className="min-w-0">
          <h2 className="font-display text-3xl sm:text-4xl leading-none text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">GLADIADORES</h2>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted mt-1">Mais vitórias na temporada</p>
        </div>
      </div>
    ),
    stars: (
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center flex-shrink-0"><Star size={30} className="text-blue-500" /></div>
        <div className="min-w-0">
          <h2 className="font-display text-3xl sm:text-4xl leading-none text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">MURAL DAS ESTRELAS</h2>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted mt-1">15 mini estrelas viram 1 Grande Estrela</p>
        </div>
      </div>
    ),
  }[tab];

  const empty = {
    fire: 'Ninguém pontuou na temporada ainda.',
    wins: 'Nenhuma vitória registrada na temporada ainda.',
    stars: 'Ninguém ganhou estrelas ainda.',
  }[tab];

  const renderRow = (r: Row, isExtra = false) => {
    const me = r.id === playerId;
    return (
      <li
        key={`${isExtra ? 'extra-' : ''}${r.id}`}
        className={cn(
          'grid grid-cols-[1.75rem_2.5rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-2xl border px-2.5 py-2',
          me ? 'border-orange-500/50 bg-orange-500/10' : 'border-border/20 bg-white/[0.02]'
        )}
      >
        <span className="font-display text-2xl text-center leading-none text-text-muted">{r.position}</span>
        <Avatar name={r.name} src={r.avatarUrl || undefined} size="md" className={me ? 'ring-2 ring-orange-500' : ''} />
        <div className="min-w-0">
          <p className={cn('font-bold truncate', me ? 'text-orange-600 dark:text-orange-300' : 'text-text-primary')}>{r.name}{me && <span className="font-medium"> · você</span>}</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted truncate">{r.sub}</p>
          {r.sub2 && <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted truncate">{r.sub2}</p>}
        </div>
        <span className={cn('font-display text-2xl leading-none tabular-nums text-right', accent.text)}>{r.value}</span>
      </li>
    );
  };

  // Pódio: 2º à esquerda, 1º no centro (mais alto), 3º à direita
  const PODIUM_STYLE = [
    { place: 1, order: 'order-2', pedestal: 'h-20 from-yellow-400/40 to-yellow-500/5 border-yellow-500/50', medal: 'bg-gradient-to-br from-yellow-300 to-amber-500 text-black', avatar: 'w-16 h-16 sm:w-20 sm:h-20' },
    { place: 2, order: 'order-1', pedestal: 'h-14 from-zinc-300/35 to-zinc-400/5 border-zinc-400/50', medal: 'bg-gradient-to-br from-zinc-200 to-zinc-400 text-black', avatar: 'w-12 h-12 sm:w-14 sm:h-14' },
    { place: 3, order: 'order-3', pedestal: 'h-10 from-amber-700/35 to-amber-800/5 border-amber-700/50', medal: 'bg-gradient-to-br from-amber-500 to-amber-800 text-white', avatar: 'w-12 h-12 sm:w-14 sm:h-14' },
  ];

  return (
    <section className="rounded-[28px] border border-border/30 bg-white/60 dark:bg-[#07070a]/80 p-3 sm:p-5 flex flex-col gap-4">
      <div role="tablist" aria-label="Rankings" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-highlight/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            id={`ranking-tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            aria-controls="ranking-panel"
            onClick={() => { setTab(t.key); setExpanded(false); }}
            className={cn(
              'rounded-xl px-2 py-2 text-[11px] font-black uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red/60',
              tab === t.key ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.45)]' : 'text-text-muted hover:text-text-primary'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="ranking-panel" role="tabpanel" aria-labelledby={`ranking-tab-${tab}`} className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          {header}
          {share && amRanked && (
            <button
              type="button"
              onClick={share}
              aria-label="Compartilhar minha posição"
              className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted hover:text-text-primary hover:border-border transition-colors"
            >
              <Share2 size={12} /> <span className="hidden sm:inline">Compartilhar</span>
            </button>
          )}
        </div>

        {tab === 'fire' && (
          <details className="rounded-2xl border border-border/30 px-3.5 py-2.5 text-xs text-text-muted">
            <summary className="cursor-pointer font-bold text-text-primary">
              <Info size={13} className={cn('inline -mt-0.5 mr-1', accent.text)} />Como os pontos funcionam
            </summary>
            <p className="mt-2 leading-relaxed">
              Cada vitória vale <b>{values.win} pontos</b>, cada derrota <b>{values.loss}</b> e cada circuito em que você faz check-in
              na quadra <b>{values.circuit}</b> (dois circuitos no mesmo dia contam um). Tudo soma e nada desconta: ninguém perde pontos
              por ficar um tempo sem jogar. Os pontos zeram a cada temporada, e a classificação final é validada pela organização.
              No empate, fica na frente quem tem mais vitórias, depois quem foi a mais circuitos.
            </p>
          </details>
        )}

        {/* Seu próximo alvo */}
        {goal && (
          <div className={cn('rounded-2xl border p-3.5 flex flex-col gap-2', accent.soft)}>
            <p className="flex items-start gap-2 text-sm text-text-primary leading-snug">
              <Target size={18} className={cn('flex-shrink-0 mt-0.5', accent.text)} />
              <span><span className={cn('block text-[10px] font-black uppercase tracking-[0.18em] mb-0.5', accent.text)}>Seu próximo alvo</span>{goal.text}</span>
            </p>
            {goal.progress != null && (
              <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div className={cn('h-full rounded-full bg-gradient-to-r', accent.bar)} style={{ width: `${Math.max(4, goal.progress)}%` }} />
              </div>
            )}
            {goal.tips && <p className={cn('text-xs font-semibold tabular-nums', accent.text)}>{goal.tips}</p>}
            {goal.detail && <p className="text-[11px] text-text-muted tabular-nums">{goal.detail}</p>}
          </div>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">{empty}</p>
        ) : (
          <>
            {/* Pódio */}
            <ol className="grid grid-cols-3 items-end gap-2 sm:gap-3 pt-2" aria-label="Pódio">
              {PODIUM_STYLE.map((style, i) => {
                const r = podium[i];
                if (!r) return <li key={style.place} className={style.order} aria-hidden />;
                const me = r.id === playerId;
                const fireLeader = tab === 'fire' && i === 0;
                return (
                  <li key={r.id} className={cn('flex flex-col items-center gap-1.5 min-w-0', style.order)}>
                    {i === 0 && <Crown size={20} className="text-yellow-500" aria-hidden />}
                    <div className="relative">
                      {fireLeader && (
                        <span
                          aria-hidden
                          className="absolute -inset-1.5 rounded-full motion-safe:animate-[spin_5s_linear_infinite]"
                          style={{ background: 'conic-gradient(from 180deg, #3b82f6 0deg 150deg, #f97316 150deg 330deg, #3b82f6 330deg)' }}
                        />
                      )}
                      <Avatar
                        name={r.name}
                        src={r.avatarUrl || undefined}
                        size="lg"
                        className={cn('relative ring-4 ring-[rgb(var(--color-bg))]', style.avatar, me && 'outline outline-2 outline-orange-500')}
                      />
                      <span className={cn('absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center shadow', style.medal)}>{r.position}</span>
                    </div>
                    <p className={cn('mt-2 text-xs sm:text-sm font-bold truncate max-w-full text-center', me ? 'text-orange-600 dark:text-orange-300' : 'text-text-primary')}>{r.name}{me && ' · você'}</p>
                    <div className={cn('w-full rounded-t-xl border border-b-0 bg-gradient-to-b flex items-start justify-center pt-2', style.pedestal)}>
                      <span className={cn('font-display text-xl sm:text-2xl leading-none tabular-nums', accent.text)}>{r.value}</span>
                    </div>
                  </li>
                );
              })}
            </ol>

            {(listed.length > 0 || extra) && (
              <ol className="flex flex-col gap-1.5">
                {listed.map((r) => renderRow(r))}
                {extra && (
                  <>
                    <li aria-hidden className="text-center text-text-muted leading-none">···</li>
                    {renderRow(extra, true)}
                  </>
                )}
              </ol>
            )}
          </>
        )}

        {rows.length > VISIBLE && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-xl border border-dashed border-border/50 py-2 text-xs font-bold text-text-muted hover:text-text-primary transition-colors"
          >
            {expanded ? 'Ver menos' : `Ver o top ${rows.length}`}
          </button>
        )}

        {/* A temporada como prazo: o resultado final fica salvo */}
        {seasonInfo && tab !== 'stars' && (
          <p className="text-[11px] text-text-muted leading-relaxed">
            A {seasonInfo.name} vai até {seasonInfo.end_date.split('-').reverse().slice(0, 2).join('/')}. O pódio final fica registrado na página{' '}
            <Link to="/athlete/seasons" className="font-semibold text-text-primary underline underline-offset-2 inline-flex items-center gap-0.5">Temporadas<ArrowUpRight size={11} /></Link>.
          </p>
        )}
      </div>
    </section>
  );
}
