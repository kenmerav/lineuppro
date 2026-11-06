import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_SETTINGS } from './constants';
import { PostGameTab } from './components/PostGameTab';
import {
  addOpponentHitter,
  isOurAtBat,
  normalizeGameLog,
  parsePlateAppearanceResult,
  recordFieldingError,
  recordOpponentTotal,
  recordOpponentPlateAppearance,
  recordPitch,
  recordPitchCall,
  recordPitchingResult,
  recordPlateAppearance,
  startGame,
  undoLastEvent,
} from './gameLog';
import type { DefenseAssignments, Player } from './types';

const players: Player[] = [
  { id: 'a', name: 'Alex', color: '#000000', active: true },
  { id: 'b', name: 'Blake', color: '#111111', active: true },
  { id: 'c', name: 'Casey', color: '#222222', active: true },
];
const assignments: DefenseAssignments = {
  innings: DEFAULT_SETTINGS.inningsCount,
  byInning: { 1: { P: 'a', dugout: [] } },
};

test('legacy game logs retain old stats and receive live-game defaults', () => {
  const log = normalizeGameLog({ actualInnings: 5, playerStats: { a: { ab: 3, played: true } } }, players, assignments);
  assert.equal(log.status, 'final');
  assert.equal(log.actualInnings, 5);
  assert.equal(log.playerStats.a.ab, 3);
  assert.equal(log.playerStats.a.hits, 0);
  assert.equal(log.playerStats.b.ab, 0);
});

test('typed scorebook codes map to baseball stats while preserving the exact result', () => {
  assert.deepEqual(parsePlateAppearanceResult('e6'), { code: 'E6', outcome: 'reached_on_error' });
  assert.deepEqual(parsePlateAppearanceResult('6 - 3'), { code: '6-3', outcome: 'out' });
  assert.deepEqual(parsePlateAppearanceResult('bb'), { code: 'BB', outcome: 'walk' });
  assert.deepEqual(parsePlateAppearanceResult('Kc'), { code: 'KC', outcome: 'strikeout' });

  const parsed = parsePlateAppearanceResult('E1');
  const log = recordPlateAppearance(normalizeGameLog(undefined, players, assignments), {
    batterId: 'a', batterName: 'Alex', outcome: parsed.outcome, resultCode: parsed.code, runScorerIds: [], rbi: 0,
  });
  assert.equal(log.events.at(-1)?.resultCode, 'E1');
  assert.equal(log.playerStats.a.ab, 1);
  assert.equal(log.opponentErrors, 1);
});

test('opponent jersey lineup advances hitters and flips to our lineup after three outs', () => {
  let log = startGame(normalizeGameLog(undefined, players, assignments), 'home');
  log = addOpponentHitter(log, '#12');
  log = addOpponentHitter(log, '7');
  assert.equal(log.opponentHitters[0].number, '12');
  assert.equal(log.currentOpponentHitterId, log.opponentHitters[0].id);

  const first = log.opponentHitters[0];
  const second = log.opponentHitters[1];
  const errorResult = parsePlateAppearanceResult('E6');
  log = recordOpponentPlateAppearance(log, {
    hitterId: first.id, hitterNumber: first.number, outcome: errorResult.outcome, resultCode: errorResult.code, pitcherId: 'a', errorFielderId: 'b',
  });
  assert.equal(log.ourErrors, 1);
  assert.equal(log.playerStats.b.errors, 1);
  assert.equal(log.currentOpponentHitterId, second.id);

  for (let out = 0; out < 3; out += 1) {
    const hitter = log.opponentHitters[out % log.opponentHitters.length];
    const strikeout = parsePlateAppearanceResult('K');
    log = recordOpponentPlateAppearance(log, {
      hitterId: hitter.id, hitterNumber: hitter.number, outcome: strikeout.outcome, resultCode: strikeout.code, pitcherId: 'a',
    });
  }
  assert.equal(log.playerStats.a.pitchingStrikeouts, 3);
  assert.equal(log.half, 'bottom');
  assert.equal(isOurAtBat(log), true);
});

test('legacy play history reconstructs an inning line score', () => {
  const before = normalizeGameLog(undefined, players, assignments);
  const withRun = recordOpponentTotal(startGame(before, 'home'), 'opponentScore', 1);
  const legacy = { ...withRun, opponentRunsByInning: undefined };
  const restored = normalizeGameLog(legacy, players, assignments);
  assert.equal(restored.opponentScore, 1);
  assert.equal(restored.opponentRunsByInning[1], 1);
});

test('plate appearances update batting stats, runs and automatic half-innings', () => {
  let log = startGame(normalizeGameLog(undefined, players, assignments), 'away');
  log = recordPlateAppearance(log, {
    batterId: 'a', batterName: 'Alex', outcome: 'home_run', runScorerIds: ['b', 'a'], rbi: 2,
  });
  assert.equal(log.ourScore, 2);
  assert.equal(log.ourRunsByInning[1], 2);
  assert.equal(log.ourHits, 1);
  assert.equal(log.playerStats.a.ab, 1);
  assert.equal(log.playerStats.a.homeRuns, 1);
  assert.equal(log.playerStats.a.rbi, 2);
  assert.equal(log.playerStats.a.runs, 1);
  assert.equal(log.playerStats.b.runs, 1);

  log = recordPlateAppearance(log, { batterId: 'b', batterName: 'Blake', outcome: 'walk', runScorerIds: [], rbi: 0 });
  assert.equal(log.playerStats.b.ab, 0);
  assert.equal(log.playerStats.b.walks, 1);

  for (let out = 0; out < 3; out += 1) {
    log = recordPlateAppearance(log, { batterId: 'c', batterName: 'Casey', outcome: 'out', runScorerIds: [], rbi: 0 });
  }
  assert.equal(log.half, 'bottom');
  assert.equal(log.currentInning, 1);
  assert.equal(log.outs, 0);
});

test('pitching, opponent and fielding events are tracked and undoable', () => {
  let log = startGame(normalizeGameLog(undefined, players, assignments), 'home');
  log = recordPitch(log, 'a', 'Alex', 5);
  log = recordPitchingResult(log, 'a', 'Alex', 'strikeout');
  log = recordOpponentTotal(log, 'opponentHits', 1);
  log = recordOpponentTotal(log, 'opponentScore', 1);
  log = recordFieldingError(log, 'b', 'Blake');
  assert.equal(log.playerStats.a.pitches, 5);
  assert.equal(log.playerStats.a.pitchingStrikeouts, 1);
  assert.equal(log.opponentHits, 1);
  assert.equal(log.opponentScore, 1);
  assert.equal(log.opponentRunsByInning[1], 1);
  assert.equal(log.ourErrors, 1);
  assert.equal(log.playerStats.b.errors, 1);

  log = undoLastEvent(log);
  assert.equal(log.ourErrors, 0);
  assert.equal(log.playerStats.b.errors, 0);
  assert.equal(log.events.at(-1)?.description, 'Opponent run');
});

test('ball and strike checks persist in the plate appearance and count pitches', () => {
  let log = startGame(normalizeGameLog(undefined, players, assignments), 'away');
  log = recordPitchCall(log, 'ball');
  log = recordPitchCall(log, 'strike');
  log = recordPitchCall(log, 'strike');
  assert.deepEqual(log.currentPitchSequence, ['ball', 'strike', 'strike']);

  log = recordPlateAppearance(log, {
    batterId: 'a', batterName: 'Alex', outcome: 'single', runScorerIds: [], rbi: 0,
  });
  assert.deepEqual(log.events.at(-1)?.pitchSequence, ['ball', 'strike', 'strike']);
  assert.deepEqual(log.currentPitchSequence, []);

  log = { ...log, half: 'bottom' };
  log = recordPitchCall(log, 'ball', 'a', 'Alex');
  assert.equal(log.playerStats.a.pitches, 1);
  assert.deepEqual(log.currentPitchSequence, ['ball']);
  log = undoLastEvent(log);
  assert.equal(log.playerStats.a.pitches, 0);
  assert.deepEqual(log.currentPitchSequence, []);
});

test('line score keeps runs in their inning and undo restores the chart', () => {
  let log = startGame(normalizeGameLog(undefined, players, assignments), 'home');
  log = recordOpponentTotal(log, 'opponentScore', 1);
  log = recordOpponentTotal(log, 'opponentScore', 1);
  assert.equal(log.opponentRunsByInning[1], 2);

  log = recordPlateAppearance({ ...log, half: 'bottom' }, {
    batterId: 'a', batterName: 'Alex', outcome: 'home_run', runScorerIds: ['a'], rbi: 1,
  });
  assert.equal(log.ourRunsByInning[1], 1);

  log = { ...log, currentInning: 2, half: 'top' };
  log = recordOpponentTotal(log, 'opponentScore', 1);
  assert.equal(log.opponentRunsByInning[1], 2);
  assert.equal(log.opponentRunsByInning[2], 1);
  assert.equal(log.opponentScore, 3);

  log = undoLastEvent(log);
  assert.equal(log.opponentRunsByInning[2], undefined);
  assert.equal(log.opponentScore, 2);
});

test('a finished game is read-only until it is resumed', () => {
  const finalLog = {
    ...normalizeGameLog(undefined, players, assignments),
    status: 'final' as const,
  };
  const markup = renderToStaticMarkup(React.createElement(PostGameTab, {
    players,
    battingOrder: players.map((player) => player.id),
    assignments,
    settings: DEFAULT_SETTINGS,
    teamName: 'WVC Warriors',
    opponentName: 'Opponent',
    gameLog: finalLog,
    onSaveLog: () => undefined,
    onStartNewGame: () => undefined,
  }));

  assert.match(markup, /Resume Game/);
  assert.match(markup, /<button disabled=""[^>]*title="Remove our run"/);
  assert.doesNotMatch(markup, />Our At-Bat</);
  assert.doesNotMatch(markup, />Opponent At-Bat</);
  assert.doesNotMatch(markup, />Substitution</);
});
