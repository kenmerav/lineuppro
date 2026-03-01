export interface Player {
  id: string;
  name: string;
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

export interface Settings {
  inningsCount: number;
  allowEmptyOutfield: boolean;
  requireDugout: boolean;
  strictSwap: boolean;
  maxConsecutiveInfield: number;
  maxConsecutiveOutfield: number;
  allowSamePositionBackToBack: boolean;
}

export interface GameMeta {
  name: string;
  date: string;
  opponent?: string;
  location?: string;
  notes?: string;
}

export interface GameLog {
  actualInnings: number;
  playerStats: {
    [playerId: string]: {
      ab: number;
      played: boolean; // whether they actually showed up/played
    };
  };
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
    }
  };
  teamStats: {
    avgInfieldPerGame: number;
    minInfieldPerGame: number;
    maxInfieldPerGame: number;
  };
}
