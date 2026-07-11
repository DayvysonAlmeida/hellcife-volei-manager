import { useQuery } from '@tanstack/react-query';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit, Phone, Link as LinkIcon, Ruler, Weight, Calendar, Trophy, CalendarCheck, Swords } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Avatar } from '@/components/ui/Avatar';
import { OverallBadge } from '@/components/ui/OverallBadge';
import { PositionBadge, StatusBadge } from '@/components/ui/Badges';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { playersService } from '@/services/players';
import { evaluationsService } from '@/services';
import { SKILL_LABELS, HAND_LABELS } from '@/types';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';

export function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const playerId = Number(id);

  const { data: player, isLoading, error } = useQuery({
    queryKey: ['player', playerId],
    queryFn: () => playersService.get(playerId),
    enabled: !isNaN(playerId),
  });

  const { data: radarData } = useQuery({
    queryKey: ['player-radar', playerId],
    queryFn: () => evaluationsService.radar(playerId),
    enabled: !isNaN(playerId),
  });

  const { data: stats } = useQuery({
    queryKey: ['player-stats', playerId],
    queryFn: () => playersService.stats(playerId),
    enabled: !isNaN(playerId),
  });

  const { data: evaluations } = useQuery({
    queryKey: ['player-evaluations', playerId],
    queryFn: () => evaluationsService.byPlayer(playerId),
    enabled: !isNaN(playerId),
  });

  if (isLoading) return <PageLoading />;
  if (error || !player) return <ErrorState />;

  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';

  // Radar chart data
  const radarChartData = radarData?.skills
    ? Object.entries(radarData.skills).map(([key, value]) => ({
        skill: SKILL_LABELS[key as keyof typeof SKILL_LABELS] || key,
        value: value as number,
      }))
    : [];

  // Overall history for line chart
  const historyData = stats?.overall_history?.map((h: { date: string; overall: number }) => ({
    date: formatDate(h.date),
    overall: h.overall,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <RouterLink to="/players" className="btn-ghost inline-flex items-center gap-2 -mb-2">
        <ArrowLeft size={16} />
        Voltar para Atletas
      </RouterLink>

      {/* Profile header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden"
      >
        <div className="h-32 bg-gradient-to-r from-red/20 via-card to-blue/10 relative">
          <div className="absolute inset-0 bg-hero-gradient" />
        </div>
        <div className="px-6 pb-6 -mt-12 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <Avatar
              name={player.display_name}
              src={player.avatar_url}
              size="xl"
              className="ring-4 ring-background shadow-neon-red-sm"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-3xl text-text-primary tracking-wider">
                  {player.display_name.toUpperCase()}
                </h1>
                {player.shirt_number && (
                  <span className="text-text-muted text-xl font-display">#{player.shirt_number}</span>
                )}
              </div>
              {player.nickname && player.nickname !== player.name && (
                <p className="text-text-muted text-sm">{player.name}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <PositionBadge position={player.main_position} />
                <StatusBadge status={player.status} />
              </div>
              
              {/* Stars */}
              <div className="flex items-center gap-2 mt-3">
                {Array.from({ length: player.big_stars }).map((_, i) => (
                  <div key={`big-${i}`} className="w-6 h-6 bg-yellow-500 rounded-sm flex items-center justify-center border-b-2 border-yellow-600 shadow-[0_0_10px_rgba(234,179,8,0.3)]">
                    <span className="text-yellow-900 font-display text-xs font-bold">🌟</span>
                  </div>
                ))}
                {Array.from({ length: player.mini_stars }).map((_, i) => (
                  <div key={`mini-${i}`} className="w-4 h-4 bg-yellow-500/20 rounded-sm flex items-center justify-center border border-yellow-500/50">
                    <span className="text-yellow-500 text-[10px]">⭐</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <OverallBadge overall={player.latest_overall} size="lg" showLabel />
                <p className="text-text-muted text-xs mt-1 tracking-wider uppercase">Overall</p>
              </div>
              {canEdit && (
                <RouterLink to={`/players/${player.id}/edit`} className="btn-primary flex items-center gap-2">
                  <Edit size={14} />
                  Editar
                </RouterLink>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Partidas', value: stats?.total_matches ?? '—', icon: <Swords size={18} /> },
          { label: 'Vitórias', value: stats?.wins ?? '—', icon: <Trophy size={18} /> },
          { label: '% Vitórias', value: stats?.win_rate != null ? `${stats.win_rate}%` : '—', icon: <Trophy size={18} /> },
          { label: 'Presença', value: stats?.attendance_rate != null ? `${stats.attendance_rate}%` : '—', icon: <CalendarCheck size={18} /> },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card p-4 text-center"
          >
            <div className="flex justify-center mb-2 text-red">{stat.icon}</div>
            <p className="font-display text-2xl text-text-primary">{stat.value}</p>
            <p className="text-text-muted text-xs mt-1 uppercase tracking-wider">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar chart */}
        {radarChartData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card p-6"
          >
            <h2 className="font-display text-lg text-text-primary tracking-wider mb-4">HABILIDADES</h2>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarChartData}>
                <PolarGrid stroke="#27272A" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: '#71717A', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#71717A', fontSize: 9 }} />
                <Radar
                  name="Habilidade"
                  dataKey="value"
                  stroke="#D90429"
                  fill="#D90429"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Personal info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-6"
        >
          <h2 className="font-display text-lg text-text-primary tracking-wider mb-4">INFORMAÇÕES</h2>
          <div className="space-y-4">
            {[
              { label: 'Mão dominante', value: player.dominant_hand_display, icon: null },
              player.secondary_position && { label: 'Posição secundária', value: player.secondary_position_display, icon: null },
              player.age && { label: 'Idade', value: `${player.age} anos`, icon: <Calendar size={14} /> },
              player.height && { label: 'Altura', value: `${player.height}m`, icon: <Ruler size={14} /> },
              player.weight && { label: 'Peso', value: `${player.weight}kg`, icon: <Weight size={14} /> },
              player.phone && { label: 'Telefone', value: player.phone, icon: <Phone size={14} /> },
              player.instagram && { label: 'Instagram', value: `@${player.instagram}`, icon: <LinkIcon size={14} /> },
            ].filter(Boolean).map((item, i) => (
              item && (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-text-muted text-sm flex items-center gap-2">
                    {item.icon}
                    {item.label}
                  </span>
                  <span className="text-text-primary text-sm font-medium">{item.value}</span>
                </div>
              )
            ))}
            {player.notes && (
              <div className="pt-2">
                <p className="text-text-muted text-xs uppercase tracking-wider mb-1">Observações</p>
                <p className="text-text-secondary text-sm">{player.notes}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Overall history */}
      {historyData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card p-6"
        >
          <h2 className="font-display text-lg text-text-primary tracking-wider mb-4">EVOLUÇÃO DO OVERALL</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={historyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
              <XAxis dataKey="date" tick={{ fill: '#71717A', fontSize: 10 }} />
              <YAxis domain={[0, 10]} tick={{ fill: '#71717A', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#18181B', border: '1px solid #27272A', borderRadius: 8 }}
                labelStyle={{ color: '#A1A1AA' }}
              />
              <Line
                type="monotone"
                dataKey="overall"
                stroke="#D90429"
                strokeWidth={2}
                dot={{ fill: '#D90429', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  );
}
