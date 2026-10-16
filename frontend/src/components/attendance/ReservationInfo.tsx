import { useEffect, useState } from 'react';
import { Copy, Timer } from 'lucide-react';
import toast from 'react-hot-toast';

import { reservationTimeLeft } from '@/lib/reservation';
import { cn } from '@/lib/utils';

/** Prazo da reserva, atualizado a cada 30s. */
export function ReservationCountdown({ until, className }: { until?: string | null; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const left = reservationTimeLeft(until);
  if (!left) return null;
  return (
    <span className={cn('inline-flex items-center gap-1', left.expired ? 'text-red' : 'text-orange-400', className)}>
      <Timer size={12} />
      {left.expired ? 'Prazo vencido' : `Pague em ${left.label}`}
    </span>
  );
}

export function CopyPixButton({ pixKey, className }: { pixKey: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(pixKey).then(
          () => toast.success('Chave PIX copiada! 💸'),
          () => toast(`Chave PIX: ${pixKey}`, { icon: '💸', duration: 8000 }),
        );
      }}
      className={cn(
        'bg-green-500/10 hover:bg-green-500/20 text-green-400 font-bold rounded-lg px-3 py-1.5 text-xs transition-colors inline-flex items-center justify-center gap-1.5',
        className,
      )}
    >
      <Copy size={12} /> Copiar PIX
    </button>
  );
}
