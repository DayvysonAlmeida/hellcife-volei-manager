import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Trophy, CalendarCheck, Swords, Flame, TrendingUp, Info } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { PageLoading } from '@/components/ui/Loading';
import { PlayerCard } from '@/components/players/PlayerCard';
import { SubscriptionWidget } from '@/components/subscriptions/SubscriptionWidget';
import { TrophyRoom } from '@/components/profile/TrophyRoom';
import api from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { SKILL_LABELS, type PlayerStats } from '@/types';


export function MyProfilePage() {
  const navigate = useNavigate();
  const { data: player, isLoading } = useQuery({
    queryKey: ['athlete-me'],
    queryFn: () => api.get('/players/me/').then(r => r.data),
  });

  const { data: radarData } = useQuery({
    queryKey: ['athlete-radar', player?.id],
    queryFn: () => api.get(`/evaluations/radar/${player.id}/`).then(r => r.data),
    enabled: !!player?.id,
  });


  const [scope, setScope] = useState<'season' | 'career'>('season');

  const { data: stats } = useQuery<PlayerStats>({
    queryKey: ['athlete-stats', player?.id],
    queryFn: () => api.get(`/players/${player.id}/stats/`).then(r => r.data),
    enabled: !!player?.id,
  });

  if (isLoading) return <PageLoading />;
  if (!player) return (
    <div className="card p-10 text-center">
      <p className="text-text-muted">Perfil não vinculado. Fale com o administrador.</p>
    </div>
  );

  const radarChartData = radarData?.skills
    ? Object.entries(radarData.skills).map(([key, value]) => ({
        skill: SKILL_LABELS[key as keyof typeof SKILL_LABELS] || key,
        value: value as number,
      }))
    : [];

  // Mesmas posições da lista de atletas (rankings da temporada)
  const fireSharkRank = stats?.season?.fire_shark_rank ?? undefined;
  const winRank = stats?.season?.gladiator_rank ?? undefined;

  const historyData = stats?.overall_history?.map((h: { date: string; overall: number }) => ({
    date: formatDate(h.date),
    overall: h.overall,
  })) || [];

  const starCategories = [
    { label: 'MVP', value: player.mvp_stars, icon: '🏆', total: player.total_mvp },
    { label: 'Ataque', value: player.attack_stars, icon: '⚡', total: player.total_attack },
    { label: 'Defesa', value: player.defense_stars, icon: '🛡️', total: player.total_defense },
    { label: 'Levant.', value: player.setter_stars, icon: '🎯', total: player.total_setter },
    { label: 'Passe', value: player.pass_stars, icon: '🤝', total: player.total_pass },
    { label: 'Bloqueio', value: player.block_stars, icon: '🧱', total: player.total_block },
  ];

  return (
    <div className="space-y-6">
      {/* ── Card de Perfil Premium ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative rounded-[32px] bg-white/80 dark:bg-[#050505]/80 backdrop-blur-3xl border border-gray-200 dark:border-white/10 p-8 pt-12 shadow-neon-red flex flex-col items-center group"
      >
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-red/60 to-transparent overflow-hidden rounded-t-[32px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none opacity-50 overflow-hidden rounded-[32px]" />
        <p className="text-text-muted text-[10px] uppercase tracking-widest mb-6 font-bold z-10 drop-shadow">Seu Player Card Oficial</p>
        <div className="w-[240px] z-10 relative group-hover:scale-105 transition-transform duration-500">
          <PlayerCard
            player={{ ...player, stats: stats || player.stats }}
            idx={0}
            canEdit={false}
            onDelete={() => {}}
            winRank={winRank}
            fireSharkRank={fireSharkRank}
            linkable={false}
          />
        </div>
      </motion.div>

      {/* ── Stats Rápidas (temporada ou carreira) ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-lg text-text-primary tracking-wider">MEUS NÚMEROS</h2>
        <div className="inline-flex rounded-xl border border-border/40 bg-surface/60 p-1" role="tablist" aria-label="Período dos números">
          {(['season', 'career'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={scope === s}
              onClick={() => setScope(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors',
                scope === s ? 'bg-red text-white' : 'text-text-muted hover:text-text-primary'
              )}
            >
              {s === 'season' ? (stats?.season?.name ?? 'Temporada') : 'Carreira'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(() => {
          const season = stats?.season;
          const n = scope === 'season' && season
            ? { matches: season.matches, wins: season.wins, winRate: season.win_rate, presence: season.attendance_rate }
            : { matches: stats?.total_matches, wins: stats?.wins, winRate: stats?.win_rate, presence: stats?.attendance_rate };
          return [
            { label: 'Partidas', value: n.matches ?? '—', icon: Swords, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Vitórias', value: n.wins ?? '—', icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
            { label: '% Vitórias', value: n.winRate != null ? `${n.winRate}%` : '—', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
            { label: 'Presença', value: n.presence != null ? `${n.presence}%` : '—', icon: CalendarCheck, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          ];
        })().map((s, i) => (
          <motion.div
            key={s.label}
            whileHover={{ scale: 1.05, y: -5 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="relative overflow-hidden rounded-[24px] bg-gray-50/80 dark:bg-[#111]/60 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-4 text-center hover:bg-white dark:hover:bg-black/80 hover:border-red/50 hover:shadow-neon-red transition-all duration-300 group cursor-pointer"
          >
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center mx-auto mb-2 transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1`}>
              <s.icon size={24} className={s.color} />
            </div>
            <p className="font-display text-3xl text-gray-900 dark:text-white drop-shadow-sm">{s.value}</p>
            <p className="text-text-muted text-[10px] mt-1 uppercase tracking-widest font-medium">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Card de Elo ── */}
      {(() => {
        const tierData = player.elo_tier_data;
        const eloValue = Math.round(player.elo ?? 500);
        const tierColors: Record<string, { glow: string; border: string; barFrom: string; barTo: string; badge: string }> = {
          rookie:  { glow: 'none',                              border: 'border-gray-600',     barFrom: '#4B5563', barTo: '#6B7280', badge: '🪨' },
          bronze:  { glow: '0 0 20px rgba(205,124,47,0.3)',    border: 'border-amber-700/50', barFrom: '#92400E', barTo: '#CD7C2F', badge: '🥉' },
          silver:  { glow: '0 0 20px rgba(148,163,184,0.3)',   border: 'border-slate-400/50', barFrom: '#64748B', barTo: '#94A3B8', badge: '🥈' },
          gold:    { glow: '0 0 25px rgba(234,179,8,0.35)',    border: 'border-yellow-500/50',barFrom: '#B45309', barTo: '#EAB308', badge: '🥇' },
          diamond: { glow: '0 0 28px rgba(6,182,212,0.4)',     border: 'border-cyan-400/50',  barFrom: '#0E7490', barTo: '#06B6D4', badge: '💎' },
          elite:   { glow: '0 0 30px rgba(147,51,234,0.45)',   border: 'border-purple-500/50',barFrom: '#7C3AED', barTo: '#EC4899', badge: '🔮' },
          challenger: { glow: '0 0 35px rgba(220,38,38,0.5)',  border: 'border-red/60',       barFrom: '#991B1B', barTo: '#DC2626', badge: '👑' },
        };
        const tc = tierColors[player.elo_tier ?? 'silver'] ?? tierColors.silver;
        const percent = tierData?.percent ?? 0;
        const tierName = tierData?.tier?.name ?? 'Prata';
        const nextTierName = tierData?.next_tier?.name ?? null;
        const pointsToNext = tierData?.points_to_next ?? null;

        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            whileHover={{ y: -4 }}
            className={`relative overflow-hidden rounded-[28px] bg-white/60 dark:bg-[#080808]/70 backdrop-blur-2xl border ${tc.border} p-5 transition-all duration-300 group`}
            style={{ boxShadow: tc.glow }}
          >
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm text-text-muted uppercase tracking-[0.2em]">Rating Elo</h2>
                <button
                  onClick={() => navigate('/athlete/elo-system')}
                  className="w-5 h-5 rounded-full bg-surface/50 border border-border flex items-center justify-center text-text-muted hover:text-white hover:border-white/20 transition-all group-hover:scale-110"
                  title="Entenda como funciona o Elo"
                >
                  <Info size={12} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{tierData?.tier?.icon ?? tc.badge}</span>
                <span className="font-display text-2xl font-black text-text-primary">{eloValue}</span>
              </div>
            </div>

            {/* Faixa atual */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-text-primary font-bold text-sm">{tierName}</span>
              {nextTierName && (
                <span className="text-text-muted text-xs">
                  {pointsToNext != null ? `+${pointsToNext} pts para ${nextTierName}` : nextTierName}
                </span>
              )}
              {!nextTierName && (
                <span className="text-purple-400 text-xs font-bold animate-pulse">Faixa máxima!</span>
              )}
            </div>

            {/* Barra de progresso */}
            <div className="h-2 rounded-full bg-black/30 border border-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${percent}%`,
                  background: `linear-gradient(90deg, ${tc.barFrom}, ${tc.barTo})`,
                  boxShadow: `0 0 8px ${tc.barTo}80`,
                }}
              />
            </div>
            {nextTierName && (
              <p className="text-text-muted text-[10px] mt-1 text-right">{percent}% do caminho até {nextTierName}</p>
            )}
          </motion.div>
        );
      })()}

      <TrophyRoom player={player} />


      {/* ── Faltas Consecutivas ── */}
      {player.consecutive_absences >= 8 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("mt-2 flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-sm", 
            player.consecutive_absences >= 8 ? "bg-red/20 border-red/40 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-[pulse_2s_ease-in-out_infinite]" : "bg-orange-500/10 border-orange-500/30 text-orange-200"
          )}
        >
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", player.consecutive_absences >= 8 ? "bg-red/20" : "bg-orange-500/10")}>
            <Flame size={20} className={player.consecutive_absences >= 8 ? "text-red" : "text-orange-400"} />
          </div>
          <div className="flex-1">
            <p className="text-text-primary font-bold text-sm tracking-wide">
              {player.consecutive_absences} {player.consecutive_absences === 1 ? 'falta consecutiva na quadra' : 'faltas consecutivas na quadra'}
            </p>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 rounded-full bg-black/50 overflow-hidden border border-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-600 transition-all duration-700 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                style={{ width: `${Math.min((player.consecutive_absences / 10) * 100, 100)}%` }}
              />
            </div>
            <p className={cn("text-xs mt-1.5", player.consecutive_absences >= 8 ? "text-red-300 font-bold" : "text-text-muted")}>{player.consecutive_absences}/10 para inativação</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Radar de Habilidades ── */}
        {radarChartData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ y: -5 }}
            className="relative overflow-hidden rounded-[32px] bg-white/60 dark:bg-[#050505]/60 backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-6 shadow-2xl hover:border-red/30 transition-all duration-300 group"
          >
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-red/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* ── Estrelas por Categoria ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          whileHover={{ y: -5 }}
          className="relative overflow-hidden rounded-[32px] bg-white/60 dark:bg-[#050505]/60 backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-6 shadow-2xl hover:border-blue-500/30 transition-all duration-300 group"
        >
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <h2 className="font-display text-lg text-text-primary tracking-wider mb-4">ESTRELAS</h2>
          <div className="space-y-3">
            {starCategories.map((cat) => (
              <div key={cat.label} className="flex items-center gap-3">
                <span className="text-lg w-6 text-center flex-shrink-0">{cat.icon}</span>
                <span className="text-text-secondary text-sm w-16 flex-shrink-0">{cat.label}</span>
                <div className="flex-1 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-2 rounded-full transition-all duration-500 ${
                        i < cat.value ? 'bg-yellow-400' : 'bg-surface-highlight'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-text-muted text-xs w-8 text-right">{cat.value}/5</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-text-muted text-sm">Total acumulado</span>
            <div className="flex items-center gap-2">
              <span className="font-display text-text-primary">{player.big_stars}🌟 + {player.mini_stars}⭐</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Evolução do Overall ── */}
      {historyData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ y: -5 }}
          className="relative overflow-hidden rounded-[32px] bg-white/60 dark:bg-[#050505]/60 backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-6 shadow-2xl hover:border-red/30 transition-all duration-300 group"
        >
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-red/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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

      {/* ── Informações Pessoais ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        whileHover={{ y: -5 }}
        className="relative overflow-hidden rounded-[32px] bg-white/60 dark:bg-[#050505]/60 backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-6 shadow-2xl hover:border-gray-500/30 transition-all duration-300 group"
      >
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-gray-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <h2 className="font-display text-lg text-text-primary tracking-wider mb-4">INFORMAÇÕES</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {[
            { label: 'Mão dominante', value: player.dominant_hand_display },
            player.secondary_position && { label: 'Posição secundária', value: player.secondary_position_display },
            player.age && { label: 'Idade', value: `${player.age} anos` },
            player.height && { label: 'Altura', value: `${player.height}m` },
            player.weight && { label: 'Peso', value: `${player.weight}kg` },
          ].filter(Boolean).map((item: any, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <span className="text-text-muted text-sm">{item.label}</span>
              <span className="text-text-primary text-sm font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
