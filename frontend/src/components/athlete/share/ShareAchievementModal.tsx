import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, Copy, Check, Loader2 } from 'lucide-react';
import {
  renderAchievementCard,
  shareCaption,
  type AchievementShareCardProps,
  type ShareAchievementType,
} from './achievementCard';
import { cn } from '@/lib/utils';
import { SHARE_TYPE_ORDER, type ShareVariants } from './shareVariants';

export interface ShareModalProps extends Omit<AchievementShareCardProps, 'type'> {
  type: ShareAchievementType;
  isOpen: boolean;
  onClose: () => void;
  /**
   * Admin: um card por conquista do atleta, cada um com os seus dados.
   * Com mais de um, aparece o seletor (só com os cards conquistados).
   */
  variants?: ShareVariants;
}

const CONGRATS: Record<ShareAchievementType, { title: string; subtitle: string }> = {
  big_star: {
    title: '🌟 Grande Estrela!',
    subtitle: 'Você virou uma Grande Estrela! Compartilhe essa conquista!',
  },
  fire_shark_top1: {
    title: '🦈 Fire Shark!',
    subtitle: 'Você está no ranking dos Tubarões da Quadra. Bora mostrar pro mundo?',
  },
  top_wins: {
    title: '🏆 Gladiador!',
    subtitle: 'Você está entre os maiores vencedores da quadra!',
  },
  mini_star: {
    title: '⭐ Estrela Ganha!',
    subtitle: 'Mais uma estrela no seu currículo. Compartilhe!',
  },
};

const TYPE_LABELS: Record<ShareAchievementType, { label: string; icon: string }> = {
  fire_shark_top1: { label: 'Fire Shark', icon: '🦈' },
  big_star: { label: 'Grande Estrela', icon: '🌟' },
  top_wins: { label: 'Gladiadores', icon: '🏆' },
  mini_star: { label: 'Mini Estrela', icon: '⭐' },
};

const isIOS = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

type CardState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; file: File; url: string };

export function ShareAchievementModal({
  isOpen,
  onClose,
  variants,
  ...cardProps
}: ShareModalProps) {
  const availableTypes = variants ? SHARE_TYPE_ORDER.filter((t) => variants[t]) : [];
  const showTypeSelector = availableTypes.length > 1;
  const [activeType, setActiveType] = useState<ShareAchievementType>(cardProps.type);
  const [card, setCard] = useState<CardState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setActiveType(cardProps.type);
  }, [cardProps.type]);

  // Cada tipo usa os dados da sua conquista. cardProps/variants são objetos novos a cada
  // render; a chave serializada evita regerar à toa.
  const dataKey = JSON.stringify(variants?.[activeType] ?? cardProps);
  const cardData = useMemo<AchievementShareCardProps>(
    () => ({ ...JSON.parse(dataKey), type: activeType }),
    [dataKey, activeType],
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setCard({ status: 'loading' });

    renderAchievementCard(cardData)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        const file = new File([blob], `hellcife-${cardData.type}.jpg`, { type: blob.type });
        setCard({ status: 'ready', file, url: objectUrl });
      })
      .catch((err) => {
        console.error('Erro ao gerar card:', err);
        if (!cancelled) setCard({ status: 'error' });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, cardData, attempt]);

  const ready = card.status === 'ready' ? card : null;
  const canShareFiles = useMemo(
    () => !!ready && typeof navigator.canShare === 'function' && navigator.canShare({ files: [ready.file] }),
    [ready],
  );
  const congrats = CONGRATS[activeType];

  // navigator.share precisa ser chamado direto no toque (sem await antes), senão o iOS recusa
  const shareFile = useCallback(() => {
    if (!ready) return;
    navigator.share({ files: [ready.file], title: congrats.title }).catch((err: DOMException) => {
      if (err?.name !== 'AbortError') console.error('Erro ao compartilhar:', err);
    });
  }, [ready, congrats.title]);

  const download = useCallback(() => {
    if (!ready) return;
    const a = document.createElement('a');
    a.href = ready.url;
    a.download = ready.file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [ready]);

  const handleShare = () => (canShareFiles ? shareFile() : download());
  // No iPhone o download direto não funciona no app instalado; o menu de compartilhar tem "Salvar Imagem"
  const handleSave = () => (canShareFiles && isIOS() ? shareFile() : download());

  const handleCopyText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareCaption(cardData));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard indisponível
    }
  }, [cardData]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="share-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        key="share-dialog"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto relative w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#0a0a0d] border border-white/10 rounded-[32px] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-5 border-b border-white/10 bg-gradient-to-r from-[#0a0a0d] via-[#111015] to-[#0a0a0d]">
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
            <div className="text-center pr-8">
              <p className="text-xl font-black text-white tracking-wide">{congrats.title}</p>
              <p className="text-xs text-gray-400 mt-1">
                {variants ? `Card de ${cardData.athleteName} pronto para compartilhar.` : congrats.subtitle}
              </p>
            </div>
          </div>

          {/* Seletor de tipo (admin): só os cards que o atleta conquistou */}
          {showTypeSelector && (
            <div
              className="px-4 pt-3 grid gap-2"
              style={{ gridTemplateColumns: `repeat(${availableTypes.length}, minmax(0, 1fr))` }}
            >
              {availableTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveType(t)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all duration-200 text-xs font-medium',
                    activeType === t
                      ? 'bg-orange-500/15 border-orange-500/50 text-orange-400'
                      : 'bg-white/[0.03] border-white/10 text-gray-500 hover:bg-white/5 hover:text-gray-300'
                  )}
                >
                  <span className="text-lg leading-none">{TYPE_LABELS[t].icon}</span>
                  <span className="leading-tight">{TYPE_LABELS[t].label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Preview (9:16, formato Stories) */}
          <div className="flex justify-center bg-[#070709] py-4">
            <div className="relative aspect-[9/16] h-[min(48dvh,420px)] rounded-2xl overflow-hidden bg-white/[0.03]">
              {card.status === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Loader2 size={24} className="text-orange-400 animate-spin" />
                  <p className="text-gray-300 text-xs font-medium">Gerando card...</p>
                </div>
              )}
              {card.status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
                  <p className="text-red text-xs">Não foi possível gerar a imagem.</p>
                  <button
                    onClick={() => setAttempt((n) => n + 1)}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
              {ready && (
                <motion.img
                  key={ready.url}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={ready.url}
                  alt="Card de conquista"
                  className="w-full h-full object-cover shadow-2xl"
                />
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="p-4 space-y-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleShare}
              disabled={!ready}
              className={cn(
                'w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300',
                ready
                  ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]'
                  : 'bg-white/5 text-gray-500 cursor-not-allowed'
              )}
            >
              {canShareFiles || !ready ? <Share2 size={18} /> : <Download size={18} />}
              {canShareFiles || !ready ? 'Compartilhar' : 'Baixar imagem'}
            </motion.button>

            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={!ready}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all duration-200',
                  ready
                    ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200'
                    : 'bg-white/[0.03] text-gray-600 cursor-not-allowed border border-transparent'
                )}
              >
                <Download size={16} />
                Salvar
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCopyText}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 transition-all duration-200"
              >
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar legenda'}
              </motion.button>
            </div>

            <p className="text-center text-[10px] text-gray-500 px-2">
              💡 "Compartilhar" abre o menu do celular: WhatsApp, Instagram Stories e mais
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
