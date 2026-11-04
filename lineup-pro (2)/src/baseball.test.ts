import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getAllPositions, getPositionGroups, DEFAULT_SETTINGS } from './constants';
import { DefensiveFieldDiagram } from './components/DefensiveFieldDiagram';
import { BaseballLineupCard } from './components/BaseballLineupCard';
import type { Settings } from './types';

const baseball: Settings = { ...DEFAULT_SETTINGS, sport: 'baseball' };

test('baseball uses exactly nine standard positions', () => {
  const positions = getAllPositions(baseball);
  assert.deepEqual(positions, ['C', 'P', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF']);
  assert.equal(new Set(positions).size, 9);
});

test('softball defaults preserve the existing four-outfielder layout', () => {
  assert.deepEqual(getPositionGroups(DEFAULT_SETTINGS).OUTFIELD, ['LF', 'LCF', 'RCF', 'RF']);
  assert.equal(getAllPositions(DEFAULT_SETTINGS).length, 10);
  assert.equal(getAllPositions({ additionalPositions: [] }).length, 10);
});

test('baseball ignores, but does not delete, saved custom softball positions', () => {
  const settings: Settings = { ...baseball, additionalPositions: [{ id: 'ROVER', group: 'OUTFIELD' }] };
  assert.equal(getAllPositions(settings).length, 9);
  assert.equal(settings.additionalPositions[0].id, 'ROVER');
  assert.ok(getAllPositions({ ...settings, sport: 'softball' }).includes('ROVER'));
});

test('softball still supports a custom CF position', () => {
  assert.ok(getAllPositions({ ...DEFAULT_SETTINGS, additionalPositions: [{ id: 'CF', group: 'OUTFIELD' }] }).includes('CF'));
});

test('baseball field renders CF and not the softball split-center positions', () => {
  const html = renderToStaticMarkup(React.createElement(DefensiveFieldDiagram, {
    assignments: { innings: 1, byInning: { 1: { dugout: [] } } },
    players: [], settings: baseball, inning: 1,
  }));
  assert.match(html, /title="CF: Open"/);
  assert.doesNotMatch(html, /title="(?:LCF|RCF):/);
  assert.equal((html.match(/title="[A-Z0-9]+: Open"/g) || []).length, 9);
});

test('softball field retains both split-center positions', () => {
  const html = renderToStaticMarkup(React.createElement(DefensiveFieldDiagram, {
    assignments: { innings: 1, byInning: { 1: { dugout: [] } } },
    players: [], settings: DEFAULT_SETTINGS, inning: 1,
  }));
  assert.match(html, /title="LCF: Open"/);
  assert.match(html, /title="RCF: Open"/);
});

test('lineup card includes team branding, game details, jersey and starting position', () => {
  const html = renderToStaticMarkup(React.createElement(BaseballLineupCard, {
    players: [{ id: 'one', name: 'Test Player', number: '12', color: '#000' }],
    battingOrder: ['one'],
    assignments: { innings: 7, byInning: { 1: { CF: 'one', dugout: [] } } },
    branding: { teamName: 'West Valley Christian Warriors' }, settings: baseball,
    opponent: 'Visiting Team', date: '2026-11-04',
  }));
  for (const value of ['West Valley Christian Warriors', 'Test Player', '12', 'CF', 'Visiting Team', '2026-11-04']) {
    assert.ok(html.includes(value));
  }
});
