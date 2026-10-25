import { Check, Copy, MessageCircle } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

/** Mensagem de boas-vindas pronta: abre o WhatsApp da staff para o número do atleta, ou copia o texto. */
export function WelcomeShare({ text, whatsappUrl }: { text: string; whatsappUrl: string }) {
  const [copied, copy] = useCopyToClipboard();

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line rounded-xl border border-border/50 bg-background/60 p-3 text-xs text-text-secondary">{text}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        {whatsappUrl ? (
          <a href={whatsappUrl} target="_blank" rel="noreferrer" className="btn-primary text-sm inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 border-none">
            <MessageCircle size={16} /> Enviar boas-vindas no WhatsApp
          </a>
        ) : (
          <p className="text-xs text-text-muted">Sem WhatsApp no cadastro: copie a mensagem e envie por onde preferir.</p>
        )}
        <button type="button" className="btn-secondary text-sm inline-flex items-center justify-center gap-2"
          onClick={() => copy(text)}>
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado!' : 'Copiar mensagem'}
        </button>
      </div>
    </div>
  );
}
