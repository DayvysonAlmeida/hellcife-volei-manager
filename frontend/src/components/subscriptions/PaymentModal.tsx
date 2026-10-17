import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, CheckCircle2, Loader2, QrCode } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixCopyPaste: string;
  paymentUrl?: string;
  amount: number | string;
  isProcessing: boolean;
  paymentId?: string;
  onSuccess?: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  pixCopyPaste,
  amount,
  isProcessing,
  paymentId,
  onSuccess,
}: PaymentModalProps) {
  const [isCopied, copy] = useCopyToClipboard();
  const [successMode, setSuccessMode] = useState(false);

  // Se onSuccess for triggerado de fora, podemos ativar o modo sucesso
  // Para demo local, podemos simular o sucesso ao fechar ou adicionar um botão admin
  
  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {successMode ? (
            <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mb-2">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-bold text-text-primary">Pagamento Confirmado!</h3>
              <p className="text-text-secondary text-sm">
                Seus créditos foram liberados e sua assinatura está ativa. Aproveite!
              </p>
              <button
                onClick={() => {
                  setSuccessMode(false);
                  onClose();
                  onSuccess?.();
                }}
                className="mt-4 w-full bg-red text-white py-3 rounded-lg font-bold hover:bg-red-hover transition-colors"
              >
                Continuar
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border bg-card">
                <div className="flex items-center gap-2 text-text-primary">
                  <QrCode className="text-red" size={20} />
                  <h3 className="font-bold">Pagamento via PIX</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                <div className="text-center">
                  <p className="text-text-secondary text-sm mb-1">Valor a pagar</p>
                  <p className="text-3xl font-bold text-text-primary">
                    R$ {Number(amount).toFixed(2).replace('.', ',')}
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Fake QR Code box for visual */}
                  <div className="w-48 h-48 mx-auto bg-white rounded-xl p-2 flex items-center justify-center shadow-inner relative overflow-hidden">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCopyPaste || 'hellcife')}`} 
                      alt="QR Code PIX" 
                      className="w-full h-full object-contain"
                    />
                    {!pixCopyPaste && isProcessing && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <Loader2 className="animate-spin text-red" size={32} />
                      </div>
                    )}
                  </div>

                  {/* Copy Paste Code */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-text-secondary text-center">
                      Código PIX Copia e Cola
                    </p>
                    <div className="flex flex-col gap-3">
                      <div className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-text-muted break-all max-h-24 overflow-y-auto text-center font-mono">
                        {pixCopyPaste || 'Gerando código PIX...'}
                      </div>
                      <button
                        onClick={() => copy(pixCopyPaste)}
                        disabled={!pixCopyPaste}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-red hover:bg-red-hover text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                      >
                        {isCopied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                        {isCopied ? 'Código Copiado!' : 'Copiar Código PIX'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center justify-center gap-3 py-3 px-4 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                  <Loader2 className="animate-spin flex-shrink-0" size={18} />
                  <p className="text-sm font-medium">Aguardando confirmação do pagamento...</p>
                </div>
                
                {/* Botão de simulação de sucesso (APENAS PARA TESTE LOCAL) */}
                {import.meta.env.DEV && (
                   <button 
                     onClick={async () => {
                       if (paymentId) {
                         import('@/lib/api').then(({ default: api }) => {
                           const isSub = paymentId.startsWith('sub_');
                           api.post('/subscriptions/webhook/asaas/', {
                             event: 'PAYMENT_RECEIVED',
                             payment: { 
                               id: paymentId,
                               subscription: isSub ? paymentId : undefined
                             }
                           }).catch(console.error);
                         });
                       }
                       setSuccessMode(true);
                     }}
                     className="w-full text-xs text-text-muted hover:text-emerald-400 mt-2 text-center"
                   >
                     [Dev] Simular Pagamento Concluído
                   </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
