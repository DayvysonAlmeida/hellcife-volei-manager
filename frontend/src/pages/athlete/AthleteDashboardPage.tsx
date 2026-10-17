import { useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Crown, Flame, History, Medal, Share2, Star, Swords, Trophy, TrendingUp, CalendarCheck } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { PageLoading } from '@/components/ui/Loading';
import { PositionBadge } from '@/components/ui/Badges';
import { ShareAchievementModal, type ShareModalProps } from '@/components/athlete/share/ShareAchievementModal';
import { SeasonBadge } from '@/components/seasons/SeasonBadge';
import { NextCircuitCard } from '@/components/athlete/home/NextCircuitCard';
import { RankingTabs } from '@/components/athlete/home/RankingTabs';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import type { DashboardStats, PlayerStats } from '@/types';

const CATEGORY_MAP: Record<string, { label: string; color: string; icon: typeof Star }> = {
  mvp: { label: 'MVP', color: 'text-yellow-400 bg-yellow-500/10', icon: Crown },
  attack: { label: 'Ataque', color: 'text-red bg-red/10', icon: Flame },
  defense: { label: 'Defesa', color: 'text-blue-400 bg-blue-500/10', icon: Star },
  setter: { label: 'Levantamento', color: 'text-green-400 bg-green-500/10', icon: Star },
  pass: { label: 'Passe', color: 'text-purple-400 bg-purple-500/10', icon: Star },
  block: { label: 'Bloqueio', color: 'text-orange-400 bg-orange-500/10', icon: Star },
  promotion: { label: 'Grande Estrela', color: 'text-yellow-500 bg-yellow-500/10', icon: Crown },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: 'Ativo', color: 'bg-green-500/10 text-green-400 border-green-500/30' },
  inactive: { label: 'Inativo', color: 'bg-red/10 text-red-300 border-red/30' },
  injured: { label: 'Lesionado', color: 'bg-orange-500/10 text-orange-300 border-orange-500/30' },
  suspended: { label: 'Suspenso', color: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30' },
};

const HIGHLIGHTS_VISIBLE = 5;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function AthleteDashboardPage() {
  const { user } = useAuth();
  const [shareModal, setShareModal] = useState<Omit<ShareModalProps, 'isOpen' | 'onClose'> | null>(null);
  const [showAllHighlights, setShowAllHighlights] = useState(false);

  const { data: player, isLoading: loadingPlayer } = useQuery({
    queryKey: ['athlete-me'],
    queryFn: () => api.get('/players/me/').then((r) => r.data),
  });

  const { data: stats } = useQuery<PlayerStats>({
    queryKey: ['athlete-stats', player?.id],
    queryFn: () => api.get(`/players/${player.id}/stats/`).then((r) => r.data),
    enabled: !!player?.id,
  });

  const { data: dashboard, isLoading: loadingDashboard } = useQuery<DashboardStats>({
    queryKey: ['athlete-dashboard-stats'],
    queryFn: () => api.get('/players/dashboard-stats/').then((r) => r.data),
  });

  if (loadingPlayer || loadingDashboard) return <PageLoading />;

  const name = player?.display_name || user?.name || '';
  const season = stats?.season;
  const tierData = player?.elo_tier_data;
  const tier = tierData?.tier;
  const playerStatus = player?.status ? STATUS_MAP[player.status] : null;
  const fireIndex = dashboard?.fire_sharks?.findIndex((p) => p.id === player?.id) ?? -1;
  const winsEntry = dashboard?.top_wins?.find((p) => p.id === player?.id);

  const shareBase = {
    athleteName: name,
    shirtNumber: player?.shirt_number,
    avatarUrl: player?.avatar_url || undefined,
    avatarInitial: (name || 'A').charAt(0),
    position: player?.main_position_display,
    overall: player?.latest_overall,
  };
  const shareFireShark = () => {
    const me = dashboard?.fire_sharks?.[fireIndex];
    if (!me) return;
    setShareModal({ ...shareBase, type: 'fire_shark_top1', winRate: me.win_rate, wins: me.wins, totalMatches: me.total_matches, winRank: fireIndex + 1 });
  };
  const shareGladiator = () => {
    if (!winsEntry) return;
    setShareModal({
      ...shareBase, type: 'top_wins', wins: winsEntry.wins, winRate: winsEntry.win_rate,
      totalMatches: winsEntry.total_matches ?? season?.matches, overallRank: stats?.overall_rank ?? undefined,
      winRank: season?.gladiator_rank ?? undefined,
    });
  };

  const numbers = [
    { label: 'Partidas', value: season?.matches ?? '—', icon: Swords, color: 'text-blue-400' },
    { label: 'Vitórias', value: season?.wins ?? '—', icon: Trophy, color: 'text-yellow-400' },
    { label: 'Aproveitamento', value: season ? `${season.win_rate}%` : '—', icon: TrendingUp, color: 'text-green-400' },
    { label: 'Presença', value: season ? `${season.attendance_rate}%` : '—', icon: CalendarCheck, color: 'text-purple-400' },
  ];

  return (
    <div className="space-y-6 pb-10 max-w-6xl mx-auto">
      <SeasonBadge season={dashboard?.season} to="/athlete/seasons" />

      {shareModal && <ShareAchievementModal isOpen onClose={() => setShareModal(null)} {...shareModal} />}

      {/* ── Topo: quem é, faixa de Elo e posições nos rankings ── */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#07070b] p-5 sm:p-7 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(217,4,41,0.22),transparent_60%),radial-gradient(120%_90%_at_100%_100%,rgba(45,105,200,0.25),transparent_60%)]" />
        <div className="relative flex flex-col gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <Avatar
              name={name}
              src={player?.avatar_url || undefined}
              size="xl"
              className={cn('w-20 h-20 sm:w-28 sm:h-28 flex-shrink-0 ring-4', fireIndex >= 0 ? 'ring-orange-500 shadow-[0_0_24px_rgba(249,115,22,0.45)]' : 'ring-white/15')}
            />
            <div className="min-w-0 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/70">{greeting()}</span>
                {playerStatus && (
                  <span className={cn('rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest', playerStatus.color)}>{playerStatus.label}</span>
                )}
              </div>
              <h1 className="font-display text-4xl sm:text-6xl leading-[0.95] tracking-wider truncate">{name.toUpperCase()}</h1>
              {tier && (
                <span
                  style={{ '--tier': tier.color } as CSSProperties}
                  className="relative inline-flex items-center gap-2 self-start rounded-full border border-[color:color-mix(in_srgb,var(--tier)_60%,transparent)] bg-[color:color-mix(in_srgb,var(--tier)_14%,transparent)] px-3.5 py-1"
                  title="Sua faixa de Elo na temporada"
                >
                  <span aria-hidden className="absolute inset-0 rounded-full motion-safe:animate-pulse" style={{ boxShadow: `0 0 18px ${tier.color}8c` }} />
                  <span aria-hidden className="relative text-base leading-none">{tier.icon}</span>
                  <span className="relative font-display text-base sm:text-lg tracking-[0.2em] leading-none text-[color:color-mix(in_srgb,var(--tier)_60%,white)]">{tier.name.toUpperCase()}</span>
                  <span className="relative text-[10px] font-bold leading-none text-[color:color-mix(in_srgb,var(--tier)_60%,white)] opacity-80">{Math.round(player?.elo ?? 500)} pts</span>
                </span>
              )}
              {/* Quanto falta para a próxima faixa (só a faixa do próprio atleta; sem posição no Elo) */}
              {tierData && (
                <div style={{ '--tier': tier?.color } as CSSProperties} className="flex flex-col gap-1 max-w-[16rem]">
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-[color:var(--tier)]" style={{ width: `${tierData.next_tier ? Math.max(4, tierData.percent) : 100}%` }} />
                  </div>
                  <span className="text-[11px] text-white/70">
                    {tierData.next_tier ? <>+{tierData.points_to_next} pts para <b className="text-white">{tierData.next_tier.name}</b></> : <>Faixa máxima: <b className="text-white">segure o topo</b></>}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {season?.fire_shark_rank && (
              <span className="rounded-lg border border-orange-500/45 bg-orange-500/10 px-2.5 py-1 text-xs font-bold text-orange-300">🦈 Fire Shark <b className="text-white">#{season.fire_shark_rank}</b></span>
            )}
            {season?.gladiator_rank && (
              <span className="rounded-lg border border-yellow-500/45 bg-yellow-500/10 px-2.5 py-1 text-xs font-bold text-yellow-200">🏆 Gladiador <b className="text-white">#{season.gladiator_rank}</b></span>
            )}
            {player?.shirt_number && (
              <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white/70">Camisa <b className="text-white">#{player.shirt_number}</b></span>
            )}
            {player?.main_position && <PositionBadge position={player.main_position} />}
          </div>
        </div>
      </section>

      {/* ── Alertas ── */}
      {player && player.consecutive_absences >= 8 && (
        <div className="flex items-start gap-3 rounded-2xl border border-red/40 bg-red/10 p-4">
          <AlertTriangle size={20} className="text-red flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-text-primary">{player.consecutive_absences} faltas seguidas na quadra</p>
            <p className="text-xs text-text-muted mt-0.5">Com 10 faltas seguidas sem check-in na quadra, o cadastro é inativado automaticamente.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5 items-start">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <NextCircuitCard playerId={player?.id} inactive={player?.status === 'inactive'} />

          {/* ── Seus números da temporada ── */}
          <section className="flex flex-col gap-3">
            <h2 className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Seus números{season ? ` · ${season.name}` : ''}</h2>
            <div className="grid grid-cols-2 gap-3">
              {numbers.map((s) => (
                <div key={s.label} className="rounded-2xl border border-border/30 bg-surface/70 p-4 flex flex-col gap-1">
                  <s.icon size={18} className={s.color} />
                  <p className="font-display text-3xl leading-none text-text-primary tabular-nums">{s.value}</p>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-text-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-3">
          {dashboard && (
            <RankingTabs
              dashboard={dashboard}
              playerId={player?.id}
              season={season}
              myName={name}
              myAvatarUrl={player?.avatar_url}
              myStars={{ big: player?.big_stars ?? 0, mini: player?.mini_stars ?? 0 }}
              onShareFireShark={fireIndex >= 0 ? shareFireShark : undefined}
              onShareGladiator={winsEntry ? shareGladiator : undefined}
            />
          )}
        </div>
      </div>

      {/* ── Destaques ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <section className="lg:col-span-2 rounded-[24px] border border-border/30 bg-surface/70 p-4 flex flex-col gap-3">
          <h2 className="font-sans flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted"><Medal size={14} className="text-purple-400" /> Atuais donos do título</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {['mvp', 'attack', 'defense', 'setter', 'pass', 'block'].map((key) => {
              const cat = CATEGORY_MAP[key];
              const winner = dashboard?.last_category_winners?.[key];
              return (
                <div key={key} className="rounded-2xl border border-border/20 bg-white/[0.02] p-3 flex items-center gap-3 min-w-0">
                  {winner ? (
                    <Avatar name={winner.player_name} src={winner.avatar_url || undefined} size="sm" />
                  ) : (
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', cat.color)}><cat.icon size={16} /></div>
                  )}
                  <div className="min-w-0">
                    <p className={cn('text-sm font-semibold truncate', winner ? 'text-text-primary' : 'text-text-muted')}>{winner?.player_name ?? 'Aguardando'}</p>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">{cat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[24px] border border-border/30 bg-surface/70 p-4 flex flex-col gap-3">
          <h2 className="font-sans flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted"><History size={14} className="text-red" /> Últimos destaques</h2>
          <div className="flex flex-col gap-2">
            {(dashboard?.recent_stars ?? []).slice(0, showAllHighlights ? undefined : HIGHLIGHTS_VISIBLE).map((star) => {
              const cat = CATEGORY_MAP[star.category];
              const isPromo = star.category === 'promotion';
              const mine = player?.id === star.player_id;
              return (
                <div key={star.id} className={cn('flex items-center gap-3 rounded-xl p-2.5', isPromo ? 'bg-yellow-500/10' : 'bg-white/[0.03]')}>
                  <Avatar name={star.player_name} src={star.avatar_url || undefined} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary leading-snug">
                      <span className={cn('font-bold', isPromo ? 'text-yellow-600 dark:text-yellow-400' : 'text-red')}>{star.player_name}</span>{' '}
                      {isPromo ? 'conquistou 1 Grande Estrela' : `ganhou +${star.count} ${cat?.label || 'Estrela'}`}
                    </p>
                    <p className="text-[10px] text-text-muted">
                      {new Date(star.created_at).toLocaleDateString('pt-BR')} · {new Date(star.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {mine && (
                    <button
                      type="button"
                      onClick={() => setShareModal({
                        ...shareBase,
                        type: isPromo ? 'big_star' : 'mini_star',
                        athleteName: star.player_name,
                        avatarUrl: star.avatar_url || undefined,
                        avatarInitial: star.player_name.charAt(0),
                        starCategory: star.category,
                        starCategoryLabel: cat?.label,
                        bigStarsTotal: player?.big_stars,
                        miniStarsCount: player?.mini_stars,
                      })}
                      className="flex-shrink-0 w-8 h-8 rounded-lg border border-border/40 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                      title="Compartilhar conquista"
                      aria-label="Compartilhar conquista"
                    >
                      <Share2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
            {(dashboard?.recent_stars ?? []).length === 0 && (
              <p className="text-sm text-text-muted text-center py-6">Os próximos destaques aparecem aqui.</p>
            )}
          </div>
          {(dashboard?.recent_stars ?? []).length > HIGHLIGHTS_VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAllHighlights((v) => !v)}
              className="rounded-xl border border-dashed border-border/50 py-2 text-xs font-bold text-text-muted hover:text-text-primary transition-colors"
            >
              {showAllHighlights ? 'Ver menos' : 'Ver mais destaques'}
            </button>
          )}
        </section>
      </div>

      <Link
        to="/athlete/profile"
        className="flex items-center justify-between rounded-[24px] border border-border/30 bg-surface/70 p-4 hover:border-red/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red/10 flex items-center justify-center text-red"><Star size={18} /></div>
          <div>
            <p className="text-text-primary font-medium text-sm">Ver meu perfil completo</p>
            <p className="text-text-muted text-xs">Evolução do Elo, troféus e habilidades</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-text-muted group-hover:text-red transition-colors" />
      </Link>
    </div>
  );
}
