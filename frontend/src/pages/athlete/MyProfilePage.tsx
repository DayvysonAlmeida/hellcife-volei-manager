import { useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarCheck, Crown, Flame, Info, Pencil, Swords, TrendingUp, Trophy } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { PageLoading } from '@/components/ui/Loading';
import { PlayerCard } from '@/components/players/PlayerCard';
import { TrophyRoom } from '@/components/profile/TrophyRoom';
import { EloHistoryCard } from '@/components/elo/EloHistoryCard';
import api from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { SKILL_LABELS, type EvaluationSkills, type PlayerStats } from '@/types';

// Nomes curtos no radar: os completos ("Condicionamento", "Posicionamento") ficavam cortados no celular
const SHORT_SKILLS: Record<keyof EvaluationSkills, string> = {
  serve: 'Saque', reception: 'Recepção', passing: 'Passe', setting: 'Levant.', attack: 'Ataque', block: 'Bloqueio',
  defense: 'Defesa', recovery: 'Recup.', positioning: 'Posição', communication: 'Comunic.', tactical_iq: 'Tática',
  conditioning: 'Cond. física', consistency: 'Regular.',
};
// A API do radar manda o nome completo ("Condicionamento"): mesmo atalho a partir do nome
const SHORT_BY_LABEL: Record<string, string> = Object.fromEntries(
  (Object.keys(SHORT_SKILLS) as (keyof EvaluationSkills)[]).map((k) => [SKILL_LABELS[k], SHORT_SKILLS[k]]),
);

const card = 'rounded-[28px] border border-border/30 bg-surface/70 p-5';
const sectionTitle = 'font-display text-lg text-text-primary tracking-wider';
const muted = 'rgb(var(--color-text-muted))';

const fmtHeight = (h: string | number) => `${Number(h).toFixed(2).replace('.', ',')} m`;
const fmtWeight = (w: string | number) => `${Number(w).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;

export function MyProfilePage() {
  const [scope, setScope] = useState<'season' | 'career'>('season');

  const { data: player, isLoading } = useQuery({
    queryKey: ['athlete-me'],
    queryFn: () => api.get('/players/me/').then((r) => r.data),
  });

  const { data: radarData } = useQuery({
    queryKey: ['athlete-radar', player?.id],
    queryFn: () => api.get(`/evaluations/radar/${player.id}/`).then((r) => r.data),
    enabled: !!player?.id,
  });

  const { data: stats } = useQuery<PlayerStats>({
    queryKey: ['athlete-stats', player?.id],
    queryFn: () => api.get(`/players/${player.id}/stats/`).then((r) => r.data),
    enabled: !!player?.id,
  });

  if (isLoading) return <PageLoading />;
  if (!player) return (
    <div className="card p-10 text-center">
      <p className="text-text-muted">Perfil não vinculado. Fale com o administrador.</p>
    </div>
  );

  const season = stats?.season;
  const tierData = player.elo_tier_data;
  const tierColor: string = tierData?.tier?.color ?? '#94A3B8';

  const radarChartData = radarData?.skills
    ? Object.entries(radarData.skills).map(([key, value]) => ({
        skill: SHORT_SKILLS[key as keyof EvaluationSkills] || SHORT_BY_LABEL[key] || key,
        value: value as number,
      }))
    : [];

  const historyData = stats?.overall_history?.map((h: { date: string; overall: number }) => ({
    date: formatDate(h.date),
    overall: h.overall,
  })) || [];

  const numbers = scope === 'season' && season
    ? [
        { label: 'Partidas', value: season.matches, icon: Swords, color: 'text-blue-400' },
        { label: 'Vitórias', value: season.wins, icon: Trophy, color: 'text-yellow-500' },
        { label: 'Aproveitamento', value: `${season.win_rate}%`, icon: TrendingUp, color: 'text-green-500' },
        { label: 'Presença', value: `${season.attendance_rate}%`, icon: CalendarCheck, color: 'text-purple-400' },
        { label: 'Vitórias seguidas', value: stats?.win_streak ?? 0, icon: Flame, color: 'text-orange-500' },
        { label: 'Saldo de pontos', value: season.point_balance > 0 ? `+${season.point_balance}` : season.point_balance, icon: TrendingUp, color: 'text-cyan-500' },
      ]
    : [
        { label: 'Partidas', value: stats?.total_matches ?? '—', icon: Swords, color: 'text-blue-400' },
        { label: 'Vitórias', value: stats?.wins ?? '—', icon: Trophy, color: 'text-yellow-500' },
        { label: 'Aproveitamento', value: stats ? `${stats.win_rate}%` : '—', icon: TrendingUp, color: 'text-green-500' },
        { label: 'Presença', value: stats ? `${stats.attendance_rate}%` : '—', icon: CalendarCheck, color: 'text-purple-400' },
        { label: 'Vitórias seguidas', value: stats?.win_streak ?? 0, icon: Flame, color: 'text-orange-500' },
        { label: 'MVPs', value: stats?.mvps ?? 0, icon: Crown, color: 'text-yellow-500' },
      ];

  const phone: string = player.phone?.replace(/\D/g, '') ?? '';
  const info = [
    player.legal_name && { label: 'Nome civil', value: player.legal_name },
    { label: 'Gênero', value: player.gender_display },
    phone.length >= 10 && { label: 'WhatsApp', value: phone.length <= 11 ? `(${phone.slice(0, 2)}) ${phone.slice(2, -4)}-${phone.slice(-4)}` : phone },
    player.instagram && { label: 'Instagram', value: `@${player.instagram}` },
    { label: 'Mão dominante', value: player.dominant_hand_display },
    player.secondary_position && { label: 'Posição secundária', value: player.secondary_position_display },
    player.age && { label: 'Idade', value: `${player.age} anos` },
    player.height && { label: 'Altura', value: fmtHeight(player.height) },
    player.weight && { label: 'Peso', value: fmtWeight(player.weight) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* ── Player card ── */}
      <section className="rounded-[28px] border border-border/30 bg-surface/70 px-6 pt-8 pb-4 flex flex-col items-center gap-4">
        <p className="text-text-muted text-[10px] uppercase tracking-widest font-bold">Seu player card oficial</p>
        <div className="w-[240px]">
          <PlayerCard
            player={{ ...player, stats: stats || player.stats }}
            idx={0}
            canEdit={false}
            onDelete={() => {}}
            winRank={season?.gladiator_rank ?? undefined}
            fireSharkRank={season?.fire_shark_rank ?? undefined}
            linkable={false}
          />
        </div>
        <Link to="/athlete/profile/edit" className="btn-secondary inline-flex items-center gap-2 text-sm">
          <Pencil size={16} /> Editar perfil
        </Link>
      </section>

      {player.consecutive_absences >= 8 && (
        <div className="flex items-start gap-3 rounded-2xl border border-red/40 bg-red/10 p-4">
          <AlertTriangle size={20} className="text-red flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-text-primary">{player.consecutive_absences} faltas seguidas na quadra</p>
            <div className="mt-2 h-1.5 rounded-full bg-black/20 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-600" style={{ width: `${Math.min((player.consecutive_absences / 10) * 100, 100)}%` }} />
            </div>
            <p className="text-xs text-text-muted mt-1.5">Com 10 faltas seguidas sem check-in na quadra, o cadastro é inativado automaticamente.</p>
          </div>
        </div>
      )}

      {/* ── Rating Elo (até 10 partidas na temporada: em calibração, ainda sem faixa) ── */}
      {player.elo_calibration?.calibrating ? (
        <section className="rounded-[28px] border border-border/40 bg-surface/70 p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm text-text-muted uppercase tracking-[0.2em]">Rating Elo{season ? ` · ${season.name}` : ''}</h2>
              <Link to="/athlete/elo-system" className="w-5 h-5 rounded-full border border-border/50 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors" title="Entenda como funciona o Elo" aria-label="Entenda como funciona o Elo">
                <Info size={12} />
              </Link>
            </div>
            <span className="text-xl" aria-hidden>⏳</span>
          </div>
          <p className="font-bold text-sm text-text-primary">Em calibração</p>
          <p className="text-xs text-text-muted">
            Sua faixa de Elo aparece depois de {player.elo_calibration.needed} partidas na temporada. Você jogou{' '}
            {player.elo_calibration.games}: falta{player.elo_calibration.missing === 1 ? '' : 'm'} {player.elo_calibration.missing}.
          </p>
          <div className="h-2 rounded-full bg-black/20 dark:bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-text-muted" style={{ width: `${Math.max(4, (player.elo_calibration.games / player.elo_calibration.needed) * 100)}%` }} />
          </div>
        </section>
      ) : (
      <section
        style={{ '--tier': tierColor } as CSSProperties}
        className="rounded-[28px] border border-[color:color-mix(in_srgb,var(--tier)_45%,transparent)] bg-surface/70 p-5 flex flex-col gap-2"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm text-text-muted uppercase tracking-[0.2em]">Rating Elo{season ? ` · ${season.name}` : ''}</h2>
            <Link to="/athlete/elo-system" className="w-5 h-5 rounded-full border border-border/50 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors" title="Entenda como funciona o Elo" aria-label="Entenda como funciona o Elo">
              <Info size={12} />
            </Link>
          </div>
          <span className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>{tierData?.tier?.icon}</span>
            <span className="font-display text-3xl leading-none text-text-primary tabular-nums">{Math.round(player.elo ?? 500)}</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-bold text-sm text-[color:color-mix(in_srgb,var(--tier)_75%,black)] dark:text-[color:color-mix(in_srgb,var(--tier)_60%,white)]">{tierData?.tier?.name}</span>
          <span className="text-xs text-text-muted">
            {tierData?.next_tier ? `+${tierData.points_to_next} pts para ${tierData.next_tier.name}` : 'Faixa máxima'}
          </span>
        </div>
        <div className="h-2 rounded-full bg-black/20 dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,color-mix(in_srgb,var(--tier)_70%,black),var(--tier))]" style={{ width: `${tierData?.percent ?? 0}%` }} />
        </div>
        {tierData?.next_tier && (
          <p className="text-[10px] text-text-muted text-right">{tierData.percent}% do caminho até {tierData.next_tier.name}</p>
        )}
      </section>
      )}

      {/* ── Meus números ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className={sectionTitle}>MEUS NÚMEROS</h2>
          <div className="inline-flex rounded-xl border border-border/40 bg-surface/60 p-1" role="tablist" aria-label="Período dos números">
            {(['season', 'career'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={scope === s}
                onClick={() => setScope(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red/60',
                  scope === s ? 'bg-red text-white' : 'text-text-muted hover:text-text-primary'
                )}
              >
                {s === 'season' ? (season?.name ?? 'Temporada') : 'Carreira'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {numbers.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/30 bg-surface/70 p-4 flex flex-col gap-1">
              <s.icon size={18} className={s.color} />
              <p className="font-display text-3xl leading-none text-text-primary tabular-nums">{s.value}</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Evolução do Elo na temporada ── */}
      <EloHistoryCard playerId={player.id} color={tierColor} />

      {/* ── Sala de troféus (estrelas e conquistas num lugar só) ── */}
      <TrophyRoom player={player} />

      {/* ── Habilidades e overall ── */}
      {(radarChartData.length > 0 || historyData.length > 1) && (
        <div className={cn('grid grid-cols-1 gap-6 items-start', radarChartData.length > 0 && historyData.length > 1 && 'lg:grid-cols-2')}>
          {radarChartData.length > 0 && (
            <section className={card}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className={sectionTitle}>HABILIDADES</h2>
                {player.latest_overall != null && <span className="text-xs font-bold text-text-muted">Overall {Number(player.latest_overall).toFixed(1)}</span>}
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarChartData} outerRadius="68%">
                  <PolarGrid stroke="rgb(var(--color-text-muted) / 0.25)" />
                  <PolarAngleAxis dataKey="skill" tick={{ fill: muted, fontSize: 10 }} />
                  <Radar name="Habilidade" dataKey="value" stroke="#D90429" fill="#D90429" fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} />
                </RadarChart>
              </ResponsiveContainer>
            </section>
          )}

          {historyData.length > 1 && (
            <section className={card}>
              <h2 className={cn(sectionTitle, 'mb-4')}>EVOLUÇÃO DO OVERALL</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={historyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="rgb(var(--color-text-muted) / 0.15)" />
                  <XAxis dataKey="date" tick={{ fill: muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} tick={{ fill: muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border) / 0.5)', borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: muted }}
                  />
                  <Line type="monotone" dataKey="overall" name="Overall" stroke="#D90429" strokeWidth={2} dot={{ fill: '#D90429', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </section>
          )}
        </div>
      )}

      {/* ── Informações ── */}
      <section className={card}>
        <h2 className={cn(sectionTitle, 'mb-3')}>INFORMAÇÕES</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          {info.map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-border/30">
              <span className="text-text-muted text-sm">{item.label}</span>
              <span className="text-text-primary text-sm font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
