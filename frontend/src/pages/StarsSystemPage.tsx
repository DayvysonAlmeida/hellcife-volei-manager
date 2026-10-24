import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Star, Search, Trophy, Zap, Shield, History, Crosshair, Activity, Lock, Minus, X, CalendarDays, Undo2, Users, CheckCircle2, Loader2, ChevronDown, SlidersHorizontal, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { Pagination } from '@/components/ui/Pagination';
import { playersService } from '@/services/players';
import { useAuth } from '@/store/AuthContext';
import { useDebounce } from '@/lib/useDebounce';
import toast from 'react-hot-toast';
import type { Player, StarCategory, StarHistoryEntry, StarLaunchOption } from '@/types';

// Configuração das 6 categorias de estrelas (Prêmios)
const STAR_CATEGORIES = [
  { cat: 'mvp', field: 'mvp_stars', label: 'MVP', icon: Trophy, color: 'text-yellow-500', bgClass: 'bg-yellow-400/10', ring: 'ring-yellow-500', points: 6 },
  { cat: 'attack', field: 'attack_stars', label: 'ATAQUE', icon: Zap, color: 'text-red', bgClass: 'bg-[#D90429]/10', ring: 'ring-red', points: 1 },
  { cat: 'defense', field: 'defense_stars', label: 'DEFESA', icon: Shield, color: 'text-blue-500', bgClass: 'bg-[#2563EB]/10', ring: 'ring-blue-500', points: 1 },
  { cat: 'setter', field: 'setter_stars', label: 'LEVANTADOR', icon: Crosshair, color: 'text-orange-500', bgClass: 'bg-orange-500/10', ring: 'ring-orange-500', points: 1 },
  { cat: 'pass', field: 'pass_stars', label: 'PASSE', icon: Activity, color: 'text-green-500', bgClass: 'bg-green-500/10', ring: 'ring-green-500', points: 1 },
  { cat: 'block', field: 'block_stars', label: 'BLOQUEIO', icon: Lock, color: 'text-purple-500', bgClass: 'bg-purple-500/10', ring: 'ring-purple-500', points: 1 },
] as const satisfies readonly { cat: StarCategory; field: keyof Player; [k: string]: unknown }[];
const CATEGORY_BY_KEY = Object.fromEntries(STAR_CATEGORIES.map((c) => [c.cat, c])) as Record<StarCategory, (typeof STAR_CATEGORIES)[number]>;

const circuitName = (g: { date: string; description?: string }) => `${formatDate(g.date)}${g.description ? ` · ${g.description}` : ''}`;
// Linha que desliza para o lado no celular, sem barra de rolagem aparente
const swipeRow = 'flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-2 px-2 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible';
const stepLabel = 'text-[11px] font-black uppercase tracking-[0.15em] text-text-muted';

// ─────────────────────────── Lançar estrelas (por circuito) ───────────────────────────

type Draft = Record<string, number>; // "playerId:categoria" → quantidade
type DraftItem = { player: number; category: StarCategory; count: number };
const draftKey = (playerId: number, cat: StarCategory) => `${playerId}:${cat}`;

function DraftList({ items, byId, onBump, onRemove }: {
  items: DraftItem[];
  byId: Map<number, Player>;
  onBump: (item: DraftItem, by: number) => void;
  onRemove: (item: DraftItem) => void;
}) {
  if (!items.length) return <p className="text-xs text-text-muted">Nada no rascunho ainda.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const player = byId.get(item.player);
        const c = CATEGORY_BY_KEY[item.category];
        return (
          <li key={draftKey(item.player, item.category)} className="flex items-center gap-2 min-w-0">
            <Avatar name={player?.display_name ?? '?'} src={player?.avatar_url} size="sm" className="shrink-0" />
            <span className="text-sm text-text-primary truncate flex-1 min-w-0">
              <strong>{player?.display_name ?? 'Atleta'}</strong>{' '}
              <span className={cn('font-bold', c.color)}>+{item.count} {c.label}</span>
            </span>
            <button type="button" onClick={() => onBump(item, -1)} aria-label="Tirar uma"
              className="w-8 h-8 rounded-full border border-border/60 flex items-center justify-center text-text-muted hover:text-red shrink-0"><Minus size={13} /></button>
            <button type="button" onClick={() => onRemove(item)} aria-label="Remover do rascunho"
              className="w-8 h-8 rounded-full border border-border/60 flex items-center justify-center text-text-muted hover:text-red shrink-0"><X size={13} /></button>
          </li>
        );
      })}
    </ul>
  );
}

function LaunchPanel({ active }: { active: boolean }) {
  const queryClient = useQueryClient();
  const [gamedayId, setGamedayId] = useState<number | null>(null);
  const [category, setCategory] = useState<StarCategory>('mvp');
  const [onlyPresent, setOnlyPresent] = useState(true);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft>({});
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: options, isLoading: loadingOptions } = useQuery({
    queryKey: ['stars-launch-options'],
    queryFn: playersService.starLaunchOptions,
  });
  // Atletas ativos e convidados: convidado presente no circuito também pode ganhar estrela
  const { data: playersData } = useQuery({
    queryKey: ['players', 'stars-launch'],
    queryFn: () => playersService.list({ status: 'active', page_size: 500, include_guests: 'true' }),
    staleTime: 1000 * 60 * 3,
  });

  const gameday: StarLaunchOption | undefined = options?.find((o) => o.id === gamedayId) ?? options?.[0];
  const players = useMemo(() => playersData?.results ?? [], [playersData]);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const present = useMemo(() => new Set(gameday?.present_ids ?? []), [gameday]);

  const term = search.trim().toLowerCase();
  const shown = players
    .filter((p) => !onlyPresent || present.has(p.id))
    .filter((p) => !term || p.display_name.toLowerCase().includes(term))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  const items: DraftItem[] = Object.entries(draft).filter(([, n]) => n > 0).map(([key, count]) => {
    const [player, cat] = key.split(':');
    return { player: Number(player), category: cat as StarCategory, count };
  });
  const total = items.reduce((sum, i) => sum + i.count, 0);

  const bump = (playerId: number, cat: StarCategory, by: number) =>
    setDraft((d) => ({ ...d, [draftKey(playerId, cat)]: Math.max(0, Math.min(10, (d[draftKey(playerId, cat)] ?? 0) + by)) }));
  const onBump = (item: DraftItem, by: number) => bump(item.player, item.category, by);
  const onRemove = (item: DraftItem) => setDraft((d) => ({ ...d, [draftKey(item.player, item.category)]: 0 }));

  const launch = useMutation({
    mutationFn: () => playersService.launchStars(gameday!.id, items),
    onSuccess: () => {
      toast.success(`${total} estrela${total === 1 ? '' : 's'} lançada${total === 1 ? '' : 's'} no circuito de ${formatDate(gameday!.date)}!`);
      setDraft({});
      setSheetOpen(false);
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['stars-history'] });
    },
    onError: (err: any) => {
      const data = err.response?.data;
      toast.error((data && (data.items || data.gameday || data.detail)) || 'Não foi possível lançar agora. Tente de novo.');
    },
  });

  if (loadingOptions) return <div className="animate-pulse h-40 bg-surface rounded-2xl" />;
  if (!options?.length) {
    return (
      <section className="card p-5 text-sm text-text-muted">
        Nenhum circuito realizado ainda. As estrelas são lançadas sempre ligadas a um circuito que já aconteceu.
      </section>
    );
  }

  const changeGameday = (id: number) => {
    setGamedayId(id);
    if (items.length) toast('O rascunho continua: ele será lançado no circuito escolhido.', { icon: 'ℹ️' });
  };
  const confirmLabel = items.length ? `Confirmar ${total} lançamento${total === 1 ? '' : 's'}` : 'Confirmar lançamentos';
  const confirmButton = (className?: string) => (
    <button type="button" disabled={!items.length || launch.isPending} onClick={() => launch.mutate()}
      className={cn('btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50', className)}>
      {launch.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
      {confirmLabel}
    </button>
  );

  return (
    <section className={cn('card p-3 sm:p-5 space-y-4 sm:space-y-5 border-yellow-500/30', items.length && 'mb-20 md:mb-0')}>
      <p className="text-xs text-text-muted">Escolha o circuito e a categoria e toque nos atletas. Nada é salvo até você confirmar.</p>

      {/* 1. Circuito */}
      <div className="space-y-1.5">
        <label htmlFor="launch-gameday" className={cn(stepLabel, 'flex items-center gap-1.5')}>
          <CalendarDays size={13} /> 1. Circuito
        </label>
        <select id="launch-gameday" className="input w-full sm:max-w-md" value={gameday?.id} onChange={(e) => changeGameday(Number(e.target.value))}>
          {options.map((o) => <option key={o.id} value={o.id}>{circuitName(o)}{o.location ? ` · ${o.location}` : ''}</option>)}
        </select>
      </div>

      {/* 2. Categoria: uma linha que desliza no celular */}
      <div className="space-y-1.5">
        <p className={stepLabel}>2. Categoria</p>
        <div className={swipeRow} role="radiogroup" aria-label="Categoria da estrela">
          {STAR_CATEGORIES.map((c) => (
            <button key={c.cat} type="button" role="radio" aria-checked={category === c.cat} onClick={() => setCategory(c.cat)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold tracking-wider transition-all',
                category === c.cat ? cn('ring-2 border-transparent', c.ring, c.bgClass, c.color) : 'border-border/60 text-text-muted hover:text-text-primary',
              )}>
              <c.icon size={14} className={c.color} /> {c.label}
              <span className="font-mono text-[10px] opacity-70">{c.points} pt</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Atletas */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className={stepLabel}>3. Toque em quem ganhou</p>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-border/50 p-0.5 text-[11px] font-bold shrink-0">
              {[true, false].map((value) => (
                <button key={String(value)} type="button" onClick={() => setOnlyPresent(value)} aria-pressed={onlyPresent === value}
                  className={cn('px-2.5 py-1 rounded-lg transition-colors', onlyPresent === value ? 'bg-text-primary/10 text-text-primary' : 'text-text-muted')}>
                  {value ? `Presentes (${present.size})` : 'Todos'}
                </button>
              ))}
            </div>
            <div className="relative flex-1 sm:w-48">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input className="input w-full pl-8 py-1.5 text-sm" placeholder="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar atleta para lançar" />
            </div>
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">
            {onlyPresent && present.size === 0 ? 'Ninguém com presença marcada neste circuito. Use "Todos".' : 'Nenhum atleta encontrado.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 max-h-[48vh] sm:max-h-[340px] overflow-y-auto custom-scrollbar pr-1 pt-1.5">
            {shown.map((p) => {
              const inDraft = draft[draftKey(p.id, category)] ?? 0;
              return (
                <button key={p.id} type="button" onClick={() => bump(p.id, category, 1)}
                  className={cn(
                    'relative flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all min-w-0',
                    inDraft ? cn('ring-2 border-transparent', CATEGORY_BY_KEY[category].ring, CATEGORY_BY_KEY[category].bgClass) : 'border-border/50 hover:border-border hover:bg-text-primary/[0.03]',
                  )}>
                  <Avatar name={p.display_name} src={p.avatar_url} size="sm" className="shrink-0" />
                  <span className="text-sm font-medium text-text-primary truncate">{p.display_name}</span>
                  {inDraft > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-yellow-500 text-black text-[11px] font-black leading-5 text-center">+{inDraft}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Rascunho: no computador fica aqui embaixo */}
      <div className="hidden md:block rounded-2xl border border-dashed border-border/70 p-4 space-y-3">
        <p className={stepLabel}>Para lançar no circuito de {formatDate(gameday!.date)} {items.length > 0 && `(${total})`}</p>
        <DraftList items={items} byId={byId} onBump={onBump} onRemove={onRemove} />
        <div className="flex justify-end gap-2 pt-1">
          {items.length > 0 && <button type="button" onClick={() => setDraft({})} className="btn-ghost text-sm">Limpar</button>}
          {confirmButton()}
        </div>
      </div>

      {/* Rascunho: no celular vira uma barra fixa no rodapé, sempre ao alcance do dedo */}
      {active && items.length > 0 && (
        <div className="md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 bg-background/95 backdrop-blur border-t border-border shadow-[0_-8px_24px_rgba(0,0,0,0.25)]">
          <AnimatePresence initial={false}>
            {sheetOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="max-h-[45vh] overflow-y-auto pb-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className={stepLabel}>Circuito de {formatDate(gameday!.date)}</p>
                    <button type="button" onClick={() => setDraft({})} className="text-xs font-bold text-text-muted hover:text-red">Limpar</button>
                  </div>
                  <DraftList items={items} byId={byId} onBump={onBump} onRemove={onRemove} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSheetOpen((v) => !v)} aria-expanded={sheetOpen}
              className="flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-2.5 text-xs font-bold text-text-primary shrink-0">
              <ChevronDown size={14} className={cn('transition-transform', !sheetOpen && 'rotate-180')} />
              {total} no rascunho
            </button>
            {confirmButton('flex-1 py-2.5')}
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────── Placar (só leitura, em lista) ───────────────────────────

function BoardRow({ player, open, onToggle }: { player: Player; open: boolean; onToggle: () => void }) {
  const mini = player.mini_stars ?? 0;
  const bigStars = player.big_stars ?? 0;

  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-text-primary/[0.03] transition-colors">
        <Avatar name={player.display_name} src={player.avatar_url} size="sm" className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-text-primary truncate">{player.display_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 max-w-[9rem] h-1.5 bg-surface-highlight rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-yellow-700 via-yellow-400 to-yellow-500" style={{ width: `${Math.min(100, (mini / 15) * 100)}%` }} />
            </div>
            <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 font-mono">{mini}/15</span>
          </div>
        </div>
        <span className="flex items-center gap-1 shrink-0" title={`${bigStars} Estrela(s) Grande(s)`}>
          <span className="text-base leading-none">🌟</span>
          <span className="text-sm font-black text-text-primary tabular-nums">{bigStars}</span>
        </span>
        <ChevronDown size={16} className={cn('text-text-muted transition-transform shrink-0', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-2">
              <div className="flex items-center justify-between">
                <PositionBadge position={player.main_position} />
                <Link to={`/players/${player.id}`} className="text-[11px] font-bold text-text-muted hover:text-yellow-500">Ver perfil</Link>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {STAR_CATEGORIES.map((c) => {
                  const value = (player[c.field] as number) ?? 0;
                  return (
                    <div key={c.cat} className={cn('flex flex-col items-center rounded-lg py-1.5', value ? c.bgClass : 'bg-text-primary/[0.03]')}>
                      <c.icon size={13} className={value ? c.color : 'text-text-muted/50'} />
                      <span className={cn('text-sm font-black tabular-nums', value ? 'text-text-primary' : 'text-text-muted/50')}>{value}</span>
                      <span className="text-[8px] font-bold tracking-wider text-text-muted">{c.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function Board() {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  // Busca todos os atletas ativos — sem paginação (lista auxiliar)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['players', 'stars-system', debouncedSearch],
    queryFn: () => playersService.list({ status: 'active', search: debouncedSearch || undefined, page_size: 500 }),
    staleTime: 1000 * 60 * 3,
  });

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState onRetry={refetch} />;

  const players = [...(data?.results ?? [])].sort((a, b) =>
    (b.big_stars ?? 0) - (a.big_stars ?? 0) || (b.mini_stars ?? 0) - (a.mini_stars ?? 0));
  const half = Math.ceil(players.length / 2);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs text-text-muted">
          {players.length} atleta{players.length !== 1 ? 's' : ''} · toque para ver os contadores do ciclo (zeram quando a 🌟 é forjada).
        </p>
        <div className="relative w-full sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="text" placeholder="Buscar atleta..." value={search} onChange={(e) => setSearch(e.target.value)} className="input w-full pl-9" aria-label="Buscar atleta no placar" />
        </div>
      </div>
      {players.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          {debouncedSearch ? 'Nenhum atleta encontrado para essa busca.' : 'Nenhum atleta ativo no sistema.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
          {[players.slice(0, half), players.slice(half)].map((column, idx) => column.length > 0 && (
            <ul key={idx} className="card p-0 divide-y divide-border/40 overflow-hidden">
              {column.map((player) => (
                <BoardRow key={player.id} player={player} open={open === player.id} onToggle={() => setOpen(open === player.id ? null : player.id)} />
              ))}
            </ul>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Histórico ───────────────────────────

const CATEGORY: Record<StarHistoryEntry['category'], { icon: string; label: string; color: string }> = {
  promotion: { icon: '👑', label: 'Grande Estrela', color: 'text-yellow-500' },
  mvp: { icon: '🏆', label: 'MVP', color: 'text-yellow-500' },
  attack: { icon: '⚡', label: 'Ataque', color: 'text-red' },
  defense: { icon: '🛡️', label: 'Defesa', color: 'text-blue-500' },
  setter: { icon: '🎯', label: 'Levantador', color: 'text-orange-500' },
  pass: { icon: '🏐', label: 'Passe', color: 'text-green-500' },
  block: { icon: '🧱', label: 'Bloqueio', color: 'text-purple-500' },
};
const NO_AUTHOR = 'none';
const NO_CIRCUIT = 'none';

function StarHistoryTimeline({ canUndo }: { canUndo: boolean }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [author, setAuthor] = useState('all');
  const [circuit, setCircuit] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [undoing, setUndoing] = useState<StarHistoryEntry | null>(null);

  const { data: history, isLoading } = useQuery({
    queryKey: ['stars-history'],
    queryFn: playersService.getStarHistory,
    refetchInterval: 1000 * 60 * 5, // Atualiza a cada 5 mins
  });

  const undo = useMutation({
    mutationFn: (entry: StarHistoryEntry) => playersService.undoStar(entry.id),
    onSuccess: () => {
      toast.success('Lançamento desfeito.');
      queryClient.invalidateQueries({ queryKey: ['stars-history'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Não foi possível desfazer agora.'),
  });

  // Opções dos filtros a partir do que aparece no histórico
  const { authors, circuits } = useMemo(() => {
    const a = new Map<string, string>();
    const c = new Map<string, { date: string; description: string }>();
    history?.forEach((h) => {
      if (h.given_by_id) a.set(String(h.given_by_id), h.given_by_name ?? '');
      if (h.gameday) c.set(String(h.gameday.id), h.gameday);
    });
    return {
      authors: [...a.entries()].sort((x, y) => x[1].localeCompare(y[1])),
      circuits: [...c.entries()].sort((x, y) => y[1].date.localeCompare(x[1].date)),
    };
  }, [history]);
  const hasUnknownAuthor = !!history?.some((h) => !h.given_by_id);
  const hasNoCircuit = !!history?.some((h) => !h.gameday);
  const activeFilters = Number(author !== 'all') + Number(circuit !== 'all');

  const filtered = (history ?? [])
    .filter((h) => author === 'all' || (author === NO_AUTHOR ? !h.given_by_id : String(h.given_by_id) === author))
    .filter((h) => circuit === 'all' || (circuit === NO_CIRCUIT ? !h.gameday : String(h.gameday?.id) === circuit));
  const startIndex = (page - 1) * pageSize;
  const currentItems = filtered.slice(startIndex, startIndex + pageSize);

  if (isLoading) return <div className="animate-pulse h-20 bg-surface rounded-xl"></div>;

  const filterSelect = 'input py-1.5 px-3 h-auto text-sm bg-surface border-border';

  return (
    <div className="space-y-3">
      {history && history.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 sm:hidden">
            <p className="text-xs text-text-muted">{filtered.length} lançamento{filtered.length === 1 ? '' : 's'}</p>
            <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-1.5 text-xs font-bold text-text-primary">
              <SlidersHorizontal size={13} /> Filtros{activeFilters ? ` (${activeFilters})` : ''}
            </button>
          </div>
          <div className={cn('grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end', !showFilters && 'hidden sm:flex')}>
            <label htmlFor="stars-circuit" className="sr-only">Circuito</label>
            <select id="stars-circuit" value={circuit} onChange={(e) => { setCircuit(e.target.value); setPage(1); }} className={cn(filterSelect, 'sm:max-w-[14rem]')}>
              <option value="all">Todos os circuitos</option>
              {circuits.map(([id, g]) => <option key={id} value={id}>{circuitName(g)}</option>)}
              {hasNoCircuit && <option value={NO_CIRCUIT}>Sem circuito</option>}
            </select>
            <label htmlFor="stars-author" className="sr-only">Lançado por</label>
            <select id="stars-author" value={author} onChange={(e) => { setAuthor(e.target.value); setPage(1); }} className={cn(filterSelect, 'sm:max-w-[12rem]')}>
              <option value="all">Lançado por: todos</option>
              {authors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              {hasUnknownAuthor && <option value={NO_AUTHOR}>Sem registro de autor</option>}
            </select>
            <label htmlFor="stars-page-size" className="sr-only">Quantidade por página</label>
            <select id="stars-page-size" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className={cn(filterSelect, 'sm:w-20')}>
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
              <option value={50}>50 por página</option>
            </select>
          </div>
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl p-2 sm:p-5">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <Star className="mx-auto mb-3 text-text-muted/30" size={32} />
            <p>{history?.length ? 'Nenhum lançamento com esse filtro.' : 'Nenhum prêmio foi distribuído ainda.'}</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
          {currentItems.map((item) => {
            const { icon, label, color } = CATEGORY[item.category] ?? { icon: '🌟', label: 'Prêmio', color: 'text-yellow-500' };
            const removed = item.action === 'remove';
            const undone = !!item.undone_by;
            const actionText = item.action === 'add' ? 'ganhou' : removed ? 'perdeu' : 'conquistou';
            const countText = item.count > 1 ? `${item.count}x ` : '';
            // Só os lançamentos por circuito: os antigos (+/−) já foram corrigidos com remoções soltas
            const canUndoThis = canUndo && item.action === 'add' && item.category !== 'promotion' && !undone && !!item.gameday;
            const authorVerb = item.reverts_id ? 'desfeito por' : removed ? 'retirada por' : 'por';

            return (
              <li key={item.id} className={cn(
                'flex items-start gap-2.5 rounded-xl px-2.5 py-2',
                removed ? 'bg-red/[0.06] border border-red/25' : 'border border-transparent hover:bg-text-primary/[0.03]',
              )}>
                <Avatar name={item.player_name} src={item.avatar_url ?? undefined} size="sm" className={cn('shrink-0 mt-0.5', undone && 'opacity-50')} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm text-text-primary leading-snug', undone && 'line-through decoration-text-muted opacity-60')}>
                    <Link to={`/players/${item.player_id}`} className="font-bold hover:text-yellow-500 transition-colors">{item.player_name}</Link>{' '}
                    <span className={removed ? 'text-red font-bold' : 'text-text-muted'}>{actionText}</span>{' '}
                    <span className={cn('font-bold', color)}>{countText}{label} {icon}</span>
                  </p>
                  {/* Circuito e quem lançou numa linha só */}
                  <p className="mt-0.5 text-[11px] text-text-muted leading-snug">
                    <CalendarDays size={11} className="inline -mt-0.5 mr-1" />
                    {item.gameday ? <strong className="text-text-secondary">{circuitName(item.gameday)}</strong> : <span className="italic">sem circuito</span>}
                    {' · '}
                    {item.given_by_name
                      ? <>{authorVerb} <strong className="text-text-secondary">{item.given_by_name}</strong></>
                      : <span className="italic">autor não registrado</span>}
                    {' · '}
                    <span className="font-mono">{formatDateTime(item.created_at)}</span>
                  </p>
                  {undone && (
                    <p className="mt-0.5 text-[11px] font-bold text-red">
                      Desfeito{item.undone_by?.name ? ` por ${item.undone_by.name}` : ''} em {formatDateTime(item.undone_by!.at)}
                    </p>
                  )}
                </div>
                {canUndoThis && (
                  <button type="button" onClick={() => setUndoing(item)} disabled={undo.isPending} aria-label={`Desfazer: ${item.player_name} ${label}`}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[11px] font-bold text-text-muted hover:text-red hover:border-red/40 transition-colors">
                    <Undo2 size={12} /> <span className="hidden sm:inline">Desfazer</span>
                  </button>
                )}
              </li>
            );
          })}
          </ul>
        )}
        {filtered.length > pageSize && (
          <div className="mt-4 pt-2">
            <Pagination count={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} />
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!undoing}
        onOpenChange={(open) => { if (!open) setUndoing(null); }}
        title="Desfazer lançamento?"
        description={undoing
          ? `${undoing.player_name} perde ${undoing.count}x ${CATEGORY[undoing.category].label}${undoing.gameday ? ` do circuito de ${formatDate(undoing.gameday.date)}` : ''}. Fica registrado que você desfez.`
          : ''}
        confirmText="Desfazer"
        isDestructive
        onConfirm={() => { if (undoing) undo.mutate(undoing); setUndoing(null); }}
      />
    </div>
  );
}

// ─────────────────────────── Página ───────────────────────────

type Tab = 'launch' | 'board' | 'history';
const TAB_KEY = 'hellcife-stars-tab';

function readTab(isStaff: boolean): Tab {
  try {
    const saved = localStorage.getItem(TAB_KEY) as Tab | null;
    if (saved === 'board' || saved === 'history' || (saved === 'launch' && isStaff)) return saved;
  } catch { /* sem armazenamento: abre no padrão */ }
  return isStaff ? 'launch' : 'board';
}

export function StarsSystemPage() {
  const { user } = useAuth();
  const isStaff = user?.profile === 'admin' || user?.profile === 'moderator';
  const [tab, setTab] = useState<Tab>(() => readTab(isStaff));
  const [showHelp, setShowHelp] = useState(false);

  const tabs: { key: Tab; label: string; icon: typeof Star }[] = [
    ...(isStaff ? [{ key: 'launch' as Tab, label: 'Lançar', icon: Star }] : []),
    { key: 'board', label: 'Placar', icon: Users },
    { key: 'history', label: 'Histórico', icon: History },
  ];
  const choose = (next: Tab) => {
    setTab(next);
    try { localStorage.setItem(TAB_KEY, next); } catch { /* lembrar a aba é só conveniência */ }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">
            <Star className="text-yellow-500 fill-yellow-500" size={28} />
            SISTEMA DE ESTRELAS
          </h1>
          <p className="page-subtitle">Prêmios ganhos nos circuitos. 15 pontos forjam uma Estrela Grande.</p>
        </div>
        <button type="button" onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}
          className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-border/60 px-2.5 py-1.5 text-[11px] font-bold text-text-muted hover:text-text-primary">
          <HelpCircle size={14} /> <span className="hidden sm:inline">Como funciona?</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showHelp && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="card p-3 space-y-2 text-xs text-text-secondary">
              <div className="flex flex-wrap gap-2">
                {STAR_CATEGORIES.map((c) => (
                  <span key={c.cat} className="flex items-center gap-1 bg-surface px-2 py-1 rounded-md border border-border/60">
                    <c.icon size={12} className={c.color} />
                    <span className={`font-bold tracking-wider ${c.color}`}>{c.label}</span>
                    <span className="text-text-muted font-mono">{c.points} pt</span>
                  </span>
                ))}
              </div>
              <p>Cada estrela soma pontos de mini estrela. Com 15 pontos o atleta forja uma 🌟 Estrela Grande e os contadores do ciclo voltam a zero.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Abas: uma parte por vez, sem rolar por cima das outras */}
      <div role="tablist" aria-label="Seções do Sistema de Estrelas" className="grid grid-flow-col auto-cols-fr gap-1 rounded-2xl border border-border/50 bg-surface/60 p-1 sm:inline-grid sm:auto-cols-max">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => choose(t.key)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors',
              tab === t.key ? 'bg-yellow-500 text-black shadow-sm' : 'text-text-muted hover:text-text-primary',
            )}>
            <t.icon size={14} className={tab === t.key && t.key === 'launch' ? 'fill-black' : ''} /> {t.label}
          </button>
        ))}
      </div>

      {/* As abas ficam montadas: trocar de aba não perde o rascunho */}
      {isStaff && <div role="tabpanel" hidden={tab !== 'launch'}><LaunchPanel active={tab === 'launch'} /></div>}
      <div role="tabpanel" hidden={tab !== 'board'}>{tab === 'board' && <Board />}</div>
      <div role="tabpanel" hidden={tab !== 'history'}><StarHistoryTimeline canUndo={isStaff} /></div>
    </div>
  );
}
