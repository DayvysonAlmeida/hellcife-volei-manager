import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { PageLoading } from "@/components/ui/Loading";

interface GeneralStatsTabProps {
  generalStats: any[];
  isLoading: boolean;
}

export function GeneralStatsTab({ generalStats, isLoading }: GeneralStatsTabProps) {
  return (
    <motion.div key="general" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="card p-0 overflow-hidden shadow-md">
      <div className="p-4 border-b border-border bg-surface/50">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-1"><BarChart3 size={20} className="text-primary" /> Frequência Geral (Histórico Completo)</h2>
        <p className="text-text-muted text-sm">Resumo da participação física, furos e ausências de todos os atletas desde que entraram no sistema.</p>
      </div>
      
      {isLoading ? <PageLoading /> : (
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
  );
}
