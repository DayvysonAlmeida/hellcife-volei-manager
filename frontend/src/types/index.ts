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
export type Position = 'libero' | 'setter' | 'opposite' | 'outside' | 'middle' | 'universal';
export type DominantHand = 'right' | 'left' | 'both';
export type Gender = 'M' | 'F';
export type PlayerStatus = 'active' | 'inactive' | 'injured' | 'suspended';

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
  M: 'Masculino',
  F: 'Feminino',
};

export const STATUS_LABELS: Record<PlayerStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  injured: 'Lesionado',
  suspended: 'Suspenso',
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
  consecutive_absences: number;
  stats?: {
    matches: number;
    win_rate: number;
    wins?: number;
    win_rank?: number;
    win_streak?: number;
    mvp: number;
    best_attacker: number;
    best_server: number;
    best_defender: number;
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
  evaluator?: number;
  evaluator_name?: string;
  date: string;
  notes?: string;
  overall: number;
  created_at: string;
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
  court_price?: number;
  description?: string;
  location?: string;
  max_players?: number;
  created_by?: number;
  total_present: number;
  total_paid?: number;
  total_players: number;
  total_court_checkins?: number;
  is_closed?: boolean;
  is_published?: boolean;
  attendances: Attendance[];
  court_checkins: CourtCheckin[];
  created_at: string;
}

export interface Attendance {
  id: number;
  gameday: number;
  player: number;
  player_name: string;
  player_avatar?: string;
  player_position: Position;
  player_shirt?: number;
  player_status?: string;
  player_is_guest?: boolean;
  player_invited_by?: string;
  present: boolean;
  has_paid: boolean;
  checked_at: string;
  was_no_show?: boolean;
  is_justified?: boolean;
  justification_text?: string;
  is_waitlist?: boolean;
  waitlist_joined_at?: string | null;
  gameday_date?: string;
  gameday_location?: string;
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
  generation_id?: number;
}

export interface TeamGenerationData {
  id: number;
  gameday: number;
  gameday_date?: string;
  gameday_time?: string;
  gameday_location?: string;
  modality: number;
  modality_display: string;
  created_by?: number;
  created_by_name?: string;
  notes?: string;
  balance_score: number;
  is_locked: boolean;
  teams: DBTeam[];
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

// ==================== Dashboard ====================
export interface DashboardData {
  total_players: number;
  active_players: number;
  present_today: number;
  paid_today: number;
  top_winners: TopWinner[];
  position_distribution: PositionDist[];
  highlights: Record<string, HighlightPlayer[]>;
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
  losses: number;
  draws: number;
  win_rate: number;
  mvps: number;
  total_gamedays: number;
  attended_gamedays: number;
  attendance_rate: number;
  overall_history: { date: string; overall: number }[];
}

// ==================== API Helpers ====================
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
