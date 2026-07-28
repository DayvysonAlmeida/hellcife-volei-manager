import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Swords, CalendarCheck, Trophy, Flame, Star, ChevronRight, Volleyball, UserCheck, TrendingUp } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { PageLoading } from '@/components/ui/Loading';
import { OverallBadge } from '@/components/ui/OverallBadge';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';

export function AthleteDashboardPage() {
  const { user } = useAuth();

  const { data: player, isLoading: loadingPlayer } = useQuery({
    queryKey: ['athlete-me'],
    queryFn: () => api.get('/players/me/').then(r => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['athlete-stats', player?.id],
    queryFn: () => api.get(`/players/${player.id}/stats/`).then(r => r.data),
    enabled: !!player?.id,
  });

  const { data: todayCircuit } = useQuery({
    queryKey: ['athlete-today-circuit'],
    queryFn: () => api.get('/attendance/gamedays/?is_closed=false&ordering=-date').then(r => {
      const today = new Date().toISOString().split('T')[0];
      return (r.data.results || r.data).find((g: any) => g.date === today) || null;
    }),
  });

  const { data: recentMatches } = useQuery({
    queryKey: ['athlete-recent-matches'],
    queryFn: () => api.get('/matches/?ordering=-date&page_size=3').then(r => (r.data.results || r.data).slice(0, 3)),
  });

  if (loadingPlayer) return <PageLoading />;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const statCards = [
    { label: 'Partidas', value: stats?.total_matches ?? '—', icon: Swords, color: 'text-blue-400' },
    { label: 'Vitórias', value: stats?.wins ?? '—', icon: Trophy, color: 'text-yellow-400' },
    { label: '% Vitórias', value: stats?.win_rate != null ? `${stats.win_rate}%` : '—', icon: TrendingUp, color: 'text-green-400' },
    { label: 'Presença', value: stats?.attendance_rate != null ? `${stats.attendance_rate}%` : '—', icon: CalendarCheck, color: 'text-purple-400' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header de Boas-vindas ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red/20 via-surface to-surface border border-red/20 p-6"
      >
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-red/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-blue/5 blur-2xl pointer-events-none" />
        <div className="relative flex items-center gap-5">
          <div className="relative">
            <Avatar
              name={player?.display_name || user?.name || ''}
              src={player?.avatar_url}
              size="xl"
              className="ring-4 ring-red/30 shadow-neon-red-sm"
            />
            {player?.big_stars > 0 && (
              <div className="absolute -bottom-1 -right-1 bg-yellow-500 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-yellow-900 shadow-lg">
                {player.big_stars}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-muted text-sm mb-0.5">{greeting()},</p>
            <h1 className="font-display text-3xl text-text-primary tracking-wider truncate">
              {(player?.display_name || user?.name || '').toUpperCase()}
            </h1>
            {player?.shirt_number && (
              <p className="text-text-muted text-sm mt-0.5">
                Camisa <span className="text-red font-bold">#{player.shirt_number}</span>
                {player?.main_position_display && (
                  <span className="ml-2 text-text-muted">· {player.main_position_display}</span>
                )}
              </p>
            )}
            {/* Mini estrelas */}
            {(player?.mini_stars > 0 || player?.big_stars > 0) && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {Array.from({ length: player.big_stars }).map((_: unknown, i: number) => (
                  <span key={`b-${i}`} className="text-base">🌟</span>
                ))}
                {Array.from({ length: player.mini_stars }).map((_: unknown, i: number) => (
                  <span key={`m-${i}`} className="text-sm opacity-70">⭐</span>
                ))}
              </div>
            )}
          </div>
          {player && (
            <div className="hidden sm:flex flex-col items-center gap-1">
              <OverallBadge overall={player.latest_overall} size="lg" showLabel />
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="card p-4 text-center hover:border-border/80 transition-colors"
          >
            <s.icon size={20} className={`mx-auto mb-2 ${s.color}`} />
            <p className="font-display text-2xl text-text-primary">{s.value}</p>
            <p className="text-text-muted text-xs mt-0.5 uppercase tracking-wider">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Circuito de Hoje ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-red/10 flex items-center justify-center text-red">
              <Volleyball size={18} />
            </div>
            <h2 className="font-display text-lg text-text-primary tracking-wider">CIRCUITO DE HOJE</h2>
          </div>

          {todayCircuit ? (
            <div className="space-y-3">
              <div className="bg-surface-highlight rounded-xl p-4 border border-border/50">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-text-primary">{todayCircuit.location || 'Quadra principal'}</p>
                    <p className="text-text-muted text-sm mt-0.5">
                      {todayCircuit.time && <span>{todayCircuit.time}</span>}
                      {todayCircuit.time_end && <span> – {todayCircuit.time_end}</span>}
                    </p>
                    <p className="text-text-muted text-xs mt-1">{formatDate(todayCircuit.date)}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 whitespace-nowrap">
                    Aberto
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-text-muted">
                  <UserCheck size={14} />
                  <span>{todayCircuit.total_present ?? 0} confirmados</span>
                  {todayCircuit.max_players && (
                    <span className="text-text-muted/50">/ {todayCircuit.max_players} vagas</span>
                  )}
                </div>
              </div>
              <Link
                to="/athlete/checkin"
                className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
              >
                <CalendarCheck size={16} />
                Confirmar Presença
              </Link>
            </div>
          ) : (
            <div className="text-center py-8">
              <Volleyball size={40} className="text-text-muted/30 mx-auto mb-3" />
              <p className="text-text-muted text-sm">Nenhum circuito aberto hoje.</p>
              <p className="text-text-muted/60 text-xs mt-1">Fique de olho para o próximo!</p>
            </div>
          )}
        </motion.div>

        {/* ── Últimos Jogos ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue/10 flex items-center justify-center text-blue-400">
                <Swords size={18} />
              </div>
              <h2 className="font-display text-lg text-text-primary tracking-wider">ÚLTIMOS JOGOS</h2>
            </div>
            <Link to="/athlete/matches" className="text-text-muted text-xs flex items-center gap-1 hover:text-red transition-colors">
              Ver todos <ChevronRight size={14} />
            </Link>
          </div>

          {recentMatches && recentMatches.length > 0 ? (
            <div className="space-y-2">
              {recentMatches.map((match: any) => (
                <div key={match.id} className="flex items-center gap-3 p-3 bg-surface-highlight rounded-xl border border-border/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-sm font-medium truncate">
                      {match.teams?.map((t: any) => t.team_name).join(' vs ') || 'Partida'}
                    </p>
                    <p className="text-text-muted text-xs mt-0.5">{formatDate(match.date)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {match.teams?.map((t: any, i: number) => (
                      <span key={i} className={`font-display text-lg ${t.winner ? 'text-green-400' : 'text-text-muted'}`}>
                        {t.score}
                        {i === 0 && <span className="text-text-muted/50 mx-1 text-sm">x</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Swords size={40} className="text-text-muted/30 mx-auto mb-3" />
              <p className="text-text-muted text-sm">Nenhum jogo registrado ainda.</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Faltas Consecutivas ── */}
      {player && player.consecutive_absences > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <Flame size={20} className="text-orange-400" />
          </div>
          <div>
            <p className="text-text-primary font-medium text-sm">
              Atenção: {player.consecutive_absences} {player.consecutive_absences === 1 ? 'falta consecutiva' : 'faltas consecutivas'}
            </p>
            <p className="text-text-muted text-xs mt-0.5">
              Ao atingir 10 faltas seguidas, o atleta é inativado automaticamente.
              {player.consecutive_absences >= 7 && ' ⚠️ Você está próximo do limite!'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Perfil CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Link
          to="/athlete/profile"
          className="flex items-center justify-between p-4 card hover:border-red/30 hover:shadow-neon-red-sm transition-all duration-300 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red/10 flex items-center justify-center text-red group-hover:scale-110 transition-transform">
              <Star size={18} />
            </div>
            <div>
              <p className="text-text-primary font-medium text-sm">Ver meu perfil completo</p>
              <p className="text-text-muted text-xs">Habilidades, evolução e histórico</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-text-muted group-hover:text-red transition-colors" />
        </Link>
      </motion.div>
    </div>
  );
}
