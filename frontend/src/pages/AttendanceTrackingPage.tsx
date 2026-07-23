import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, CheckCircle2, History, X } from 'lucide-react';
import { playersService } from '@/services/players';
import api from '@/lib/api';
import { PageLoading, ErrorState, EmptyState } from '@/components/ui/Loading';
import { Avatar } from '@/components/ui/Avatar';
import toast from 'react-hot-toast';
import type { Player, Attendance } from '@/types';
import { Link } from 'react-router-dom';

export function AttendanceTrackingPage() {
  const [activeTab, setActiveTab] = useState<'frequency' | 'noshows'>('frequency');
  const qc = useQueryClient();

  // Query para Jogadores (Frequência)
  const { data: playersData, isLoading: isPlayersLoading, error: playersError } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersService.list({ page_size: 1000 }),
  });
  const players = playersData?.results || [];

  const { data: noShowsData, isLoading: isNoShowsLoading, error: noShowsError } = useQuery({
    queryKey: ['attendances', 'no-shows'],
    queryFn: async () => {
      const res = await api.get('/attendance/', {
        params: { was_no_show: 'True', page_size: 1000 }
      });
      return res.data;
    },
  });
  const noShows = Array.isArray(noShowsData) ? noShowsData : (noShowsData?.results || []);

  const justifyMutation = useMutation({
    mutationFn: async ({ id, text }: { id: number; text: string }) => {
      const res = await api.post(`/attendance/${id}/justify/`, { justification_text: text });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Falta justificada com sucesso!');
      qc.invalidateQueries({ queryKey: ['attendances', 'no-shows'] });
    },
    onError: () => toast.error('Erro ao justificar falta.')
  });

  if (isPlayersLoading || isNoShowsLoading) return <PageLoading />;
  if (playersError || noShowsError) return <ErrorState onRetry={() => qc.invalidateQueries()} />;

  // Filtragem de Jogadores
  const atRiskPlayers = players?.filter(p => p.consecutive_absences >= 8 && p.status === 'active').sort((a, b) => b.consecutive_absences - a.consecutive_absences) || [];
  const inactiveDueToAbsence = players?.filter(p => p.status === 'inactive' && p.consecutive_absences >= 10).sort((a, b) => b.consecutive_absences - a.consecutive_absences) || [];
  const otherPlayers = players?.filter(p => p.consecutive_absences < 8 && p.status === 'active').sort((a, b) => b.consecutive_absences - a.consecutive_absences) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-text-primary uppercase tracking-tight">Frequências e Faltas</h1>
        <p className="text-text-secondary mt-1">Gerencie faltas consecutivas e "No-shows" (nome na lista, mas não compareceu).</p>
      </div>

      <div className="flex gap-2 p-1 bg-surface-highlight rounded-lg w-full md:w-max">
        <button
          onClick={() => setActiveTab('frequency')}
          className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold transition-all ${
            activeTab === 'frequency' ? 'bg-red text-white shadow-md' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Risco de Inativação
        </button>
        <button
          onClick={() => setActiveTab('noshows')}
          className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold transition-all ${
            activeTab === 'noshows' ? 'bg-red text-white shadow-md' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Faltas (No-shows)
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'frequency' ? (
          <motion.div
            key="frequency"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Em risco */}
            <div className="card p-4">
              <h2 className="text-lg font-bold text-orange-500 flex items-center gap-2 mb-4">
                <AlertTriangle size={20} /> Em Risco de Inativação (8+ faltas seguidas)
              </h2>
              {atRiskPlayers.length === 0 ? (
                <p className="text-text-muted text-sm">Nenhum jogador em risco de inativação no momento.</p>
              ) : (
                <div className="space-y-3">
                  {atRiskPlayers.map(p => (
                    <PlayerRow key={p.id} player={p} warning />
                  ))}
                </div>
              )}
            </div>

            {/* Inativados */}
            <div className="card p-4 opacity-75">
              <h2 className="text-lg font-bold text-red flex items-center gap-2 mb-4">
                <ShieldAlert size={20} /> Inativados por Falta (10+ faltas seguidas)
              </h2>
              {inactiveDueToAbsence.length === 0 ? (
                <p className="text-text-muted text-sm">Nenhum jogador inativado por falta.</p>
              ) : (
                <div className="space-y-3">
                  {inactiveDueToAbsence.map(p => (
                    <PlayerRow key={p.id} player={p} error />
                  ))}
                </div>
              )}
            </div>

            {/* Outros Ativos */}
            <div className="card p-4">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4">
                <History size={20} /> Outros Jogadores Ativos
              </h2>
              {otherPlayers.length === 0 ? (
                <p className="text-text-muted text-sm">Sem outros jogadores.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {otherPlayers.map(p => (
                    <PlayerRow key={p.id} player={p} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="noshows"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="card p-4"
          >
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4">
              <AlertTriangle size={20} className="text-red" /> 
              Histórico de Faltas (No-shows)
            </h2>
            <p className="text-text-muted text-sm mb-4">Jogadores que colocaram o nome na lista, mas não fizeram check-in na quadra.</p>

            {noShows?.length === 0 ? (
              <EmptyState 
                icon="✅"
                message="Tudo certo! Não há registros de no-shows no sistema."
              />
            ) : (
              <div className="space-y-4">
                {noShows?.map((att: Attendance) => (
                  <NoShowRow 
                    key={att.id} 
                    attendance={att} 
                    onJustify={(text) => justifyMutation.mutate({ id: att.id, text })}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlayerRow({ player, warning, error }: { player: Player; warning?: boolean; error?: boolean }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${warning ? 'border-orange-500/30 bg-orange-500/5' : error ? 'border-red/30 bg-red/5' : 'border-border bg-surface'}`}>
      <div className="flex items-center gap-3">
        <Avatar name={player.display_name} src={player.avatar_url} size="sm" />
        <div>
          <p className="text-text-primary font-bold text-sm">{player.display_name}</p>
          <p className="text-text-muted text-xs">Posição: {player.main_position_display}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className={`font-black text-lg leading-none ${warning ? 'text-orange-500' : error ? 'text-red' : 'text-text-secondary'}`}>
            {player.consecutive_absences}
          </p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Faltas seguidas</p>
        </div>
        <Link to={`/players/${player.id}`} className="btn-secondary py-1 px-3 text-xs">
          Ver Perfil
        </Link>
      </div>
    </div>
  );
}

function NoShowRow({ attendance, onJustify }: { attendance: Attendance; onJustify: (text: string) => void }) {
  const [isJustifying, setIsJustifying] = useState(false);
  const [text, setText] = useState('');

  return (
    <div className={`p-4 rounded-lg border ${attendance.is_justified ? 'border-green-500/30 bg-green-500/5' : 'border-red/30 bg-red/5'}`}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <Avatar name={attendance.player_name} src={attendance.player_avatar} size="sm" />
          <div>
            <p className="text-text-primary font-bold text-sm">{attendance.player_name}</p>
            <p className="text-text-muted text-xs">ID do Circuito: #{attendance.gameday}</p>
          </div>
        </div>
        <div>
          {attendance.is_justified ? (
            <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded uppercase tracking-wider">
              Falta Justificada
            </span>
          ) : (
            <span className="text-[10px] font-bold text-red bg-red/10 px-2 py-1 rounded uppercase tracking-wider">
              No-show
            </span>
          )}
        </div>
      </div>

      {attendance.is_justified ? (
        <div className="mt-3 text-sm text-text-secondary bg-surface p-2 rounded border border-border">
          <strong className="text-text-primary text-xs uppercase tracking-wider block mb-1">Motivo da Justificativa:</strong>
          {attendance.justification_text}
        </div>
      ) : (
        <div className="mt-3">
          {!isJustifying ? (
            <button onClick={() => setIsJustifying(true)} className="btn-secondary py-1.5 px-3 text-xs w-full">
              Justificar Falta
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Motivo da justificativa..."
                className="input-base text-sm py-1.5 flex-1"
                value={text}
                onChange={e => setText(e.target.value)}
              />
              <button 
                onClick={() => {
                  if(text.trim()) onJustify(text);
                }}
                className="btn-primary py-1.5 px-3 text-xs"
              >
                Salvar
              </button>
              <button onClick={() => setIsJustifying(false)} className="btn-ghost p-1.5 text-text-muted">
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
