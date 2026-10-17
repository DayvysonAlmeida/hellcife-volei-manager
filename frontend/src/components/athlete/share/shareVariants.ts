import type { Player, PlayerStats } from '@/types';
import type { AchievementShareCardProps, ShareAchievementType } from './achievementCard';

/** Um card por conquista, cada um com os seus próprios dados. */
export type ShareVariants = Partial<Record<ShareAchievementType, Omit<AchievementShareCardProps, 'type'>>>;

/** Ordem do seletor e do card que abre primeiro. */
export const SHARE_TYPE_ORDER: ShareAchievementType[] = ['fire_shark_top1', 'big_star', 'top_wins', 'mini_star'];

const STAR_LABELS: Record<string, string> = {
  mvp: 'MVP', attack: 'Ataque', defense: 'Defesa', setter: 'Levantamento', pass: 'Passe', block: 'Bloqueio',
};

/**
 * Cards que o atleta conquistou de verdade. Fire Shark e Gladiador usam a posição e os números
 * da temporada (os mesmos dos rankings); as estrelas, o que ele tem hoje.
 */
export function buildShareVariants(player: Player, stats?: PlayerStats): ShareVariants {
  const base = {
    athleteName: player.display_name,
    shirtNumber: player.shirt_number,
    avatarUrl: player.avatar_url || undefined,
    avatarInitial: player.display_name.charAt(0),
    position: player.main_position_display,
    overall: player.latest_overall ?? undefined,
  };
  const season = stats?.season;
  const seasonNumbers = season && { wins: season.wins, totalMatches: season.matches, winRate: season.win_rate };
  const variants: ShareVariants = {};

  if (season?.fire_shark_rank) {
    variants.fire_shark_top1 = { ...base, ...seasonNumbers, winRank: season.fire_shark_rank };
  }
  if (player.big_stars > 0) {
    variants.big_star = { ...base, bigStarsTotal: player.big_stars, miniStarsCount: player.mini_stars };
  }
  if (season?.gladiator_rank) {
    variants.top_wins = { ...base, ...seasonNumbers, winRank: season.gladiator_rank, overallRank: stats?.overall_rank ?? undefined };
  }
  // Mini estrelas em andamento (zeram ao virar Grande Estrela). Estrelas antigas podem não ter
  // a categoria registrada: aí o card sai neutro, sem inventar uma.
  if (player.mini_stars > 0) {
    const category = stats?.latest_mini_star || undefined;
    variants.mini_star = {
      ...base,
      starCategory: category,
      starCategoryLabel: category ? STAR_LABELS[category] : undefined,
      miniStarsCount: player.mini_stars,
    };
  }
  return variants;
}

export function firstShareType(variants: ShareVariants): ShareAchievementType | undefined {
  return SHARE_TYPE_ORDER.find((t) => variants[t]);
}
