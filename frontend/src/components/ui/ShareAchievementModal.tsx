import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, Copy, Check, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  AchievementShareCard,
  type AchievementShareCardProps,
  type ShareAchievementType,
} from './AchievementShareCard';
import { cn } from '@/lib/utils';

export interface ShareModalProps extends Omit<AchievementShareCardProps, 'type'> {
  type: ShareAchievementType;
  isOpen: boolean;
  onClose: () => void;
  /** Mostra seletor de tipo — ideal para uso pelo admin */
  showTypeSelector?: boolean;
}

// Textos de parabéns para o modal
const CONGRATS: Record<ShareAchievementType, { title: string; subtitle: string }> = {
  big_star: {
    title: '🌟 Grande Estrela!',
    subtitle: 'Você virou uma Grande Estrela! Compartilhe essa conquista!',
  },
  fire_shark_top1: {
    title: '🦈 FIRE SHARK #1!',
    subtitle: 'Você é o Tubarão da Quadra! Bora mostrar pro mundo?',
  },
  top_wins: {
    title: '🏆 Top do Ranking!',
    subtitle: 'Você está entre os maiores gladiadores da quadra!',
  },
  mini_star: {
    title: '⭐ Estrela Ganha!',
    subtitle: 'Mais uma estrela no seu currículo. Compartilhe!',
  },
};

// Labels dos tipos de card
const TYPE_LABELS: Record<ShareAchievementType, { label: string; icon: string }> = {
  fire_shark_top1: { label: 'Fire Shark', icon: '🦈' },
  big_star: { label: 'Grande Estrela', icon: '🌟' },
  top_wins: { label: 'Gladiadores', icon: '🏆' },
  mini_star: { label: 'Mini Estrela', icon: '⭐' },
};

export function ShareAchievementModal({
  isOpen,
  onClose,
  showTypeSelector = false,
  ...cardProps
}: ShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tipo ativo — pode ser trocado pelo admin via selector
  const [activeType, setActiveType] = useState<ShareAchievementType>(cardProps.type);
  // Imagens pré-carregadas como Data URLs (evita taint do canvas)
  const [firesharkDataUrl, setFiresharkDataUrl] = useState<string>();
  const [escudoDataUrl, setEscudoDataUrl] = useState<string>();
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>();
  const [tubaraoFuriaDataUrl, setTubaraoFuriaDataUrl] = useState<string>();
  const [textoHellcifeDataUrl, setTextoHellcifeDataUrl] = useState<string>();

  const baseCongrats = CONGRATS[activeType];
  const congrats = { ...baseCongrats };
  
  if (activeType === 'fire_shark_top1' && cardProps.winRank) {
    congrats.title = `🦈 FIRE SHARK #${cardProps.winRank}!`;
    if (cardProps.winRank > 1) {
      congrats.subtitle = `Você está no Top ${cardProps.winRank} dos Tubarões! Bora mostrar pro mundo?`;
    }
  }

  // Sincroniza se o tipo externo mudar
  useEffect(() => {
    setActiveType(cardProps.type);
  }, [cardProps.type]);

  // Converte base64 -> Blob (Síncrono para preservar o User Gesture no click e garantir o filename .png)
  const dataURItoBlob = (dataURI: string) => {
    const split = dataURI.split(',');
    const byteString = atob(split[1]);
    const mimeString = split[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  };

  // Converte blob -> data URL via FileReader
  const toDataUrl = (blob: Blob): Promise<string> =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

  // Estratégia 1 (desktop/Android): fetch() com CORS — mais rápido e confiável onde há suporte
  const fetchCorsToDataUrl = async (url: string): Promise<string> => {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return toDataUrl(blob);
  };

  // Estratégia 2 (iOS Safari): Image() + canvas — WebKit não suporta fetch CORS para canvas
  // ATENÇÃO: sem cache-buster na URL para não quebrar o cache do Cloudinary
  const imgCanvasToDataUrl = (url: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 400;
          canvas.height = img.naturalHeight || 400;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('No 2d context'));
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          reject(new Error('Canvas tainted'));
        }
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });

  // Gera avatar de iniciais via canvas como fallback (sem depender de CORS)
  // Mantém as cores premium do card FireShark ao invés de laranja
  const generateInitialsDataUrl = (name: string): string => {
    const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    const size = 400;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#1a0a0a');
    grad.addColorStop(0.5, '#2d0808');
    grad.addColorStop(1, '#0a0000');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.6)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${size * 0.38}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(220,38,38,0.8)';
    ctx.shadowBlur = 20;
    ctx.fillText(initials, size / 2, size / 2);
    return canvas.toDataURL('image/png');
  };

  // Pré-carrega as imagens separadamente (tolerante a falhas individuais)
  useEffect(() => {
    let cancelled = false;
    async function loadImages() {
      try {
        const fetchLocal = async (url: string) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          return toDataUrl(blob);
        };

        const [r0, r1, r2, r3] = await Promise.allSettled([
          fetchLocal('/fireshark-bg.png'),
          fetchLocal('/escudo-hellcife-novo.png'),
          fetchLocal('/tubarao-furia.png'),
          fetchLocal('/texto-hellcife.jpeg'),
        ]);

        if (cancelled) return;
        if (r0.status === 'fulfilled') setFiresharkDataUrl(r0.value);
        if (r1.status === 'fulfilled') setEscudoDataUrl(r1.value);
        if (r2.status === 'fulfilled') setTubaraoFuriaDataUrl(r2.value);
        if (r3.status === 'fulfilled') setTextoHellcifeDataUrl(r3.value);

        // Avatar — 3 estratégias em cascata:
        // 1. fetch CORS (desktop/Android) → 2. Image+canvas (iOS) → 3. Iniciais (fallback final)
        if (cardProps.avatarUrl) {
          try {
            // Estratégia 1: fetch CORS — funciona no desktop e Android
            const dataUrl = await fetchCorsToDataUrl(cardProps.avatarUrl);
            if (!cancelled) setAvatarDataUrl(dataUrl);
          } catch {
            // Estratégia 1 falhou (provavelmente iOS) — tenta Image+canvas
            try {
              console.info('fetch CORS falhou, tentando Image+canvas (iOS)...');
              const dataUrl = await imgCanvasToDataUrl(cardProps.avatarUrl);
              if (!cancelled) setAvatarDataUrl(dataUrl);
            } catch {
              // Ambos falharam (CORS bloqueado totalmente) — usa iniciais via canvas
              console.warn('Avatar CORS bloqueado — usando iniciais como fallback');
              const initialsUrl = generateInitialsDataUrl(cardProps.athleteName);
              if (!cancelled && initialsUrl) setAvatarDataUrl(initialsUrl);
            }
          }
        }
      } catch (e) {
        console.warn('Falha no pré-carregamento de imagens:', e);
      }
    }
    loadImages();
    return () => { cancelled = true; };
  }, [cardProps.avatarUrl, cardProps.athleteName]);

  // Gera o preview assim que o modal abre
  // Aguarda as imagens estarem prontas para evitar canvas em branco no iOS
  const generatePreview = useCallback(async () => {
    if (!cardRef.current) return;
    setIsCapturing(true);
    setError(null);
    try {
      // iOS Safari: aguarda um tick adicional para garantir renderização DOM completa
      await new Promise(r => setTimeout(r, 100));

      // Hack WebKit/iOS: múltiplas capturas "aquece" o engine de renderização
      // e garante que imagens já em cache sejam usadas corretamente
      const warmupOptions = {
        cacheBust: false, // false no warmup para usar cache do browser
        style: { transform: 'scale(1)', transformOrigin: 'top left' },
      };
      await toPng(cardRef.current, warmupOptions).catch(() => {});
      await toPng(cardRef.current, warmupOptions).catch(() => {});

      // Captura final em alta resolução
      const url = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#000000', // Fundo preto explícito evita transparência laranja/branca no iOS
        cacheBust: false,
        style: { transform: 'scale(1)', transformOrigin: 'top left' },
      });
      setPreviewUrl(url);
    } catch (err) {
      console.error('Erro ao gerar imagem:', err);
      setError('Não foi possível gerar a imagem. Tente novamente.');
    } finally {
      setIsCapturing(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Delay de 1000ms: iOS Safari precisa de mais tempo para
      // renderizar o DOM e carregar as imagens (Data URLs) antes da captura
      const timer = setTimeout(() => generatePreview(), 1000);
      return () => clearTimeout(timer);
    } else {
      setPreviewUrl(null);
      setError(null);
    }
  }, [isOpen, activeType, generatePreview]);

  // ── Compartilhar via Web Share API (mobile nativo)
  const handleShare = useCallback(async () => {
    if (!previewUrl) return;

    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const file = new File([blob], 'hellcife-conquista.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: congrats.title,
          text: `${congrats.subtitle} 🏐 #HellcifeVolei`,
          files: [file],
        });
      } else {
        // Fallback: download da imagem
        handleDownload();
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        handleDownload();
      }
    }
  }, [previewUrl, congrats]);

  // ── Download da imagem
  const handleDownload = useCallback(() => {
    if (!previewUrl) return;
    try {
      const safeType = String(activeType).replace(/[^a-z0-9]/gi, '_');
      const filename = `hellcife-conquista-${safeType}.png`;

      const blob = dataURItoBlob(previewUrl);
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.style.display = 'none';

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (e) {
      console.error('Erro ao baixar:', e);
    }
  }, [previewUrl, activeType]);

  // ── Copiar texto alternativo
  const handleCopyText = useCallback(async () => {
    const text = `${congrats.subtitle} 🏐 #HellcifeVolei #Vôlei`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // silently fail
    }
  }, [congrats]);

  // ── WhatsApp share (texto + instrução para salvar imagem)
  const handleWhatsApp = useCallback(() => {
    handleDownload();
    const text = encodeURIComponent(
      `${congrats.subtitle} 🏐\n\n*${cardProps.athleteName}* no Hellcife Vôlei!\n#HellcifeVolei #Vôlei`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }, [congrats, cardProps.athleteName, handleDownload]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto relative w-full max-w-sm bg-[#0a0a0d] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative p-5 border-b border-white/10 bg-gradient-to-r from-[#0a0a0d] via-[#111015] to-[#0a0a0d]">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
                <div className="text-center pr-8">
                  <p className="text-xl font-black text-white tracking-wide">{congrats.title}</p>
                  <p className="text-xs text-gray-400 mt-1">{congrats.subtitle}</p>
                </div>
              </div>

              {/* Seletor de tipo — visível para admin */}
              {showTypeSelector && (
                <div className="px-4 pt-3 pb-0 grid grid-cols-4 gap-2">
                  {(Object.keys(TYPE_LABELS) as ShareAchievementType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        if (t !== activeType) {
                          setActiveType(t);
                          setPreviewUrl(null);
                        }
                      }}
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

              {/* Card invisível para captura — NUNCA passa o URL original como fallback.
                  Se avatarDataUrl for undefined (CORS bloqueado no iOS), o componente
                  mostrará as iniciais ao invés de tentar carregar uma URL externa que
                  taintaria o canvas e causaria o fundo laranja/branco. */}
              <div style={{
                position: 'absolute',
                top: '-9999px',   // Fora da viewport mas DENTRO do DOM (iOS não renderiza z-index negativo)
                left: 0,
                opacity: 0.001,   // Quase invisível mas renderizado pelo WebKit
                pointerEvents: 'none',
              }}>
                <AchievementShareCard
                  ref={cardRef}
                  {...cardProps}
                  type={activeType}
                  avatarUrl={avatarDataUrl} // SOMENTE Data URL — nunca URL original (evita canvas taint no iOS)
                  firesharkDataUrl={firesharkDataUrl}
                  escudoDataUrl={escudoDataUrl}
                  tubaraoFuriaDataUrl={tubaraoFuriaDataUrl}
                  textoHellcifeDataUrl={textoHellcifeDataUrl}
                />
              </div>

              {/* Preview da imagem */}
              <div className="flex justify-center bg-[#070709] py-4 overflow-hidden">
                <div className="relative" style={{ width: 188, height: 282, flexShrink: 0 }}>

                  {/* Overlay de loading sobre o preview */}
                  {isCapturing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 rounded-2xl backdrop-blur-sm">
                      <Loader2 size={24} className="text-orange-400 animate-spin" />
                      <p className="text-gray-300 text-xs font-medium">Gerando card...</p>
                    </div>
                  )}

                  {/* Overlay de erro */}
                  {error && !isCapturing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 rounded-2xl p-3 text-center">
                      <p className="text-red text-xs">{error}</p>
                      <button
                        onClick={generatePreview}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  )}

                  {/* Preview gerado */}
                  {previewUrl && !isCapturing && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative w-full h-full"
                    >
                      <img
                        src={previewUrl}
                        alt="Card de conquista"
                        className="w-full h-full rounded-2xl object-cover shadow-2xl"
                      />
                      {/* Shine effect */}
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                    </motion.div>
                  )}
                </div>
              </div>


              {/* Botões de Compartilhamento */}
              <div className="p-4 space-y-3">
                {/* Compartilhar (Web Share API / nativo) */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleShare}
                  disabled={!previewUrl || isCapturing}
                  className={cn(
                    'w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300',
                    previewUrl && !isCapturing
                      ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)]'
                      : 'bg-white/5 text-gray-500 cursor-not-allowed'
                  )}
                >
                  <Share2 size={18} />
                  Compartilhar Imagem
                </motion.button>

                {/* WhatsApp */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleWhatsApp}
                  disabled={!previewUrl || isCapturing}
                  className={cn(
                    'w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300',
                    previewUrl && !isCapturing
                      ? 'bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366]'
                      : 'bg-white/5 text-gray-500 cursor-not-allowed border border-transparent'
                  )}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Enviar no WhatsApp
                </motion.button>

                {/* Row: Download + Copiar */}
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleDownload}
                    disabled={!previewUrl || isCapturing}
                    className={cn(
                      'flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all duration-200',
                      previewUrl && !isCapturing
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
                    {copied ? 'Copiado!' : 'Copiar texto'}
                  </motion.button>
                </div>

                <p className="text-center text-[10px] text-gray-600 px-2">
                  💡 No celular, o botão "Compartilhar" abre o menu nativo do sistema
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
