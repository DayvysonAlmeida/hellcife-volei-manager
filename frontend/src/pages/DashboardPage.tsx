import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/ui/Loading';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { NextCircuitCard } from '@/components/dashboard/NextCircuitCard';
import { StatsPills } from '@/components/dashboard/StatsPills';
import { AttendanceChart } from '@/components/dashboard/AttendanceChart';
import { TopAttendees } from '@/components/dashboard/TopAttendees';
import { RankingMerits } from '@/components/dashboard/RankingMerits';
import { PositionDistribution } from '@/components/dashboard/PositionDistribution';
import { OsCoroados } from '@/components/dashboard/OsCoroados';
import { DreamTeam } from '@/components/dashboard/DreamTeam';
import { FireSharksTop10 } from '@/components/dashboard/FireSharksTop10';
import { HallOfFame } from '@/components/dashboard/HallOfFame';
import { WinnersSection } from '@/components/dashboard/WinnersSection';
import { SyncButton } from '@/components/ui/SyncButton';
import { Crown } from 'lucide-react';
import { dashboardService } from '@/services';
import type { DashboardData } from '@/types';
import { SeasonBadge } from '@/components/seasons/SeasonBadge';

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: dashboardService.get,
    refetchInterval: 1000 * 60 * 5,
  });

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header Premium E-Sports */}
      <div className="relative border border-white/10 p-6 sm:p-8 rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] bg-card-gradient overflow-hidden group/header mb-6">
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-red/20 blur-[80px] rounded-full animate-pulse" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-600/20 blur-[90px] rounded-full animate-pulse" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h1 className="font-display text-4xl sm:text-5xl text-white uppercase tracking-widest drop-shadow-md leading-none flex items-center gap-4">
              <Crown className="w-10 h-10 sm:w-12 sm:h-12 text-red" />
              Painel <span className="text-red">Geral</span>
            </h1>
            <p className="text-white/60 text-sm mt-2 font-medium uppercase tracking-[0.2em]">Visão geral do desempenho do time.</p>
            <div className="mt-3">
              <SeasonBadge season={data?.season} to="/seasons" />
            </div>
          </div>
          
          <SyncButton onSync={() => refetch()} />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <NextCircuitCard nextCircuit={data.next_circuit} />
        <StatsPills totalPlayers={data.total_players || 0} activePlayers={data.active_players || 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <AttendanceChart trend={data.attendance_trend || []} />
        <TopAttendees attendees={data.top_attendees || []} />
      </div>

      <RankingMerits topStars={data.top_stars || []} />

      <div className="grid grid-cols-1 gap-6">
        <PositionDistribution distribution={data.position_distribution || []} />
      </div>

      <OsCoroados newStars={data.new_stars || []} />
      <DreamTeam dreamTeam={data.dream_team || []} />
      <FireSharksTop10 fireSharks={data.fire_sharks || []} />
      <HallOfFame hallOfFame={data.hall_of_fame || []} />
      <WinnersSection winners={data.top_winners || []} />
    </div>
  );
}
