import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Shuffle, Zap, Save, RefreshCw, Users, Send, Trash2, ArrowRightLeft, Trophy, Lock, History, Plus, X, UserCheck, Loader2, Swords } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { OverallBadge } from '@/components/ui/OverallBadge';
import { PositionBadge } from '@/components/ui/Badges';
import { PageLoading } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SyncButton } from '@/components/ui/SyncButton';
import { GenerationCard } from '@/components/teams/GenerationCard';
import { TeamCard } from '@/components/teams/TeamCard';
import { teamsService, attendanceService } from '@/services';
import { playersService } from '@/services/players';
import { MODALITY_LABELS } from '@/types';
import type { GenerateTeamsResult, GeneratedTeam, Modality } from '@/types';
import { useAuth } from '@/store/AuthContext';
import { formatDate } from '@/lib/utils';

const MODALITIES: Modality[] = [2, 3, 4, 5, 6];

export function TeamsPage() {
  const { user } = useAuth();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';

  const qc = useQueryClient();

  const [modality, setModality] = useState<Modality>(6);
  const [selectedGameDayId, setSelectedGameDayId] = useState<number | null>(null);
  const [result, setResult] = useState<GenerateTeamsResult | null>(null);
  const [activeTab, setActiveTab] = useState<'gerador' | 'historico'>('gerador');
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', desc: '', onConfirm: () => {} });



  const { data: allPlayersData } = useQuery({
    queryKey: ['all-players'],
    queryFn: () => playersService.list({ is_active: true, page_size: 200 }),
  });
  const allPlayers = allPlayersData?.results || [];

  const { data: gameDaysData } = useQuery({
    queryKey: ['gamedays'],
    queryFn: () => attendanceService.listGameDays({ page_size: 100 }),
  });

  const gameDays = gameDaysData?.results || [];

  const todayStr = new Date().toLocaleDateString('en-CA');
  
  const { upcomingGameDays, pastGameDays } = useMemo(() => {
    const upcomingGameDays = gameDays?.filter(gd => !gd.is_closed && gd.date >= todayStr) || [];
    const pastGameDays = gameDays?.filter(gd => gd.is_closed || gd.date < todayStr) || [];
    return { upcomingGameDays, pastGameDays };
  }, [gameDays, todayStr]);

  // Auto-selecionar o próximo jogo se nenhum estiver selecionado
  useEffect(() => {
    if (gameDays.length > 0 && selectedGameDayId === null) {
      if (upcomingGameDays.length > 0) {
        setSelectedGameDayId(upcomingGameDays[upcomingGameDays.length - 1].id);
      }
    }
  }, [gameDays.length, selectedGameDayId, upcomingGameDays]);

  const generateMutation = useMutation({
    mutationFn: () => teamsService.generate({
      modality,
      gameday_id: selectedGameDayId || undefined,
      save: false,
    }),
    onSuccess: (data) => setResult(data),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedGameDayId) {
        toast.error('Selecione um Dia de Jogo para poder salvar os times!');
        return Promise.reject(new Error('No gameday selected'));
      }
      if (!result) {
        return Promise.reject(new Error('No result to save'));
      }
      return teamsService.saveGenerated({
        modality,
        gameday_id: selectedGameDayId,
        result: result,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-generations-history'] });
      toast.success('Times salvos com sucesso no histórico!');
    },
  });

  const handleShareWhatsApp = () => {
    if (!result) return;
    
    let text = `🏆 *TIMES GERADOS - HELLCIFE VÔLEI* 🏆\n\n`;
    text += `Modalidade: ${modality}v${modality}\n`;
    text += `Balanceamento: ${(10 - result.balance_score * 10).toFixed(1)}%\n\n`;

    result.teams.forEach((team) => {
      text += `*${team.name.toUpperCase()}* (Overall: ${team.avg_overall.toFixed(1)})\n`;
      team.players.forEach((p, idx) => {
        const posStr = p.main_position.charAt(0).toUpperCase() + p.main_position.slice(1);
        text += `${idx + 1}. ${p.display_name} (${posStr})\n`;
      });
      text += '\n';
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">Geração de Times (Pelada)</h1>
        <div className="card p-8 text-center">
          <Shuffle size={48} className="text-red mx-auto mb-4 opacity-50" />
          <p className="text-text-muted">Apenas administradores e moderadores podem gerar times.</p>
        </div>
      </div>
    );
  }

  const { data: historyData } = useQuery({
    queryKey: ['team-generations-history'],
    queryFn: () => teamsService.list(),
  });
  const history = historyData?.results || [];

  const handleGenerate = () => {
    if (!selectedGameDayId) {
      toast.error('Selecione um dia de jogo para gerar os times.');
      return;
    }

    const alreadyGenerated = history.some(h => h.gameday === selectedGameDayId);
    
    // Se já existe e a pessoa ainda não gerou um novo (result é null)
    if (alreadyGenerated && !result) {
      setConfirmDialog({
        isOpen: true,
        title: 'Pelada Já Gerada!',
        desc: 'Já existe um sorteio salvo para esta pelada no histórico. Tem certeza que deseja gerar uma nova combinação? Isso não apagará a anterior até que você decida salvá-la.',
        onConfirm: () => {
          setConfirmDialog(s => ({ ...s, isOpen: false }));
          generateMutation.mutate();
        }
      });
    } else {
      generateMutation.mutate();
    }
  };


  return (
    <div className="space-y-6">
      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        onOpenChange={(isOpen) => setConfirmDialog(s => ({ ...s, isOpen }))}
        title={confirmDialog.title}
        description={confirmDialog.desc}
        onConfirm={confirmDialog.onConfirm}
      />

      <div className="flex justify-between items-start">
        <div>
          <h1 className="page-title">Geração de Times (Pelada)</h1>
          <p className="page-subtitle">Aqui você sorteia os times com base na presença (balanceando Overall, Posição e Sexo), e pode ir preenchendo as vagas livremente de acordo com quem vai chegando para adaptar o jogo atual.</p>
        </div>
      </div>
      
      <SyncButton 
        onSync={() => {
          qc.invalidateQueries({ queryKey: ['team-generations-history'] });
          qc.invalidateQueries({ queryKey: ['gamedays'] });
          qc.invalidateQueries({ queryKey: ['all-players'] });
          toast.success('Dados sincronizados!');
        }} 
      />

      <div className="flex gap-2 p-1 bg-surface border border-border rounded-xl">
        <button
          onClick={() => setActiveTab('gerador')}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
            activeTab === 'gerador'
              ? 'bg-red text-white shadow-neon-red'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          Sorteio e Pelada Ativa
        </button>
        <button
          onClick={() => setActiveTab('historico')}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
            activeTab === 'historico'
              ? 'bg-red text-white shadow-neon-red'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          Histórico
        </button>
      </div>

      {activeTab === 'gerador' && (
        <div className="space-y-4">
          {/* Config */}
          <div className="card p-4 md:p-5">
            <h2 className="font-display text-xs tracking-wider text-text-primary mb-3">CONFIGURAÇÃO DO SORTEIO</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Modality */}
              <div>
                <label className="text-text-muted text-[10px] uppercase tracking-wider block mb-1.5">Modalidade</label>
                <div className="flex gap-1.5 flex-wrap">
                  {MODALITIES.map((m) => (
                    <button
                      key={m}
                      onClick={() => setModality(m)}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-all
                        ${modality === m
                          ? 'bg-red text-white shadow-neon-red'
                          : 'bg-surface border border-border text-text-muted hover:border-border-subtle'
                        }`}
                    >
                      {m}v{m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Game day */}
              <div>
                <label className="text-text-muted text-[10px] uppercase tracking-wider block mb-1.5">
                  Dia de jogo (Filtra quem está na quadra)
                </label>
                <select
                  className="input w-full text-xs py-1.5 px-3 h-auto"
                  value={selectedGameDayId || ''}
                  onChange={(e) => setSelectedGameDayId(Number(e.target.value) || null)}
                >
                  <option value="">Selecione a pelada</option>
                  
                  {upcomingGameDays.length > 0 && (
                    <optgroup label="🔴 Peladas Abertas">
                      {upcomingGameDays.map(gd => (
                        <option key={gd.id} value={gd.id}>
                          {gd.date === todayStr ? '[HOJE] ' : ''}
                          {formatDate(gd.date)} {gd.time ? `- ${gd.time.slice(0, 5)}` : ''} {gd.location ? `- ${gd.location}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {pastGameDays.length > 0 && (
                    <optgroup label="🔒 Histórico (Encerradas)">
                      {pastGameDays.map(gd => (
                        <option key={gd.id} value={gd.id}>
                          {formatDate(gd.date)} {gd.time ? `- ${gd.time.slice(0, 5)}` : ''} {gd.location ? `- ${gd.location}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              {selectedGameDayId && gameDays.find((g: any) => g.id === selectedGameDayId)?.is_closed ? (
                <div className="flex items-center gap-1.5 text-red font-bold text-xs bg-red/10 px-3 py-1.5 rounded border border-red/20 w-full sm:w-auto">
                  <Lock size={14} />
                  Geração bloqueada (Encerrada).
                </div>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="btn-primary text-xs px-4 py-2 flex-1 sm:flex-none flex items-center justify-center gap-2"
                >
                  {generateMutation.isPending ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Zap size={14} />
                  )}
                  {result ? 'Regerar times' : 'Gerar times'}
                </button>
              )}
              
              {result && (
                <>
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="btn-secondary text-xs px-3 py-2 flex-1 sm:flex-none flex items-center justify-center gap-1.5"
                  >
                    <Save size={14} />
                    Salvar Sorteio
                  </button>
                  <button
                    onClick={handleShareWhatsApp}
                    className="btn-ghost text-xs px-3 py-2 flex-1 sm:flex-none flex items-center justify-center gap-1.5"
                  >
                    <Send size={14} className="text-green-500" />
                    <span className="hidden sm:inline">Compartilhar</span>
                  </button>
                </>
              )}
            </div>
          </div>

      {/* Error */}
      {generateMutation.isError && (
        <div className="card p-4 border-red/20 text-red text-sm">
          {(generateMutation.error as any)?.response?.data?.detail || 'Erro ao gerar times. Verifique se há atletas suficientes para a modalidade escolhida.'}
        </div>
      )}

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={JSON.stringify(result)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Summary */}
            <div className="card p-4 flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-red" />
                <span className="text-text-secondary text-sm">{result.total_players} atletas</span>
              </div>
              <div className="flex items-center gap-2">
                <Shuffle size={16} className="text-blue" />
                <span className="text-text-secondary text-sm">{result.n_teams} times</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-sm">
                  Balanceamento: <span className="text-green-400 font-bold">{(10 - result.balance_score * 10).toFixed(1)}%</span>
                </span>
              </div>
            </div>

            {/* Teams grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.teams.map((team, idx) => (
                <motion.div 
                  key={team.order}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: idx * 0.15, type: 'spring' }}
                >
                  <TeamCard team={team} idx={idx} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {history.filter(h => !h.is_locked).length > 0 && (
        <div className="mt-8 pt-8 border-t border-border">
          <h2 className="font-display text-2xl font-bold tracking-widest text-text-primary uppercase flex items-center gap-3 mb-6">
            <Trophy className="text-yellow-400" size={24} />
            Pelada Ativa (Jogando)
          </h2>
          <div className="space-y-6">
            {history.filter(h => !h.is_locked).map(gen => (
              <GenerationCard key={gen.id} gen={gen} gameDays={gameDays} allPlayers={allPlayers} canEdit={canEdit} onConfirmDialog={setConfirmDialog} />
            ))}
          </div>
        </div>
      )}
        </div>
      )}


      {activeTab === 'historico' && (
        <div className="space-y-6">
          {/* Past Generations */}
          {history.filter(h => h.is_locked).length > 0 ? (
            <div>
              <h2 className="font-display text-2xl font-bold tracking-widest text-text-primary uppercase flex items-center gap-3 mb-6">
                <History className="text-red" size={24} />
                Histórico de Peladas Anteriores
              </h2>
              <div className="space-y-6">
                {history.filter(h => h.is_locked).map(gen => (
                  <GenerationCard key={gen.id} gen={gen} gameDays={gameDays} allPlayers={allPlayers} canEdit={canEdit} onConfirmDialog={setConfirmDialog} />
                ))}
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center text-text-muted">
              Nenhum histórico encontrado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}


