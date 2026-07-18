import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, DollarSign, Users, ClipboardList } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { attendanceService } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { LoadingSpinner } from '@/components/ui/Loading';

interface AttendanceModalProps {
  gamedayId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function AttendanceModal({ gamedayId, isOpen, onClose }: AttendanceModalProps) {
  const { user } = useAuth();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';
  const qc = useQueryClient();

  const { data: gameDay, isLoading } = useQuery({
    queryKey: ['gameday', gamedayId],
    queryFn: () => attendanceService.getGameDay(gamedayId),
    enabled: isOpen && !!gamedayId,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ playerId }: { playerId: number }) =>
      attendanceService.toggleAttendance(gamedayId, playerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gameday', gamedayId] }),
  });

  const togglePaymentMutation = useMutation({
    mutationFn: ({ playerId }: { playerId: number }) =>
      attendanceService.togglePayment(gamedayId, playerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gameday', gamedayId] }),
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-card w-full max-w-xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 md:p-6 border-b border-border bg-surface flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl md:text-2xl text-text-primary flex items-center gap-2">
                <ClipboardList className="text-red" />
                Prancheta de Chamada
              </h2>
              <p className="text-xs text-text-muted mt-1">Veja quem pagou e faça o check-in na hora.</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-surface rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
            {isLoading || !gameDay ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-50">
                <LoadingSpinner />
                <p className="mt-4 text-sm font-medium uppercase tracking-wider">Carregando lista...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4 bg-surface p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-red" />
                    <span className="font-bold text-sm tracking-widest uppercase">
                      Presentes: {gameDay.total_present}/{gameDay.total_players}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {gameDay.attendances.map((att) => (
                    <div
                      key={att.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                        ${att.present
                            ? 'bg-green-950/20 border-green-800/30'
                            : 'bg-surface border-border hover:border-border-subtle'
                        }`}
                    >
                      <Avatar name={att.player_name} src={att.player_avatar} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary text-sm font-medium truncate">
                          {att.player_name}
                        </p>
                        <PositionBadge position={att.player_position} />
                      </div>

                      {canEdit ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => togglePaymentMutation.mutate({ playerId: att.player })}
                            className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                              att.has_paid 
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' 
                                : 'bg-surface border-2 border-border-subtle text-text-muted hover:border-green-500 hover:text-green-500'
                            }`}
                            title="Alternar Pagamento"
                          >
                            <DollarSign size={16} />
                          </button>
                          <button
                            onClick={() => toggleMutation.mutate({ playerId: att.player })}
                            className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                              att.present 
                                ? 'bg-red text-white shadow-lg shadow-red/20 scale-110' 
                                : 'bg-surface border-2 border-border-subtle text-text-muted hover:border-red hover:text-red'
                            }`}
                            title="Alternar Presença"
                          >
                            {att.present && <Check size={16} />}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${att.has_paid ? 'bg-green-500' : 'bg-border'}`}>
                            {att.has_paid && <DollarSign size={12} className="text-white" />}
                          </div>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${att.present ? 'bg-red' : 'bg-border'}`}>
                            {att.present && <Check size={12} className="text-white" />}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
