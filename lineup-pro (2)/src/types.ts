export interface Player {
  id: string;
  name: string;
  number?: string;
  grade?: "6" | "7" | "8";
  walkoutSongName?: string;
  walkoutSongDataUrl?: string;
  appleMusicSongId?: string;
  appleMusicSongUrl?: string;
  appleMusicSongName?: string;
  appleMusicArtistName?: string;
  walkoutStartSec?: number;
  walkoutDurationSec?: number;
  color: string;
  active?: boolean;
}

export type Position = "C" | "P" | "1B" | "2B" | "SS" | "3B" | "LF" | "LCF" | "RCF" | "RF" | "DUGOUT";

export interface InningAssignments {
  [position: string]: any;
  dugout: string[]; // list of playerIds
}

export interface DefenseAssignments {
  innings: number;
  byInning: {
    [inning: number]: InningAssignments;
  };
}

export interface TeamBranding {
  teamName: string;
  logoDataUrl?: string;
  bannerColor?: string;
}

export type DefensivePositionGroup = "INFIELD" | "OUTFIELD";

export interface AdditionalDefensivePosition {
  id: string;
  group: DefensivePositionGroup;
}

export interface Settings {
  sport?: "softball" | "baseball";
  battingFormat?: "standard" | "continuous";
  battingCount: number;
  inningsCount: number;
  allowEmptyOutfield: boolean;
  requireDugout: boolean;
  strictSwap: boolean;
  maxConsecutiveInfield: number;
  maxConsecutiveOutfield: number;
  maxConsecutiveBench: number;
  allowSamePositionBackToBack: boolean;
  preventDuplicatePositionInGame: boolean;
  requireEarlyInfieldByInning3: boolean;
  additionalPositions: AdditionalDefensivePosition[];
  customRules: string[];
}

export type TeamType = NonNullable<Settings["sport"]>;

export interface GameMeta {
  name: string;
  date: string;
  opponent?: string;
  location?: string;
  notes?: string;
}

export interface GameLog {
  actualInnings: number;
  status?: "not_started" | "in_progress" | "final";
  currentInning?: number;
  half?: "top" | "bottom";
  outs?: number;
  ourSide?: "home" | "away";
  ourScore?: number;
  opponentScore?: number;
  ourRunsByInning?: Record<number, number>;
  opponentRunsByInning?: Record<number, number>;
  ourHits?: number;
  opponentHits?: number;
  ourErrors?: number;
  opponentErrors?: number;
  currentBatterId?: string;
  currentPitcherId?: string;
  opponentHitters?: OpponentHitter[];
  currentOpponentHitterId?: string;
  currentPitchSequence?: PitchCall[];
  events?: GameEvent[];
  playerStats: {
    [playerId: string]: PlayerGameStats;
  };
}

export interface PlayerGameStats {
  ab: number;
  played: boolean;
  runs?: number;
  hits?: number;
  doubles?: number;
  triples?: number;
  homeRuns?: number;
  rbi?: number;
  walks?: number;
  hitByPitch?: number;
  strikeouts?: number;
  errors?: number;
  pitches?: number;
  strikesThrown?: number;
  pitchingStrikeouts?: number;
  walksAllowed?: number;
}

export type PlateAppearanceOutcome =
  | "single"
  | "double"
  | "triple"
  | "home_run"
  | "walk"
  | "hit_by_pitch"
  | "reached_on_error"
  | "strikeout"
  | "out";

export type PitchCall = "ball" | "strike";

export interface OpponentHitter {
  id: string;
  number: string;
}

export interface GameStateSnapshot {
  actualInnings: number;
  status: "not_started" | "in_progress" | "final";
  currentInning: number;
  half: "top" | "bottom";
  outs: number;
  ourSide: "home" | "away";
  ourScore: number;
  opponentScore: number;
  ourRunsByInning: Record<number, number>;
  opponentRunsByInning: Record<number, number>;
  ourHits: number;
  opponentHits: number;
  ourErrors: number;
  opponentErrors: number;
  currentBatterId?: string;
  currentPitcherId?: string;
  opponentHitters: OpponentHitter[];
  currentOpponentHitterId?: string;
  currentPitchSequence: PitchCall[];
  playerStats: Record<string, PlayerGameStats>;
}

export interface GameEvent {
  id: string;
  type: "plate_appearance" | "opponent" | "pitch" | "fielding_error" | "substitution" | "inning" | "score" | "game" | "lineup";
  inning: number;
  half: "top" | "bottom";
  createdAt: string;
  description: string;
  playerId?: string;
  secondaryPlayerId?: string;
  position?: string;
  outcome?: PlateAppearanceOutcome;
  resultCode?: string;
  battingSide?: "our" | "opponent";
  opponentHitterId?: string;
  pitchSequence?: PitchCall[];
  before: GameStateSnapshot;
}

export interface SavedGame {
  id: string;
  meta: GameMeta;
  players: Player[];
  battingOrder: string[];
  assignments: DefenseAssignments;
  settings: Settings;
  branding: TeamBranding;
  log?: GameLog;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export interface FairnessMetrics {
  playerStats: {
    [playerId: string]: {
      infield: number;
      outfield: number;
      bench: number;
      maxStreak: number;
      positions: { [pos: string]: number };
    };
  };
  teamStats: {
    avgInfield: number;
    minInfield: number;
    maxInfield: number;
    stdDevInfield: number;
    minBench: number;
    maxBench: number;
  };
}

export interface SeasonFairnessMetrics {
  playerStats: {
    [playerId: string]: {
      totalInfield: number;
      totalOutfield: number;
      totalBench: number;
      gamesPlayed: number;
      avgInfieldPerGame: number;
      avgOutfieldPerGame: number;
      avgBenchPerGame: number;
      totalAB: number;
      avgABPerGame: number;
      totalHits: number;
      totalDoubles: number;
      totalTriples: number;
      totalHomeRuns: number;
      totalRuns: number;
      totalRbi: number;
      totalWalks: number;
      totalHitByPitch: number;
      totalStrikeouts: number;
      totalErrors: number;
      totalPitches: number;
      totalStrikesThrown: number;
      totalPitchingStrikeouts: number;
      totalWalksAllowed: number;
    }
  };
  teamStats: {
    avgInfieldPerGame: number;
    minInfieldPerGame: number;
    maxInfieldPerGame: number;
  };
}
