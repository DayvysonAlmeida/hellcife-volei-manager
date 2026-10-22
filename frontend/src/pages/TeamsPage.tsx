import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Shuffle, Zap, Save, RefreshCw, Users, Send, Trophy, Lock, History } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SyncButton } from '@/components/ui/SyncButton';
import { GenerationCard } from '@/components/teams/GenerationCard';
import { TeamCard } from '@/components/teams/TeamCard';
import { teamsService, attendanceService } from '@/services';
import { playersService } from '@/services/players';
import type { GenerateTeamsResult, Modality } from '@/types';
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
  // Para qual pelada e modalidade a prévia foi gerada: trocar qualquer uma esconde a prévia
  const [resultFor, setResultFor] = useState<{ gamedayId: number; modality: Modality } | null>(null);
  const [activeTab, setActiveTab] = useState<'gerador' | 'historico'>('gerador');
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

  const gameDays = useMemo(() => gameDaysData?.results || [], [gameDaysData]);

  const todayStr = new Date().toLocaleDateString('en-CA');
  
  const { upcomingGameDays, pastGameDays } = useMemo(() => {
    // A API devolve do mais novo para o mais antigo; o próximo circuito vem primeiro
    const active = (gameDays?.filter(gd => !gd.is_closed && gd.date >= todayStr) || [])
      .sort((a, b) => a.date.localeCompare(b.date));
    const past = gameDays?.filter(gd => gd.is_closed || gd.date < todayStr) || [];
    
    // Peladas ativas: a mais próxima primeiro (ordem cronológica)
    active.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // Histórico: a mais recente primeiro (ordem reversa)
    past.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return { upcomingGameDays: active, pastGameDays: past };
  }, [gameDays, todayStr]);

  // Auto-selecionar a pelada mais próxima se nenhuma estiver selecionada
  useEffect(() => {
    if (gameDays.length > 0 && selectedGameDayId === null) {
      if (upcomingGameDays.length > 0) {
        setSelectedGameDayId(upcomingGameDays[0].id);
      }
    }
  }, [gameDays.length, selectedGameDayId, upcomingGameDays]);

  const generateMutation = useMutation({
    mutationFn: (target: { gamedayId: number; modality: Modality }) => teamsService.generate({
      modality: target.modality,
      gameday_id: target.gamedayId,
      save: false,
    }),
    onSuccess: (data, target) => {
      setResult(data);
      setResultFor(target);
    },
  });

  // A prévia só aparece (e só pode ser salva) na pelada e na modalidade em que foi gerada
  const preview = result && resultFor && resultFor.gamedayId === selectedGameDayId && resultFor.modality === modality
    ? result
    : null;

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!preview || !resultFor) {
        return Promise.reject(new Error('No result to save'));
      }
      return teamsService.saveGenerated({
        modality: resultFor.modality,
        gameday_id: resultFor.gamedayId,
        result: preview,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-generations-history'] });
      // O sorteio salvo aparece em "Pelada Ativa"; a prévia sai para não mostrar os mesmos times duas vezes
      setResult(null);
      setResultFor(null);
      toast.success('Times salvos! A pelada está em "Pelada Ativa" logo abaixo.');
    },
  });

  const handleShareWhatsApp = () => {
    if (!preview) return;

    let text = `🏆 *TIMES GERADOS - HELLCIFE VÔLEI* 🏆\n\n`;
    text += `Modalidade: ${modality}v${modality}\n`;
    text += `Balanceamento: ${(10 - preview.balance_score * 10).toFixed(1)}%\n\n`;

    preview.teams.forEach((team) => {
      text += `*${team.name.toUpperCase()}* (Overall: ${team.avg_overall.toFixed(1)})\n`;
      team.players.forEach((p, idx) => {
        const posStr = p.main_position.charAt(0).toUpperCase() + p.main_position.slice(1);
        text += `${idx + 1}. ${p.display_name} (${posStr})\n`;
      });
      text += '\n';
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Hooks antes de qualquer return (regra do React); o histórico só é buscado por quem pode gerar times
  const { data: historyData } = useQuery({
    queryKey: ['team-generations-history'],
    queryFn: () => teamsService.list(),
    enabled: canEdit,
    refetchInterval: 15000, // quem fez check-in aparece em "aguardando" sem precisar sincronizar
  });
  const history = historyData?.results || [];

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">Geração de Times (Pelada)</h1>
        <div className="relative bg-surface/30 backdrop-blur-md border border-white/5 rounded-2xl p-8 text-center shadow-lg">
          <Shuffle size={48} className="text-red mx-auto mb-4 opacity-50" />
          <p className="text-text-muted">Apenas administradores e moderadores podem gerar times.</p>
        </div>
      </div>
    );
  }

  const handleGenerate = () => {
    if (!selectedGameDayId) {
      toast.error('Selecione um dia de jogo para gerar os times.');
      return;
    }

    const target = { gamedayId: selectedGameDayId, modality };
    const alreadyGenerated = history.some(h => h.gameday === selectedGameDayId && !h.is_locked);

    // Já existe sorteio ativo para esta pelada e ainda não há prévia nova dela
    if (alreadyGenerated && !preview) {
      setConfirmDialog({
        isOpen: true,
        title: 'Pelada Já Gerada!',
        desc: 'Esta pelada já tem um sorteio em "Pelada Ativa". Para refazer os times dele, use Embaralhar no card da pelada. Gerar agora sorteia só quem está aguardando (quem ainda não está em nenhum time), como uma quadra nova. Gerar mesmo assim?',
        onConfirm: () => {
          setConfirmDialog(s => ({ ...s, isOpen: false }));
          generateMutation.mutate(target);
        }
      });
    } else {
      generateMutation.mutate(target);
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

      <div className="flex justify-between items-start relative">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-red/10 blur-[60px] rounded-full pointer-events-none -z-10" />
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
              ? 'bg-red text-white shadow-[0_0_15px_rgba(217,4,41,0.3)]'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          Sorteio e Pelada Ativa
        </button>
        <button
          onClick={() => setActiveTab('historico')}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
            activeTab === 'historico'
              ? 'bg-red text-white shadow-[0_0_15px_rgba(217,4,41,0.3)]'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          Histórico
        </button>
      </div>

      {activeTab === 'gerador' && (
        <div className="space-y-4">
          {/* Config */}
          <div className="relative bg-surface/30 backdrop-blur-md border border-white/5 rounded-2xl p-4 md:p-5 shadow-lg">
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
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-all border
                        ${modality === m
                          ? 'bg-red/10 border-red/30 text-red shadow-[0_0_10px_rgba(217,4,41,0.15)]'
                          : 'bg-surface/20 border-white/5 text-text-muted hover:border-white/10'
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
                  className="input-glass w-full text-xs py-1.5 px-3 h-auto"
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
                  {preview ? 'Regerar times' : 'Gerar times'}
                </button>
              )}
              
              {preview && (
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
        <div className="relative bg-red/10 backdrop-blur-md border border-red/20 rounded-2xl p-4 text-red text-sm shadow-[0_0_15px_rgba(217,4,41,0.1)]">
          {(generateMutation.error as any)?.response?.data?.detail || 'Erro ao gerar times. Verifique se há atletas suficientes para a modalidade escolhida.'}
        </div>
      )}

      {/* Result */}
      <AnimatePresence mode="wait">
        {preview && (
          <motion.div
            key={JSON.stringify(preview)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Summary */}
            <div className="relative bg-surface/30 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex items-center gap-6 flex-wrap shadow-lg">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-red" />
                <span className="text-text-secondary text-sm">{preview.total_players} atletas</span>
              </div>
              <div className="flex items-center gap-2">
                <Shuffle size={16} className="text-blue" />
                <span className="text-text-secondary text-sm">{preview.n_teams} times</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-sm">
                  Balanceamento: <span className="text-green-400 font-bold">{(10 - preview.balance_score * 10).toFixed(1)}%</span>
                </span>
              </div>
            </div>

            {/* Teams grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {preview.teams.map((team, idx) => (
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
            <div className="relative bg-surface/30 backdrop-blur-md border border-white/5 rounded-2xl p-8 text-center text-text-muted shadow-lg">
              Nenhum histórico encontrado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}


