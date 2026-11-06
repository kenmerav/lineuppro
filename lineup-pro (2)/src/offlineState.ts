import type {
  DefenseAssignments,
  GameLog,
  Player,
  SavedGame,
  Settings,
  TeamBranding,
} from './types';

export const OFFLINE_STATE_VERSION = 1;

export interface OfflineTeamState {
  version: typeof OFFLINE_STATE_VERSION;
  savedAt: string;
  pendingSync: boolean;
  players: Player[];
  battingOrder: string[];
  assignments: DefenseAssignments;
  settings: Settings;
  branding: TeamBranding;
  savedGames: SavedGame[];
  activeGameId: string | null;
  masterRoster: Player[];
  gameLog?: GameLog;
}

export type OfflineTeamStateInput = Omit<OfflineTeamState, 'version' | 'savedAt' | 'pendingSync'>;

export const offlineStateKey = (teamId: string) => `lineuppro:offline-team:${teamId}`;

export const createOfflineTeamState = (
  state: OfflineTeamStateInput,
  pendingSync: boolean,
): OfflineTeamState => ({
  ...state,
  version: OFFLINE_STATE_VERSION,
  savedAt: new Date().toISOString(),
  pendingSync,
});

export const readOfflineTeamState = (
  teamId: string,
  storage: Pick<Storage, 'getItem'> | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): OfflineTeamState | null => {
  if (!storage) return null;

  try {
    const raw = storage.getItem(offlineStateKey(teamId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OfflineTeamState>;
    if (
      parsed.version !== OFFLINE_STATE_VERSION
      || !Array.isArray(parsed.players)
      || !Array.isArray(parsed.battingOrder)
      || !parsed.assignments
      || !parsed.settings
      || !parsed.branding
      || !Array.isArray(parsed.savedGames)
      || !Array.isArray(parsed.masterRoster)
    ) return null;
    return parsed as OfflineTeamState;
  } catch {
    return null;
  }
};

export const writeOfflineTeamState = (
  teamId: string,
  state: OfflineTeamState,
  storage: Pick<Storage, 'setItem'> | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
) => {
  if (!storage) return false;

  try {
    storage.setItem(offlineStateKey(teamId), JSON.stringify(state));
    return true;
  } catch (error) {
    console.error('Failed to save offline team state', error);
    return false;
  }
};
