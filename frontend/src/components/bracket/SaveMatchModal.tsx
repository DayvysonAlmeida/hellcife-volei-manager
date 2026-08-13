import { motion, AnimatePresence } from 'framer-motion';
import { Save } from 'lucide-react';
import type { CourtTeam } from '@/types';

interface SaveMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  courtA: CourtTeam | null;
  courtB: CourtTeam | null;
  scoreA: number;
  scoreB: number;
}

export function SaveMatchModal({ 
  isOpen, 
  onClose, 
  onSave, 
  isSaving, 
  courtA, 
  courtB, 
  scoreA, 
  scoreB 
}: SaveMatchModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 md:p-8 border-b border-border bg-surface/50">
              <h2 className="font-display text-3xl mb-1 text-text-primary">Confirmar Resultado</h2>
              <p className="text-sm text-text-muted">Revise o placar final antes de salvar a partida.</p>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex flex-col items-center">
              {/* Placar Final */}
              <div className="flex justify-center items-center gap-8 mb-10 w-full bg-surface p-6 rounded-2xl border border-border shadow-inner">
                <div className="text-center w-1/3">
                  <span className="block text-sm md:text-base font-bold mb-2 uppercase tracking-wider truncate" style={{ color: courtA?.color_hex }}>{courtA?.name}</span>
                  <span className={`text-6xl md:text-7xl font-display font-bold ${scoreA >= scoreB ? 'text-yellow-400' : 'text-text-muted'}`}>{scoreA}</span>
                </div>
                <span className="text-text-muted text-2xl font-display opacity-50 flex-shrink-0">X</span>
                <div className="text-center w-1/3">
                  <span className="block text-sm md:text-base font-bold mb-2 uppercase tracking-wider truncate" style={{ color: courtB?.color_hex }}>{courtB?.name}</span>
                  <span className={`text-6xl md:text-7xl font-display font-bold ${scoreB >= scoreA ? 'text-yellow-400' : 'text-text-muted'}`}>{scoreB}</span>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-6 border-t border-border bg-surface/50 flex gap-4">
              <button
                className="btn-secondary flex-1 py-4 text-lg font-bold"
                onClick={onClose}
                disabled={isSaving}
              >
                Voltar
              </button>
              <button
                className="btn-primary flex-[2] flex items-center justify-center gap-2 py-4 text-lg font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                onClick={onSave}
                disabled={isSaving}
              >
                <Save size={20} />
                {isSaving ? 'Salvando...' : 'Confirmar Resultado'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
