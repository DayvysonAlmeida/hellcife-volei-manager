import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, BadgeCheck, QrCode, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { attendanceService } from '@/services';
import { cn, formatBRL } from '@/lib/utils';
import { invalidatePaymentQueries } from '@/lib/paymentQueries';
import type { ManualPaymentMethod, Money } from '@/types';

export interface PaymentTarget {
  gamedayId: number;
  playerId: number;
  playerName: string;
  amountDue: Money | null | undefined;
  claimed?: boolean;
  isReserved?: boolean;
}

const METHODS: Array<{ value: ManualPaymentMethod; label: string; icon: typeof QrCode }> = [
  { value: 'pix_manual', label: 'PIX', icon: QrCode },
  { value: 'cash', label: 'Dinheiro', icon: Banknote },
  { value: 'exempt', label: 'Isento', icon: BadgeCheck },
];

export function PaymentConfirmModal({ target, onClose }: { target: PaymentTarget | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<ManualPaymentMethod>('pix_manual');
  const [amount, setAmount] = useState<number | ''>('');

  useEffect(() => {
    if (target) {
      setMethod('pix_manual');
      setAmount(target.amountDue != null ? Number(target.amountDue) : '');
    }
  }, [target]);

  const mutation = useMutation({
    mutationFn: () =>
      attendanceService.confirmPayment(
        target!.gamedayId,
        target!.playerId,
        method,
        method === 'exempt' || amount === '' ? undefined : amount,
      ),
    onSuccess: () => {
      invalidatePaymentQueries(qc, target!.gamedayId);
      toast.success(method === 'exempt' ? 'Participação liberada (isento).' : 'Pagamento confirmado!');
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Erro ao confirmar pagamento.'),
  });

  return (
    <Dialog.Root open={!!target} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95%] max-w-sm bg-surface border border-border p-6 rounded-2xl shadow-2xl">
          <div className="flex justify-between items-start mb-1">
            <Dialog.Title className="font-display text-xl tracking-wider text-text-primary">Confirmar pagamento</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text-primary transition-colors" aria-label="Fechar">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-text-secondary text-sm mb-5">
            <strong className="text-text-primary">{target?.playerName}</strong>
            {target?.claimed && ' avisou que já pagou.'}
            {target?.isReserved && ' A vaga será confirmada.'}
          </Dialog.Description>

          <p className="text-text-muted text-xs uppercase tracking-wider mb-2">Forma de pagamento</p>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {METHODS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMethod(value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-bold transition-colors',
                  method === value
                    ? 'border-green-500/60 bg-green-500/10 text-green-400'
                    : 'border-border text-text-muted hover:text-text-primary hover:border-text-muted'
                )}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>

          {method !== 'exempt' ? (
            <div className="mb-6">
              <label className="text-text-muted text-xs uppercase tracking-wider">Valor recebido (R$)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="input w-full mt-1"
              />
              {target?.amountDue != null && amount !== '' && amount !== Number(target.amountDue) && (
                <p className="text-[11px] text-orange-400 mt-1">Valor devido: {formatBRL(target.amountDue)}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-text-muted mb-6">A participação é liberada sem cobrança e fica registrada como isenta.</p>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end">
            <Dialog.Close asChild>
              <button className="btn-secondary px-4 py-2 text-sm font-bold">Cancelar</button>
            </Dialog.Close>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || (method !== 'exempt' && amount === '')}
              className="btn-primary px-4 py-2 text-sm font-bold"
            >
              {mutation.isPending ? 'Confirmando...' : 'Confirmar'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
