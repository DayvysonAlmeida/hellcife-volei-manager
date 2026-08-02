import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trophy, CalendarCheck, Swords, Flame, TrendingUp } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { PageLoading } from '@/components/ui/Loading';
import { PlayerCard } from '@/components/players/PlayerCard';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { SKILL_LABELS } from '@/types';


export function MyProfilePage() {
  const { data: player, isLoading } = useQuery({
    queryKey: ['athlete-me'],
    queryFn: () => api.get('/players/me/').then(r => r.data),
  });

  const { data: radarData } = useQuery({
    queryKey: ['athlete-radar', player?.id],
    queryFn: () => api.get(`/evaluations/radar/${player.id}/`).then(r => r.data),
    enabled: !!player?.id,
  });


  const { data: stats } = useQuery({
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center"
      >
        <p className="text-text-muted text-xs uppercase tracking-widest mb-4 font-medium">Seu Card</p>
        <div className="w-[220px]">
          <PlayerCard
            player={player}
            idx={0}
            canEdit={false}
            onDelete={() => {}}
          />
        </div>
      </motion.div>

      {/* ── Stats Rápidas ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Partidas', value: stats?.total_matches ?? '—', icon: Swords, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Vitórias', value: stats?.wins ?? '—', icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: '% Vitórias', value: stats?.win_rate != null ? `${stats.win_rate}%` : '—', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Presença', value: stats?.attendance_rate != null ? `${stats.attendance_rate}%` : '—', icon: CalendarCheck, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="card p-4 text-center"
          >
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mx-auto mb-2`}>
              <s.icon size={18} className={s.color} />
            </div>
            <p className="font-display text-2xl text-text-primary">{s.value}</p>
            <p className="text-text-muted text-xs mt-0.5 uppercase tracking-wider">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Faltas Consecutivas ── */}
      {player.consecutive_absences >= 8 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <Flame size={20} className="text-orange-400" />
          </div>
          <div className="flex-1">
            <p className="text-text-primary font-medium text-sm">
              {player.consecutive_absences} {player.consecutive_absences === 1 ? 'falta consecutiva' : 'faltas consecutivas'}
            </p>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 rounded-full bg-surface-highlight overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-700"
                style={{ width: `${Math.min((player.consecutive_absences / 10) * 100, 100)}%` }}
              />
            </div>
            <p className="text-text-muted text-xs mt-1.5">{player.consecutive_absences}/10 para inativação</p>
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
          className="card p-6"
        >
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

      {/* ── Informações Pessoais ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="card p-6"
      >
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
