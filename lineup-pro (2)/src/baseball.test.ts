import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAllPositions, getPositionGroups, DEFAULT_SETTINGS } from './constants';

test('baseball uses nine standard positions', () => {
  const positions = getAllPositions({ ...DEFAULT_SETTINGS, sport: 'baseball' });
  assert.deepEqual(positions, ['C','P','1B','2B','SS','3B','LF','CF','RF']);
  assert.equal(new Set(positions).size, 9);
});

test('softball defaults preserve the existing four-outfielder layout', () => {
  assert.deepEqual(getPositionGroups(DEFAULT_SETTINGS).OUTFIELD, ['LF','LCF','RCF','RF']);
  assert.equal(getAllPositions(DEFAULT_SETTINGS).length, 10);
});

test('baseball can retain custom defensive positions', () => {
  assert.deepEqual(getPositionGroups({ ...DEFAULT_SETTINGS, sport: 'baseball', additionalPositions: [{ id: 'ROVER', group: 'OUTFIELD' }] }).OUTFIELD, ['LF','CF','RF','ROVER']);
});
