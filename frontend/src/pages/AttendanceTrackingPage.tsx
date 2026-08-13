import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { playersService } from "@/services/players";
import { attendanceService } from "@/services";
import api from "@/lib/api";
import { PageLoading, ErrorState } from "@/components/ui/Loading";
import toast from "react-hot-toast";
import type { Player, Attendance } from "@/types";

// Import tabs
import { FrequencyTab } from "@/components/attendance/tracking/FrequencyTab";
import { NoShowsTab } from "@/components/attendance/tracking/NoShowsTab";
import { ByPlayerTab } from "@/components/attendance/tracking/ByPlayerTab";
import { GeneralStatsTab } from "@/components/attendance/tracking/GeneralStatsTab";

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
          <FrequencyTab players={players} allTrackedPlayers={allTrackedPlayers} safePlayers={safePlayers} />
        ) : activeTab === "noshows" ? (
          <NoShowsTab noShows={noShows} onJustify={(id, text) => justifyMutation.mutate({ id, text })} />
        ) : activeTab === "byplayer" ? (
          <ByPlayerTab playerAbsences={playerAbsences} noShows={noShows} playerMap={playerMap} onJustify={(id, text) => justifyMutation.mutate({ id, text })} />
        ) : (
          <GeneralStatsTab generalStats={generalStats || []} isLoading={isGeneralStatsLoading} />
        )}
      </AnimatePresence>
    </div>
  );
}
