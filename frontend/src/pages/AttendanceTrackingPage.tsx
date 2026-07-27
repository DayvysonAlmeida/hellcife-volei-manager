import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, AlertTriangle, History, X, UserX, ChevronDown, ChevronUp, Calendar, MapPin, RefreshCw, BarChart3 } from "lucide-react";
import { playersService } from "@/services/players";
import { attendanceService } from "@/services";
import api from "@/lib/api";
import { PageLoading, ErrorState, EmptyState } from "@/components/ui/Loading";
import { Avatar } from "@/components/ui/Avatar";
import toast from "react-hot-toast";
import type { Player, Attendance } from "@/types";
import { Link } from "react-router-dom";
import { formatDate } from "@/lib/utils";

export function AttendanceTrackingPage() {
  const [activeTab, setActiveTab] = useState<"frequency" | "noshows" | "byplayer" | "general">("frequency");
  const qc = useQueryClient();

  const { data: playersData, isLoading: isPlayersLoading, error: playersError } = useQuery({
    queryKey: ["players"],
    queryFn: () => playersService.list({ page_size: 1000 }),
  });
  const players = playersData?.results || [];

  const { data: noShowsData, isLoading: isNoShowsLoading, error: noShowsError } = useQuery({
    queryKey: ["attendances", "no-shows"],
    queryFn: async () => {
      const res = await api.get("/attendance/records/", { params: { was_no_show: "True", page_size: 1000 } });
      return res.data;
    },
  });
  const noShows: Attendance[] = Array.isArray(noShowsData) ? noShowsData : (noShowsData?.results || []);

  const { data: generalStats, isLoading: isGeneralStatsLoading } = useQuery({
    queryKey: ["attendance", "general-stats"],
    queryFn: () => attendanceService.getGeneralStats(),
  });

  const justifyMutation = useMutation({
    mutationFn: async ({ id, text }: { id: number; text: string }) => {
      const res = await api.post(`/attendance/records/${id}/justify/`, { justification_text: text });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Falta justificada com sucesso!");
      qc.invalidateQueries({ queryKey: ["attendances", "no-shows"] });
    },
    onError: () => toast.error("Erro ao justificar falta."),
  });

  const playerAbsences = useMemo(() => {
    const map = new Map<number, { player_id: number; player_name: string; player_avatar?: string; absences: Attendance[] }>();
    for (const att of noShows) {
      if (!map.has(att.player)) {
        map.set(att.player, { player_id: att.player, player_name: att.player_name, player_avatar: att.player_avatar, absences: [] });
      }
      map.get(att.player)!.absences.push(att);
    }
    return Array.from(map.values()).sort((a, b) => b.absences.length - a.absences.length);
  }, [noShows]);

  const playerMap = useMemo(() => {
    const m = new Map<number, Player>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  if (isPlayersLoading || isNoShowsLoading) return <PageLoading />;
  if (playersError || noShowsError) return <ErrorState onRetry={() => qc.invalidateQueries()} />;

  const allTrackedPlayers = [...players].sort((a, b) => b.consecutive_absences - a.consecutive_absences).filter(p => p.consecutive_absences > 0 || p.status === 'inactive');
  const safePlayers = players.filter(p => p.consecutive_absences === 0 && p.status === 'active');

  const tabs = [
    { key: "frequency" as const, label: "Monitoramento (Inativação)" },
    { key: "noshows" as const, label: "Advertências (No-shows)" },
    { key: "byplayer" as const, label: "Furos por Atleta" },
    { key: "general" as const, label: "Frequência Geral" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-text-primary uppercase tracking-tight">Frequências e Faltas</h1>
          <p className="text-text-secondary mt-1">Gerencie faltas consecutivas e "No-shows" (nome na lista, mas não compareceu).</p>
        </div>
        <button
          onClick={() => {
            const promise = api.post('/attendance/gamedays/process-past-absences/').then(r => r.data).then(() => qc.invalidateQueries());
            toast.promise(promise, {
              loading: 'Recalculando faltas...',
              success: (data: any) => data?.detail || 'Faltas recalculadas!',
              error: 'Erro ao processar faltas.',
            });
          }}
          className="btn-secondary py-2 px-4 text-sm font-bold flex items-center justify-center gap-2 shrink-0"
          title="Recalcular todas as faltas retroativas"
        >
          <RefreshCw size={16} />
          Sincronizar Faltas
        </button>
      </div>

      <div className="flex gap-2 p-1 bg-surface-highlight rounded-lg w-full md:w-max flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === tab.key ? "bg-red text-white shadow-md" : "text-text-secondary hover:text-text-primary"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "frequency" ? (
          <motion.div key="frequency" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="card p-6 bg-gradient-to-br from-surface to-surface-hover/50 border border-border/50 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-red/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="max-w-2xl">
                  <h2 className="text-xl font-display font-black text-text-primary flex items-center gap-2 mb-2">
                    <AlertTriangle size={24} className="text-orange-500" />
                    Monitoramento de Frequência (Ausências)
                  </h2>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    A cada dia de circuito que o jogador <strong className="text-red">NÃO</strong> marca presença física na quadra, ele recebe <strong className="text-text-primary">1 ausência consecutiva</strong> (isso inclui quem sequer se inscreveu e quem se inscreveu mas não foi). 
                    Ao participar presencialmente de um jogo, essa contagem <strong className="text-green-500">zera imediatamente</strong>.
                  </p>
                  <div className="flex items-center gap-4 mt-4">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-500 bg-orange-500/10 px-2.5 py-1 rounded-md border border-orange-500/20">
                      8 Ausências = Alerta
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red bg-red/10 px-2.5 py-1 rounded-md border border-red/20">
                      10 Ausências = Inativação
                    </span>
                  </div>
                </div>
                
                <div className="bg-surface p-4 rounded-xl border border-border min-w-[200px] text-center shadow-inner">
                  <p className="text-[10px] text-text-muted font-black uppercase tracking-widest mb-1">Jogadores em Risco (8+)</p>
                  <p className="text-4xl font-display text-orange-500">
                    {players.filter(p => p.consecutive_absences >= 8 && p.status === 'active').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-0 overflow-hidden shadow-md border-border/60">
              <div className="p-4 border-b border-border bg-surface/50 flex justify-between items-center">
                <h3 className="font-bold text-text-primary">Atletas com Faltas Consecutivas</h3>
                <span className="text-xs text-text-muted font-medium">{allTrackedPlayers.length} atletas acumulando faltas</span>
              </div>
              
              {allTrackedPlayers.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-text-muted">Todos os jogadores estão com a frequência em dia! 🎉</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {allTrackedPlayers.map(p => (
                    <PlayerFrequencyRow key={p.id} player={p} />
                  ))}
                </div>
              )}
            </div>

            {safePlayers.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => {
                  const el = document.getElementById('safe-players');
                  if (el) el.classList.toggle('hidden');
                }}>
                  <h3 className="font-bold text-green-500 flex items-center gap-2">
                    <ShieldAlert size={18} /> 
                    Frequentes – Em Dia ({safePlayers.length} atletas)
                  </h3>
                  <p className="text-xs text-text-muted hover:text-text-primary transition-colors">Ver lista</p>
                </div>
                <div id="safe-players" className="hidden">
                  <div className="flex flex-wrap gap-2 mt-2">
                    {safePlayers.map(p => (
                      <div key={p.id} className="flex items-center gap-2 bg-surface-hover px-2.5 py-1.5 rounded-lg border border-border/50">
                        <Avatar name={p.display_name} src={p.avatar_url} size="sm" />
                        <span className="text-xs font-medium text-text-primary">{p.display_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : activeTab === "noshows" ? (
          <motion.div key="noshows" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="card p-4">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4"><AlertTriangle size={20} className="text-red" /> Histórico de Faltas (No-shows)</h2>
            <p className="text-text-muted text-sm mb-4">Jogadores que colocaram o nome na lista, mas não fizeram check-in na quadra.</p>
            {noShows.length === 0 ? <EmptyState icon="✅" message="Tudo certo! Não há registros de no-shows no sistema." /> : (
              <div className="space-y-4">
                {noShows.map((att) => <NoShowRow key={att.id} attendance={att} onJustify={(text) => justifyMutation.mutate({ id: att.id, text })} />)}
              </div>
            )}
          </motion.div>
        ) : activeTab === "byplayer" ? (
          <motion.div key="byplayer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="card p-4 text-center">
                <p className="font-black text-3xl text-red">{playerAbsences.length}</p>
                <p className="text-text-muted text-[10px] uppercase tracking-wider mt-1">Atletas com Faltas</p>
              </div>
              <div className="card p-4 text-center">
                <p className="font-black text-3xl text-orange-500">{noShows.length}</p>
                <p className="text-text-muted text-[10px] uppercase tracking-wider mt-1">Total de No-shows</p>
              </div>
              <div className="card p-4 text-center col-span-2 sm:col-span-1">
                <p className="font-black text-3xl text-green-500">{noShows.filter(a => a.is_justified).length}</p>
                <p className="text-text-muted text-[10px] uppercase tracking-wider mt-1">Justificadas</p>
              </div>
            </div>
            <div className="card p-4">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-1"><UserX size={20} className="text-red" /> Ausências por Atleta</h2>
              <p className="text-text-muted text-xs mb-4">Ordenados por total de circuitos perdidos. Expanda para ver o histórico detalhado.</p>
              {playerAbsences.length === 0 ? <EmptyState icon="✅" message="Nenhum atleta com ausências registradas." /> : (
                <div className="space-y-3">
                  {playerAbsences.map(entry => {
                    const fullPlayer = playerMap.get(entry.player_id);
                    const consecutiveAbsences = fullPlayer?.consecutive_absences ?? 0;
                    const totalJustified = entry.absences.filter(a => a.is_justified).length;
                    const totalUnjustified = entry.absences.length - totalJustified;
                    return (
                      <PlayerAbsenceRow
                        key={entry.player_id}
                        playerId={entry.player_id}
                        playerName={entry.player_name}
                        playerAvatar={entry.player_avatar}
                        isGuest={entry.absences[0]?.player_is_guest}
                        invitedBy={entry.absences[0]?.player_invited_by}
                        absences={entry.absences}
                        consecutiveAbsences={consecutiveAbsences}
                        totalJustified={totalJustified}
                        totalUnjustified={totalUnjustified}
                        onJustify={(id, text) => justifyMutation.mutate({ id, text })}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="general" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="card p-0 overflow-hidden shadow-md">
            <div className="p-4 border-b border-border bg-surface/50">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-1"><BarChart3 size={20} className="text-primary" /> Frequência Geral (Histórico Completo)</h2>
              <p className="text-text-muted text-sm">Resumo da participação física, furos e ausências de todos os atletas desde que entraram no sistema.</p>
            </div>
            
            {isGeneralStatsLoading ? <PageLoading /> : (
              <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-surface-hover text-text-secondary sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="py-3 px-4 font-bold">Atleta</th>
                      <th className="py-3 px-4 font-bold text-center">Dias de Jogo</th>
                      <th className="py-3 px-4 font-bold text-center">Presenças</th>
                      <th className="py-3 px-4 font-bold text-center">Furos (No-shows)</th>
                      <th className="py-3 px-4 font-bold text-center">Assiduidade (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {generalStats?.map((stat: any) => (
                      <tr key={stat.id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={stat.name} src={stat.avatar_url} size="sm" />
                            <div>
                              <p className="font-bold text-text-primary">{stat.name}</p>
                              {stat.status === 'inactive' && <span className="text-[10px] uppercase font-bold text-red bg-red/10 px-1.5 py-0.5 rounded">Inativo</span>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-medium">{stat.total_gamedays}</td>
                        <td className="py-3 px-4 text-center font-bold text-green-500">{stat.presences}</td>
                        <td className="py-3 px-4 text-center font-bold text-orange-500">{stat.no_shows}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-bold w-8">{stat.attendance_rate}%</span>
                            <div className="w-20 h-2 bg-surface-highlight rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${stat.attendance_rate}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlayerFrequencyRow({ player }: { player: Player }) {
  const absences = player.consecutive_absences;
  const isWarning = absences >= 8 && absences < 10;
  const isDanger = absences >= 10;
  
  // Create an array of 10 blocks for the visual tracker
  const blocks = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 transition-colors hover:bg-surface-highlight ${isDanger ? 'bg-red/5' : isWarning ? 'bg-orange-500/5' : ''}`}>
      <div className="flex items-center gap-4 min-w-[200px]">
        <Avatar name={player.display_name} src={player.avatar_url} size="sm" className={isDanger ? 'border border-red/50 opacity-75' : ''} />
        <div>
          <p className={`font-bold text-sm flex items-center gap-2 ${isDanger ? 'text-red line-through opacity-75' : 'text-text-primary'}`}>
            {player.display_name}
            {player.is_guest && (
              <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                Convidado
              </span>
            )}
          </p>
          <p className="text-text-muted text-xs">{player.main_position_display}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-start md:items-center justify-center max-w-md w-full">
        <div className="flex items-center justify-between w-full mb-1.5 px-1">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
            {isDanger ? 'Inativado (10+)' : isWarning ? 'Em Risco (8+)' : 'Contagem'}
          </span>
          <span className={`text-xs font-black ${isDanger ? 'text-red' : isWarning ? 'text-orange-500' : 'text-text-primary'}`}>
            {absences} / 10
          </span>
        </div>
        
        <div className="flex w-full h-2.5 gap-1">
          {blocks.map(num => {
            const isFilled = num <= absences;
            let bgColor = "bg-surface-hover border-border/50";
            
            if (isFilled) {
              if (num >= 10) bgColor = "bg-red border-red shadow-[0_0_8px_rgba(239,68,68,0.5)]";
              else if (num >= 8) bgColor = "bg-orange-500 border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]";
              else bgColor = "bg-primary border-primary/80";
            }
            
            return (
              <div 
                key={num} 
                className={`flex-1 rounded-sm border ${bgColor} transition-all duration-300`}
                title={`${num}ª falta`}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end min-w-[100px]">
        <Link to={`/players/${player.id}`} className="btn-secondary py-1.5 px-3 text-xs w-full text-center">Ver Perfil</Link>
      </div>
    </div>
  );
}

function NoShowRow({ attendance, onJustify }: { attendance: Attendance; onJustify: (text: string) => void }) {
  const [isJustifying, setIsJustifying] = useState(false);
  const [text, setText] = useState("");
  return (
    <div className={`p-4 rounded-xl border shadow-sm transition-all ${attendance.is_justified ? "border-green-500/20 bg-green-500/5 hover:bg-green-500/10" : "border-red/20 bg-red/5 hover:bg-red/10"}`}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex items-start gap-3">
          <Avatar name={attendance.player_name} src={attendance.player_avatar} size="md" className="border-2 border-surface" />
          <div>
            <p className="text-text-primary font-black text-base flex items-center gap-2">
              {attendance.player_name}
              {attendance.player_is_guest && (
                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  Convidado {attendance.player_invited_by ? `por: ${attendance.player_invited_by}` : ''}
                </span>
              )}
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
              <span className="text-text-muted text-xs flex items-center gap-1">
                <span className="font-bold text-text-secondary">#{attendance.gameday}</span>
              </span>
              {attendance.gameday_date && (
                <span className="text-text-muted text-xs flex items-center gap-1">
                  <Calendar size={12} />
                  {formatDate(attendance.gameday_date)}
                </span>
              )}
              {attendance.gameday_location && (
                <span className="text-text-muted text-xs flex items-center gap-1">
                  <MapPin size={12} />
                  {attendance.gameday_location}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 self-start">
          {attendance.is_justified
            ? <span className="text-xs font-black text-green-500 bg-green-500/10 px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1">✓ Justificada</span>
            : <span className="text-xs font-black text-red bg-red/10 px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1"><AlertTriangle size={14} /> No-show</span>
          }
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-border/50">
        {attendance.is_justified ? (
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Motivo da Justificativa</span>
            <p className="text-sm text-text-secondary bg-surface/50 p-3 rounded-lg border border-border/50 italic">
              "{attendance.justification_text}"
            </p>
          </div>
        ) : (
          <div>
            {!isJustifying ? (
              <button onClick={() => setIsJustifying(true)} className="btn-secondary py-2 px-4 text-sm w-full font-bold">Justificar Ausência</button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 bg-surface/50 p-2 rounded-lg border border-border/50">
                <input type="text" placeholder="Qual o motivo da falta?" className="input-base text-sm py-2 flex-1 bg-surface" value={text} onChange={e => setText(e.target.value)} autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => { if (text.trim()) onJustify(text); }} className="btn-primary py-2 px-4 text-sm font-bold flex-1 sm:flex-none">Salvar</button>
                  <button onClick={() => setIsJustifying(false)} className="btn-ghost p-2 text-text-muted hover:bg-surface"><X size={18} /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface PlayerAbsenceRowProps {
  playerId: number; playerName: string; playerAvatar?: string; absences: Attendance[];
  isGuest?: boolean; invitedBy?: string;
  consecutiveAbsences: number; totalJustified: number; totalUnjustified: number;
  onJustify: (id: number, text: string) => void;
}

function PlayerAbsenceRow({ playerId, playerName, playerAvatar, absences, isGuest, invitedBy, consecutiveAbsences, totalJustified, totalUnjustified, onJustify }: PlayerAbsenceRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [justifyingId, setJustifyingId] = useState<number | null>(null);
  const [justifyText, setJustifyText] = useState("");

  const isAtRisk = consecutiveAbsences >= 8;
  const isInactive = consecutiveAbsences >= 10;
  const sortedAbsences = [...absences].sort((a, b) => b.gameday - a.gameday);

  return (
    <div className={`rounded-xl border shadow-sm transition-all duration-200 overflow-hidden ${isInactive ? "border-red/40 bg-red/5 hover:border-red/60" : isAtRisk ? "border-orange-500/40 bg-orange-500/5 hover:border-orange-500/60" : "border-border bg-surface hover:border-text-muted/30"}`}>
      <button className="w-full flex items-center justify-between p-4 text-left transition-colors" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-4 min-w-0">
          <Avatar name={playerName} src={playerAvatar} size="md" className="border-2 border-surface" />
          <div className="min-w-0">
            <p className="text-text-primary font-black text-base truncate flex items-center gap-2">
              {playerName}
              {isGuest && (
                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  Convidado {invitedBy ? `por: ${invitedBy}` : ''}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {consecutiveAbsences > 0 && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${isInactive ? "bg-red/20 text-red" : isAtRisk ? "bg-orange-500/20 text-orange-400" : "bg-surface-hover text-text-muted"}`}>
                  {consecutiveAbsences} seguidas{isAtRisk && !isInactive ? " ⚠️" : isInactive ? " 🚫" : ""}
                </span>
              )}
              {totalJustified > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-green-500/15 text-green-400">{totalJustified} justificada{totalJustified > 1 ? "s" : ""}</span>}
              {totalUnjustified > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-red/15 text-red">{totalUnjustified} no-show{totalUnjustified > 1 ? "s" : ""}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 ml-2">
          <div className="text-center bg-surface/50 px-3 py-1.5 rounded-lg border border-border/50">
            <p className={`font-black text-2xl leading-none ${isInactive ? "text-red" : isAtRisk ? "text-orange-500" : "text-text-secondary"}`}>{absences.length}</p>
            <p className="text-[9px] text-text-muted uppercase tracking-widest mt-0.5">Faltas</p>
          </div>
          <div className={`p-1.5 rounded-full transition-colors ${expanded ? "bg-white/10 text-text-primary" : "text-text-muted hover:bg-white/5"}`}>
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border-t border-border/50 px-4 py-4 space-y-3 bg-black/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-text-muted uppercase tracking-widest font-black">Histórico de Circuitos Perdidos</p>
                <Link to={`/players/${playerId}`} className="text-[11px] text-primary hover:text-primary-hover font-bold transition-colors">Ver Perfil →</Link>
              </div>
              {sortedAbsences.map(att => (
                <div key={att.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border text-sm transition-colors ${att.is_justified ? "border-green-500/20 bg-green-500/5" : "border-red/20 bg-red/5"}`}>
                  <div className="flex flex-col gap-1">
                    <span className="text-text-primary font-bold text-sm">Circuito #{att.gameday}</span>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      {att.gameday_date && (
                        <span className="flex items-center gap-1"><Calendar size={12} className="text-text-secondary" /> {formatDate(att.gameday_date)}</span>
                      )}
                      {att.gameday_location && (
                        <span className="flex items-center gap-1"><MapPin size={12} className="text-text-secondary" /> {att.gameday_location}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:justify-end">
                    {att.is_justified ? (
                      <div className="flex flex-col items-start sm:items-end bg-surface/50 px-3 py-1.5 rounded-md border border-border/50 w-full sm:w-auto">
                        <span className="text-[10px] font-black text-green-500 uppercase tracking-wider flex items-center gap-1">✓ Justificada</span>
                        {att.justification_text && <p className="text-xs text-text-secondary mt-1 line-clamp-1 italic" title={att.justification_text}>"{att.justification_text}"</p>}
                      </div>
                    ) : justifyingId === att.id ? (
                      <div className="flex gap-2 items-center w-full sm:w-auto bg-surface p-1.5 rounded-md border border-border">
                        <input type="text" placeholder="Motivo..." className="input-base text-xs py-1.5 px-2 w-full sm:w-48 bg-transparent" value={justifyText} onChange={e => setJustifyText(e.target.value)} autoFocus />
                        <button onClick={() => { if (justifyText.trim()) { onJustify(att.id, justifyText); setJustifyingId(null); setJustifyText(""); } }} className="btn-primary py-1.5 px-3 text-xs font-bold shrink-0">Salvar</button>
                        <button onClick={() => { setJustifyingId(null); setJustifyText(""); }} className="btn-ghost p-1.5 text-text-muted hover:bg-surface-hover shrink-0"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto bg-surface/50 px-3 py-2 rounded-md border border-border/50">
                        <span className="text-[10px] font-black text-red uppercase tracking-wider flex items-center gap-1"><AlertTriangle size={12}/> No-show</span>
                        <button onClick={() => { setJustifyingId(att.id); setJustifyText(""); }} className="btn-secondary py-1 px-3 text-[10px] font-bold uppercase tracking-wider">Justificar</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
