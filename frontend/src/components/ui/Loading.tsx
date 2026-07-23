import { Loader2 } from 'lucide-react';

interface LoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ message = 'Carregando...', size = 'md' }: LoadingProps) {
  const sizeClass = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }[size];

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Loader2 className={`${sizeClass} text-red animate-spin`} />
      <p className="text-text-muted text-sm">{message}</p>
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-red/10" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red border-r-red animate-spin" />
          <Loader2 className="w-6 h-6 text-red animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-text-primary text-sm font-bold tracking-widest uppercase">Carregando</p>
          <p className="text-text-muted text-xs">Preparando o ambiente...</p>
        </div>
      </div>
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Ocorreu um erro ao carregar os dados.', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="w-12 h-12 rounded-full bg-red/10 flex items-center justify-center">
        <span className="text-red text-xl">!</span>
      </div>
      <div className="text-center">
        <p className="text-text-primary font-medium">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="btn-primary mt-4 text-sm">
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ message, icon }: { message: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center rounded-2xl border-2 border-dashed border-border bg-surface/30">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-surface-highlight flex items-center justify-center text-4xl shadow-sm mb-2">
          {icon}
        </div>
      )}
      <p className="text-text-muted text-sm font-medium max-w-sm leading-relaxed">{message}</p>
    </div>
  );
}
