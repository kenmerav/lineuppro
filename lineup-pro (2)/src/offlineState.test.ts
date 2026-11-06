import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SETTINGS } from './constants';
import {
  createOfflineTeamState,
  offlineStateKey,
  readOfflineTeamState,
  writeOfflineTeamState,
} from './offlineState';

const baseState = {
  players: [{ id: '1', name: 'Player', color: '#000000', active: true }],
  battingOrder: ['1'],
  assignments: { innings: 1, byInning: { 1: { P: '1', dugout: [] } } },
  settings: DEFAULT_SETTINGS,
  branding: { teamName: 'WVC Warriors' },
  savedGames: [],
  activeGameId: null,
  masterRoster: [{ id: '1', name: 'Player', color: '#000000', active: true }],
  gameLog: { actualInnings: 1, status: 'in_progress' as const, playerStats: { 1: { ab: 1, played: true } } },
};

test('offline team state keeps the active game and pending sync marker', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const snapshot = createOfflineTeamState(baseState, true);

  assert.equal(writeOfflineTeamState('team-1', snapshot, storage), true);
  assert.equal(values.has(offlineStateKey('team-1')), true);

  const restored = readOfflineTeamState('team-1', storage);
  assert.equal(restored?.pendingSync, true);
  assert.equal(restored?.branding.teamName, 'WVC Warriors');
  assert.equal(restored?.gameLog?.playerStats['1'].ab, 1);
});

test('invalid offline data is ignored instead of breaking team loading', () => {
  const storage = { getItem: () => '{bad json' };
  assert.equal(readOfflineTeamState('team-1', storage), null);
});
