import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import type { EloRankingEntry } from '@/types';

interface EloRankingProps {
  entries: EloRankingEntry[];
  /** Prefixo do link de cada linha (abre a tela do jogador). */
  linkPrefix?: string;
  /** Página "Sistema de Elo" para o botão de ajuda. */
  rulesHref?: string;
  placementGames?: number;
}

// Cor da faixa (vinda do servidor) legível nos dois temas, no estilo das bordas da pasta inspiração.
const tierText = 'text-[color:color-mix(in_srgb,var(--tier)_75%,black)] dark:text-[color:color-mix(in_srgb,var(--tier)_60%,white)]';

export function EloRanking({ entries, linkPrefix, rulesHref, placementGames = 10 }: EloRankingProps) {
  return (
    <section className="rounded-[32px] border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-[#050505]/60 backdrop-blur-2xl overflow-hidden shadow-2xl">
      <header className="relative px-5 sm:px-6 pt-6 pb-4 border-b border-gray-200 dark:border-white/10 bg-gray-100/80 dark:bg-[#0b0b0f]/80 text-center">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-red/70 to-transparent" />
        <h2 className="font-display text-3xl sm:text-4xl tracking-wider text-text-primary leading-none">
          RANKING <span className="text-red">ELO</span>
        </h2>
        <p className="text-[10px] sm:text-[11px] text-text-muted font-bold uppercase tracking-[0.25em] mt-2">
          Elo da temporada · mínimo {placementGames} jogos
        </p>
        {rulesHref && (
          <Link
            to={rulesHref}
            className="mt-3 inline-flex items-center gap-1 rounded-lg border border-border/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted hover:text-text-primary hover:border-border transition-colors"
          >
            <Info size={12} /> Como funciona
          </Link>
        )}
      </header>

      {entries.length > 0 && <ol className="p-3 grid grid-cols-1 xl:grid-cols-2 gap-2">
        {entries.map((p) => {
          const row = (
            <div
              style={{ '--tier': p.tier_color } as CSSProperties}
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-2.5 sm:p-3 transition-colors',
                'border-[color:color-mix(in_srgb,var(--tier)_45%,transparent)]',
                'bg-[linear-gradient(90deg,color-mix(in_srgb,var(--tier)_14%,transparent),transparent_60%)]',
                linkPrefix && 'hover:border-[color:var(--tier)]'
              )}
            >
              <span
                className={cn(
                  'w-7 text-center font-display text-xl sm:text-2xl leading-none flex-shrink-0',
                  p.position <= 3 ? tierText : 'text-text-muted'
                )}
              >
                {p.position}
              </span>
              <Avatar
                name={p.name}
                src={p.avatar_url || undefined}
                size="md"
                className="ring-2 ring-[color:var(--tier)] flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate text-text-primary">{p.name}</p>
                <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider mt-0.5">
                  {p.wins} vitórias em {p.matches} jogos
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="font-display text-2xl sm:text-3xl leading-none text-text-primary">{p.elo}</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest',
                    'border-[color:color-mix(in_srgb,var(--tier)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--tier)_12%,transparent)]',
                    tierText
                  )}
                >
                  <span aria-hidden>{p.tier_icon}</span>
                  {p.tier_name}
                </span>
              </div>
            </div>
          );
          return (
            <li key={p.id}>
              {linkPrefix ? <Link to={`${linkPrefix}${p.id}`} className="block">{row}</Link> : row}
            </li>
          );
        })}
      </ol>}

      {entries.length === 0 && (
        <div className="px-6 py-8 text-center">
          <p className="text-text-primary font-bold text-sm">Ninguém completou a calibração ainda.</p>
          <p className="text-text-muted text-xs mt-1">
            O ranking aparece quando alguém chegar a {placementGames} jogos na temporada.
          </p>
        </div>
      )}
    </section>
  );
}
