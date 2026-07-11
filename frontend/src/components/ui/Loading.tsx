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
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-red/20" />
          <div className="absolute inset-0 rounded-full border-2 border-t-red animate-spin" />
        </div>
        <p className="text-text-muted text-sm tracking-wider uppercase font-medium">Carregando</p>
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
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      {icon && <span className="text-5xl">{icon}</span>}
      <p className="text-text-muted text-sm max-w-sm">{message}</p>
    </div>
  );
}
