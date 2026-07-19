import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDestructive = true,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-md bg-card border border-border p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in-0 duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              {isDestructive && (
                <div className="p-2 bg-red/10 rounded-full text-red">
                  <AlertTriangle size={24} />
                </div>
              )}
              <Dialog.Title className="font-display text-xl text-text-primary">
                {title}
              </Dialog.Title>
            </div>
            <Dialog.Close className="text-text-muted hover:text-text-primary transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>
          
          <Dialog.Description className="text-text-secondary mb-6">
            {description}
          </Dialog.Description>
          
          <div className="flex gap-3 justify-end">
            <Dialog.Close asChild>
              <button className="btn-secondary px-4 py-2 text-sm font-bold">
                {cancelText}
              </button>
            </Dialog.Close>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                isDestructive 
                  ? 'bg-red hover:bg-red/90 text-white shadow-neon-red' 
                  : 'btn-primary'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
