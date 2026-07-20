import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Componente de paginação reutilizável.
 * Exibe controles Anterior / indicador de página / Próximo.
 */
export function Pagination({ count, page, pageSize, onPageChange, className }: PaginationProps) {
  const totalPages = Math.ceil(count / pageSize);
  if (totalPages <= 1) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  // Gera array de páginas visíveis (máx. 7 itens com elipses)
  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | '...')[] = [1];

    if (page > 3) pages.push('...');

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let i = start; i <= end; i++) pages.push(i);

    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);

    return pages;
  };

  return (
    <div className={cn('flex items-center justify-between gap-4 pt-4', className)}>
      {/* Info */}
      <p className="text-text-muted text-xs hidden sm:block">
        Página <span className="text-text-primary font-medium">{page}</span> de{' '}
        <span className="text-text-primary font-medium">{totalPages}</span>
        <span className="ml-2 text-text-muted">({count} total)</span>
      </p>

      {/* Controls */}
      <div className="flex items-center gap-1 ml-auto">
        {/* Prev */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          className={cn(
            'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all',
            canPrev
              ? 'text-text-secondary hover:bg-surface hover:text-text-primary'
              : 'text-text-muted opacity-40 cursor-not-allowed'
          )}
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">Anterior</span>
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-text-muted text-sm">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                className={cn(
                  'w-9 h-9 rounded-lg text-sm font-medium transition-all',
                  p === page
                    ? 'bg-red text-white shadow-neon-red-sm'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                )}
              >
                {p}
              </button>
            )
          )}
        </div>

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          className={cn(
            'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all',
            canNext
              ? 'text-text-secondary hover:bg-surface hover:text-text-primary'
              : 'text-text-muted opacity-40 cursor-not-allowed'
          )}
        >
          <span className="hidden sm:inline">Próximo</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
