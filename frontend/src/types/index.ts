// ==================== Auth ====================
export interface User {
  id: number;
  email: string;
  name: string;
  profile: 'admin' | 'moderator' | 'player';
  avatar_url?: string;
  is_active: boolean;
  date_joined: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

// ==================== Player ====================
export interface Badge {
  id: number;
  name: string;
  description: string;
  icon: string;
  color_hex: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  condition_type: string;
  condition_value: number;
  created_at: string;
}

export interface PlayerBadge {
  id: number;
  badge: Badge;
  awarded_at: string;
}
export type Position = 'libero' | 'setter' | 'opposite' | 'outside' | 'middle' | 'universal';
export type DominantHand = 'right' | 'left' | 'both';
/** Autodeclarado. No sorteio, quem marcou "Mulher" (F) é espalhada entre os times. */
export type Gender = 'F' | 'M' | 'NB' | 'O' | 'N';
export type PlayerStatus = 'active' | 'inactive' | 'injured' | 'suspended' | 'pending';

export const POSITION_LABELS: Record<Position, string> = {
  libero: 'Líbero',
  setter: 'Levantador',
  opposite: 'Oposto',
  outside: 'Ponteiro',
  middle: 'Central',
  universal: 'Universal',
};

export const HAND_LABELS: Record<DominantHand, string> = {
  right: 'Destro',
  left: 'Canhoto',
  both: 'Ambidestro',
};

export const GENDER_LABELS: Record<Gender, string> = {
  F: 'Mulher',
  M: 'Homem',
  NB: 'Pessoa não binária',
  O: 'Outro',
  N: 'Prefiro não informar',
};

export const GENDER_ORDER: Gender[] = ['F', 'M', 'NB', 'O', 'N'];

export const STATUS_LABELS: Record<PlayerStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  injured: 'Lesionado',
  suspended: 'Suspenso',
  pending: 'Aguardando aprovação',
};

export interface Player {
  id: number;
  name: string;
  nickname?: string;
  display_name: string;
  shirt_number?: number;
  age?: number;
  height?: number;
  weight?: number;
  main_position: Position;
  main_position_display: string;
  secondary_position?: Position;
  secondary_position_display?: string;
  dominant_hand: DominantHand;
  dominant_hand_display: string;
  gender: Gender;
  gender_display: string;
  phone?: string;
  instagram?: string;
  avatar_url?: string;
  notes?: string;
  status: PlayerStatus;
  status_display: string;
  user?: number;
  latest_overall?: number;
  // Sistema de estrelas por categoria (0–5 cada)
  mvp_stars: number;
  attack_stars: number;
  defense_stars: number;
  setter_stars: number;
  pass_stars: number;
  block_stars: number;
  mini_stars: number;   // soma das 3 categorias (0–15, reseta ao virar big_star)
  big_stars: number;    // estrelas grandes conquistadas
  created_at: string;
  updated_at?: string;
  is_guest: boolean;
  invited_by?: string;
  /** Convidado: nível temporário para o sorteio (1–10), até ter uma avaliação de verdade. */
  guest_overall?: number | null;
  /** Nome completo (civil): só vem para a staff e para o próprio atleta; no app aparece o nome social. */
  legal_name?: string | null;
  consecutive_absences: number;
  badges?: PlayerBadge[];
  elo: number;
  /** 'calibrating' até 10 partidas na temporada: aí ainda não há faixa. */
  elo_tier: 'calibrating' | 'rookie' | 'bronze' | 'silver' | 'gold' | 'diamond' | 'elite' | 'challenger';
  elo_calibration?: { calibrating: boolean; games: number; needed: number; missing: number };
  elo_tier_data?: null | {
    tier: {
      name: string;
      key: string;
      min: number;
      max: number | null;
      color: string;
      text_color: string;
      icon: string;
      gradient: string;
    };
    next_tier: {
      name: string;
      key: string;
      min: number;
      color: string;
      icon: string;
    } | null;
    percent: number;
    points_to_next: number | null;
  };
  stats?: {
    matches: number;
    win_rate: number;
    wins?: number;
    win_rank?: number;
    fire_shark_rank?: number;
    overall_rank?: number;
    latest_mini_star?: string;
    win_streak?: number;
    mvp: number;
    best_attacker: number;
    best_server: number;
    best_defender: number;
    total_matches?: number;
  };
}

export interface PlayerFormData {
  name: string;
  nickname?: string;
  shirt_number?: number;
  age?: number;
  height?: number;
  weight?: number;
  main_position: Position;
  secondary_position?: Position | '';
  dominant_hand: DominantHand;
  gender: Gender;
  phone?: string;
  instagram?: string;
  avatar?: File;
  notes?: string;
  status: PlayerStatus;
  mini_stars: number;
  big_stars: number;
  is_guest?: boolean;
  invited_by?: string;
}

// ==================== Evaluation ====================
export interface EvaluationSkills {
  serve: number;
  reception: number;
  passing: number;
  setting: number;
  attack: number;
  block: number;
  defense: number;
  recovery: number;
  positioning: number;
  communication: number;
  tactical_iq: number;
  conditioning: number;
  consistency: number;
}


export interface Evaluation extends EvaluationSkills {
  id: number;
  player: number;
  player_name: string;
  /** Quem avaliou: só vem para a staff. */
  evaluator?: number | null;
  evaluator_name?: string | null;
  evaluator_profile?: User['profile'] | null;
  /** Última alteração depois de registrada (só para a staff). */
  last_edit?: { by: string | null; at: string } | null;
  date: string;
  notes?: string;
  overall: number;
  created_at: string;
}

/** Linha do tempo do Sistema de Estrelas. given_by_*: quem lançou (só para a staff; vazio nos lançamentos antigos). */
export type StarCategory = 'mvp' | 'attack' | 'defense' | 'setter' | 'pass' | 'block';

export interface StarLaunchOption {
  id: number;
  date: string;
  description: string;
  location: string;
  present_ids: number[];
}

export interface StarHistoryEntry {
  id: number;
  player_id: number;
  player_name: string;
  avatar_url?: string | null;
  category: StarCategory | 'promotion';
  action: 'add' | 'remove' | 'promote';
  count: number;
  created_at: string;
  given_by_id: number | null;
  given_by_name: string | null;
  given_by_profile: User['profile'] | null;
  /** Circuito em que a estrela foi ganha (vazio nos lançamentos antigos). */
  gameday: { id: number; date: string; description: string } | null;
  /** Esta remoção desfez o lançamento com este id. */
  reverts_id: number | null;
  /** Lançamento desfeito depois: quem desfez e quando. */
  undone_by: { name: string | null; at: string } | null;
}

export interface EvaluationConfig {
  id: number;
  name: string;
  is_active: boolean;
  w_serve: number;
  w_reception: number;
  w_pass: number;
  w_setting: number;
  w_attack: number;
  w_block: number;
  w_defense: number;
  w_recovery: number;
  w_positioning: number;
  w_communication: number;
  w_tactical: number;
  w_conditioning: number;
  w_consistency: number;
}

export const SKILL_LABELS: Record<keyof EvaluationSkills, string> = {
  serve: 'Saque',
  reception: 'Recepção',
  passing: 'Passe',
  setting: 'Levantamento',
  attack: 'Ataque',
  block: 'Bloqueio',
  defense: 'Defesa',
  recovery: 'Recuperação',
  positioning: 'Posicionamento',
  communication: 'Comunicação',
  tactical_iq: 'Int. Tática',
  conditioning: 'Condicionamento',
  consistency: 'Regularidade',
};

// ==================== Attendance ====================
export interface CourtCheckin {
  id: number;
  gameday: number;
  player: number;
  player_name: string;
  player_avatar: string | null;
  player_position: string;
  player_is_guest: boolean;
  player_invited_by?: string;
  arrived_at: string;
}

export interface GameDay {
  id: number;
  date: string;
  time?: string;
  time_end?: string;
  court_price?: number | null;
  credit_cost?: number | string;
  description?: string;
  location?: string;
  arena_name?: string;
  max_players?: number;
  pix_key?: string;
  created_by?: number;
  total_present: number;
  total_paid?: number;
  total_players: number;
  total_court_checkins?: number;
  is_closed?: boolean;
  is_published?: boolean;
  pricing_type?: PricingType;
  price_per_person?: Money | null;
  suggested_price_per_person?: Money | null;
  effective_price_per_person?: Money;
  requires_prepayment?: boolean;
  reservation_hold_minutes?: number | null;
  total_reserved?: number;
  attendances: Attendance[];
  court_checkins: CourtCheckin[];
  created_at: string;
}

export interface Attendance {
  id: number;
  gameday: number;
  player: number;
  player_name: string;
  credits_used?: number | string;
  used_priority?: boolean;
  used_credit?: boolean;
  player_avatar?: string;
  player_position: Position;
  player_shirt?: number;
  player_status?: string;
  player_is_guest?: boolean;
  player_invited_by?: string;
  present: boolean;
  has_paid: boolean;
  payment_claimed?: boolean;
  checked_at: string;
  was_no_show?: boolean;
  is_justified?: boolean;
  justification_text?: string;
  is_waitlist?: boolean;
  waitlist_joined_at?: string | null;
  gameday_date?: string;
  gameday_location?: string;
  is_reserved?: boolean;
  reserved_until?: string | null;
  amount_due?: Money | null;
  paid_method?: 'pix_manual' | 'pix_asaas' | 'cash' | 'exempt' | 'legacy' | null;
}

// ==================== Financeiro dos Circuitos ====================
/** Valores monetários chegam do DRF como string decimal ("12.50"). */
export type Money = string | number;
export type PricingType = 'split' | 'fixed';
export type ManualPaymentMethod = 'pix_manual' | 'cash' | 'exempt';

export interface CircuitFinanceSummary {
  pricing_type: PricingType;
  price_per_person: Money;
  suggested_price_per_person: Money | null;
  requires_prepayment: boolean;
  confirmed: number;
  reserved: number;
  paid: number;
  exempt: number;
  claimed: number;
  pending: number;
  expected: Money;
  collected: Money;
  outstanding: Money;
  court_cost: Money;
  balance: Money;
}

export interface FinanceAttendanceRow {
  attendance_id: number;
  player_id: number;
  player_name: string;
  player_avatar: string | null;
  player_is_guest: boolean;
  gameday_id: number;
  gameday_date: string;
  gameday_location: string | null;
  gameday_is_closed: boolean;
  amount_due: Money;
  is_reserved: boolean;
  reserved_until: string | null;
  payment_claimed: boolean;
}

export interface FinanceOverview {
  month: string;
  received: Money;
  circuits_received: Money;
  extras_received: Money;
  court_costs: Money;
  balance: Money;
  outstanding: Money;
  payments_count: number;
  pending_claims: number;
  plans: { active_subscriptions: number; mrr_estimate: Money };
  circuits: Array<CircuitFinanceSummary & { id: number; date: string; location: string | null; is_closed: boolean }>;
  by_location: Array<{ label: string; collected: Money; court_cost: Money; circuits: number }>;
  series: Array<{ month: string; received: Money; court_costs: Money }>;
}

// ==================== Dashboard ====================
export interface DashboardTopPlayer {
  id: number;
  name: string;
  avatar_url: string | null;
  wins?: number;
  total_matches?: number;
  win_rate?: number;
  big_stars?: number;
  mini_stars?: number;
  mvp_stars?: number;
  attack_stars?: number;
  defense_stars?: number;
  setter_stars?: number;
  pass_stars?: number;
  block_stars?: number;
}

export interface DashboardRecentStar {
  id: number;
  player_id: number;
  player_name: string;
  avatar_url: string | null;
  category: string;
  action: string;
  count: number;
  created_at: string;
}

export interface DashboardCategoryWinner {
  player_id: number;
  player_name: string;
  avatar_url: string | null;
  created_at: string;
}

/** Quanto vale cada ação no Fire Shark. */
export interface FireSharkPoints { win: number; loss: number; circuit: number }

/** Linha do Fire Shark: os pontos da temporada e de onde eles vêm. */
export interface FireSharkEntry {
  id: number;
  name: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  total_matches: number;
  win_rate: number;
  /** Dias de circuito com check-in na quadra. */
  circuits: number;
  score: number;
  points: { wins: number; losses: number; circuits: number };
}

export interface DashboardStats {
  season?: SeasonInfo;
  top_wins: DashboardTopPlayer[];
  top_stars: DashboardTopPlayer[];
  fire_sharks: FireSharkEntry[];
  recent_stars: DashboardRecentStar[];
  last_category_winners: Record<string, DashboardCategoryWinner>;
}

/** Linha do ranking de Elo da temporada (só quem terminou a calibração). */
export interface EloRankingEntry {
  id: number;
  position: number;
  name: string;
  avatar_url: string | null;
  elo: number;
  matches: number;
  wins: number;
  tier: string;
  tier_name: string;
  tier_icon: string;
  tier_color: string;
}

// ==================== Teams ====================
export type Modality = 2 | 3 | 4 | 5 | 6;

export const MODALITY_LABELS: Record<Modality, string> = {
  2: 'Dupla (2x2)',
  3: 'Trio (3x3)',
  4: 'Quarteto (4x4)',
  5: 'Quinteto (5x5)',
  6: 'Sexteto (6x6)',
};

export interface TeamPlayerData {
  id: number;
  name: string;
  display_name: string;
  main_position: Position;
  shirt_number?: number;
  avatar_url?: string;
  overall: number;
  is_guest?: boolean;
}

export interface GeneratedTeam {
  order: number;
  /** Quadra do time quando o sorteio é de várias quadras (1, 2, 3). */
  court?: number;
  name: string;
  color: string;
  color_hex: string;
  avg_overall: number;
  players: TeamPlayerData[];
}

export interface GenerateTeamsResult {
  teams: GeneratedTeam[];
  balance_score: number;
  total_players: number;
  modality: number;
  n_teams: number;
  /** Quantas quadras ao mesmo tempo o sorteio distribuiu. */
  courts?: number;
  generation_id?: number;
}

export interface TeamGenerationData {
  id: number;
  gameday: number;
  gameday_date?: string;
  gameday_time?: string;
  gameday_location?: string;
  /** Quadra dentro do circuito (dias com várias quadras ao mesmo tempo têm um sorteio por quadra). */
  court?: number;
  /** Quantas quadras o circuito tem e quantas continuam em jogo. */
  circuit_courts?: number;
  open_courts?: number;
  /** Jogo em andamento na quadra (placar salvo no servidor), para acompanhar de qualquer celular. */
  live?: CourtLive | null;
  modality: number;
  modality_display: string;
  created_by?: number;
  created_by_name?: string;
  notes?: string;
  balance_score: number;
  is_locked: boolean;
  teams: DBTeam[];
  /** Quem saiu da pelada: fora do Embaralhar/Completar, mas com check-in na quadra mantido. */
  removed_players?: Array<{ id: number; name: string; avatar_url: string | null }>;
  /** Quem chegou à quadra e ainda não está em nenhum time, por ordem de chegada (o Completar distribui). */
  waiting_players?: Array<{ id: number; name: string }>;
  created_at: string;
}

export interface DBTeam {
  id: number;
  generation: number;
  name: string;
  color: string;
  color_hex: string;
  avg_overall: number;
  order: number;
  team_players: DBTeamPlayer[];
}

export interface DBTeamPlayer {
  id: number;
  player: number;
  player_name: string;
  player_position: Position;
  player_overall: number;
  player_avatar?: string;
  player_shirt?: number;
  player_is_guest?: boolean;
  order_in_team: number;
}

export interface CourtTeamPlayer extends DBTeamPlayer {
  is_borrowed?: boolean;
}

export interface CourtTeam extends Omit<DBTeam, 'team_players'> {
  team_players: CourtTeamPlayer[];
}

// ==================== Matches ====================
export interface Match {
  id: number;
  date: string;
  location?: string;
  modality: Modality;
  modality_display: string;
  gameday?: number;
  team_generation?: number;
  notes?: string;
  created_by?: number;
  created_by_name?: string;
  match_teams: MatchTeam[];
  created_at: string;
}

export interface QuickMatchData {
  match: Partial<Match>;
  /** "quadra:jogo" da fila: salvar o mesmo jogo de novo não cria outra partida. */
  bracket_key?: string;
  teams: {
    team_id?: number;
    team_name: string;
    color_hex: string;
    score: number;
    player_ids: number[];
    mvp_ids?: number[];
    best_attacker_ids?: number[];
    best_server_ids?: number[];
    best_defender_ids?: number[];
    best_setter_ids?: number[];
    best_libero_ids?: number[];
    best_blocker_ids?: number[];
    best_opposite_ids?: number[];
    borrowed_ids?: number[];
  }[];
}

export interface MatchTeam {
  id: number;
  match: number;
  team_name: string;
  color_hex: string;
  score: number;
  winner: boolean;
  team?: number;
  match_players: MatchPlayer[];
}

export interface MatchPlayer {
  id: number;
  player: number;
  player_name: string;
  player_avatar?: string;
  player_shirt?: number;
  player_position?: string;
  player_is_guest?: boolean;
  player_invited_by?: string;
  match_team?: number;
  mvp: boolean;
  best_attacker: boolean;
  best_server: boolean;
  best_defender: boolean;
  best_setter: boolean;
  best_libero: boolean;
  best_blocker: boolean;
  best_opposite: boolean;
  is_borrowed?: boolean;
  borrowed_from_team_name?: string | null;
  /** Quanto o Elo da temporada mudou nesta partida (ex.: 18.4 ou -13.9). */
  elo_delta?: number | null;
}

// ==================== Hall of Fame ====================
export type HallOfFameCategory =
  | 'best_attacker' | 'best_defender' | 'best_server' | 'best_setter'
  | 'best_libero' | 'revelation' | 'most_present' | 'mvp'
  | 'best_blocker' | 'best_opposite';

export const HALL_OF_FAME_LABELS: Record<HallOfFameCategory, string> = {
  best_attacker: 'Melhor Atacante',
  best_defender: 'Melhor Defensor',
  best_server: 'Melhor Sacador',
  best_setter: 'Melhor Levantador',
  best_libero: 'Melhor Líbero',
  revelation: 'Revelação',
  most_present: 'Mais Presente',
  mvp: 'MVP da Temporada',
  best_blocker: 'Melhor Blocador',
  best_opposite: 'Melhor Oposto',
};

export * from './notification';
export interface HallOfFameEntry {
  id: number;
  category: HallOfFameCategory;
  category_display: string;
  player: number;
  player_name: string;
  player_avatar?: string;
  player_position: Position;
  player_shirt?: number;
  year: number;
  description?: string;
  awarded_by?: number;
  awarded_by_name?: string;
  created_at: string;
}

export interface RegulationText {
  id: number;
  title: string;
  content: string;
  updated_at: string;
  updated_by?: number;
  updated_by_name?: string;
}

// ==================== Dashboard ====================
export interface DashboardData {
  season?: SeasonInfo;
  total_players: number;
  active_players: number;
  next_circuit: {
    id: number;
    date: string;
    description: string | null;
    location: string;
    max_players: number;
    total_present: number;
    court_price: number;
    total_unpaid: number;
  } | null;
  attendance_trend: Array<{
    date: string;
    rate: number;
    present: number;
    max: number;
  }>;
  top_attendees: Array<{
    id: number;
    name: string;
    avatar_url: string;
    presence_count: number;
  }>;
  top_winners: TopWinner[];
  top_elo?: EloRankingEntry[];
  position_distribution: PositionDist[];
  fire_sharks: Array<FireSharkEntry & { position: string }>;
  dream_team: Array<{
    id: number;
    name: string;
    avatar_url?: string;
    position: string;
    wins: number;
    total_matches: number;
    win_rate: number;
    score: number;
  }>;
  hall_of_fame: { id: number; player_name: string; avatar_url?: string; category: string; year: number }[];
  most_present?: { id: number; name: string; avatar_url?: string; count: number } | null;
  season_mvp?: { id: number; name: string; avatar_url?: string; count: number } | null;
  revelation?: { id: number; name: string; avatar_url?: string; matches: number } | null;
  top_stars: Array<{
    id: number;
    name: string;
    avatar_url?: string;
    mvp_stars: number;
    attack_stars: number;
    defense_stars: number;
    setter_stars: number;
    pass_stars: number;
    block_stars: number;
    mini_stars: number;
    big_stars: number;
  }>;
  new_stars?: Array<{
    id: number;
    name: string;
    avatar_url?: string;
    mvp_stars: number;
    attack_stars: number;
    defense_stars: number;
    setter_stars: number;
    pass_stars: number;
    block_stars: number;
    mini_stars: number;
    big_stars: number;
    top_category: 'mvp' | 'attack' | 'defense' | null;
    updated_at: string;
  }>;
  last_updated: string;
}

export interface TopWinner {
  id: number;
  name: string;
  nickname?: string;
  position: Position;
  wins: number;
  avatar_url?: string;
  mini_stars: number;
  big_stars: number;
}

export interface HighlightPlayer {
  id: number;
  name: string;
  avatar_url?: string;
  count: number;
  mvp_stars: number;
  attack_stars: number;
  defense_stars: number;
  setter_stars: number;
  pass_stars: number;
  block_stars: number;
  mini_stars: number;
  big_stars: number;
}

export interface TopPlayer {
  id: number;
  name: string;
  nickname?: string;
  position: Position;
  overall: number;
  avatar_url?: string;
  shirt_number?: number;
}

export interface PositionDist {
  position: string;
  count: number;
}

// ==================== Player Stats ====================
export interface PlayerStats {
  player_id: number;
  total_matches: number;
  wins: number;
  losses?: number;
  draws?: number;
  win_rate: number;
  win_rank?: number | null;
  fire_shark_rank?: number;
  win_streak?: number;
  overall_rank?: number | null;
  latest_mini_star?: string | null;
  mvps: number;
  total_gamedays: number;
  attended_gamedays: number;
  attendance_rate: number;
  overall_history: { date: string; overall: number }[];
  /** Números da temporada atual (os campos acima são da carreira). */
  season?: PlayerSeasonStats;
}

export interface PlayerSeasonStats {
  number: number;
  name: string;
  matches: number;
  wins: number;
  losses: number;
  win_rate: number;
  point_balance: number;
  fire_shark_rank: number | null;
  /** Pontos do Fire Shark na temporada e de onde eles vêm (null = ainda não pontuou). */
  fire_score: number | null;
  fire_points: FireSharkEntry['points'] | null;
  fire_circuits: number;
  gladiator_rank: number | null;
  attendance_rate: number;
  attended_days: number;
  total_days: number;
}

// ==================== API Helpers ====================
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ==================== Temporadas e Elo ====================
export interface SeasonInfo {
  number: number;
  name: string;
  start_date: string | null;
  end_date: string;
  days_left: number;
  /** Quanto vale cada ação no Fire Shark. */
  fire_shark_points?: FireSharkPoints;
  /** Texto da premiação (escrito pelo admin na tela Temporadas). */
  prize_notes?: string;
  /** Só na pré-temporada: quando começa a Temporada 1. */
  next_season_starts_in?: number;
  next_season_start?: string;
}

export interface SeasonPodiumEntry {
  position: number;
  player_id: number;
  name: string;
  avatar_url: string | null;
  elo: number;
  elo_tier: string;
  wins: number;
  matches: number;
  fire_score: number | null;
}

export interface PastSeason {
  number: number;
  name: string;
  start_date: string | null;
  end_date: string;
  prize_notes: string;
  /** A organização conferiu a classificação final. Antes disso, os atletas não veem o pódio. */
  validated: boolean;
  validated_at: string | null;
  podium: { elo: SeasonPodiumEntry[]; fire_shark: SeasonPodiumEntry[]; gladiator: SeasonPodiumEntry[] };
}

export interface SeasonsResponse {
  current: SeasonInfo;
  past: PastSeason[];
}

export interface EloTier {
  name: string;
  key: string;
  min: number;
  max: number | null;
  color: string;
  icon: string;
}

export interface EloTiersResponse {
  tiers: EloTier[];
  rules: { start: number; k: number; k_placement: number; placement_games: number; min: number };
}

/** Celular que está marcando o placar de uma quadra. */
export interface BracketController {
  device: string;
  name: string;
  seen_at: string | null;
}

/** Fila e placar de uma quadra como estão no servidor. */
export interface BracketServerState {
  state: Record<string, unknown> | null;
  version: number;
  controller: BracketController | null;
  updated_at: string | null;
}

/** Resumo do jogo em andamento numa quadra. */
export interface CourtLive {
  match_number: number;
  team_a: string;
  color_a: string;
  score_a: number;
  team_b: string;
  color_b: string;
  score_b: number;
  controller_name: string;
  controller_seen_at: string | null;
}
