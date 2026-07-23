import { RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface SyncButtonProps {
  onSync: () => void;
  isSyncing?: boolean;
}

export function SyncButton({ onSync, isSyncing = false }: SyncButtonProps) {
  const [localSpin, setLocalSpin] = useState(false);

  const handleClick = () => {
    setLocalSpin(true);
    onSync();
    // Garante que a animação dure pelo menos 1 segundo para dar bom feedback visual
    setTimeout(() => {
      setLocalSpin(false);
    }, 1000);
  };

  const spinning = isSyncing || localSpin;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleClick}
          disabled={spinning}
          className={`
            flex items-center justify-center
            w-14 h-14 rounded-full
            bg-red text-white shadow-neon-red
            hover:bg-red/90 transition-colors
            focus:outline-none focus:ring-4 focus:ring-red/30
          `}
          title="Sincronizar Dados"
          aria-label="Sincronizar Dados"
        >
          <RefreshCw size={24} className={spinning ? 'animate-spin' : ''} />
        </motion.button>
      </AnimatePresence>
    </div>
  );
}
