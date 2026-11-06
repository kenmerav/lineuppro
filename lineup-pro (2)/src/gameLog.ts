import type {
  DefenseAssignments,
  GameEvent,
  GameLog,
  GameStateSnapshot,
  OpponentHitter,
  PlateAppearanceOutcome,
  PitchCall,
  Player,
  PlayerGameStats,
} from "./types";

export type NormalizedGameLog = GameLog & GameStateSnapshot & { events: GameEvent[] };

export const emptyPlayerGameStats = (played = true): PlayerGameStats => ({
  ab: 0,
  played,
  runs: 0,
  hits: 0,
  doubles: 0,
  triples: 0,
  homeRuns: 0,
  rbi: 0,
  walks: 0,
  hitByPitch: 0,
  strikeouts: 0,
  errors: 0,
  pitches: 0,
  pitchingStrikeouts: 0,
  walksAllowed: 0,
});

const normalizePlayerStats = (stats: PlayerGameStats | undefined, played: boolean) => ({
  ...emptyPlayerGameStats(played),
  ...(stats || {}),
  played: stats?.played ?? played,
});

const clonePlayerStats = (playerStats: Record<string, PlayerGameStats>) =>
  Object.fromEntries(Object.entries(playerStats).map(([id, stats]) => [id, { ...stats }]));

const restoreInningRuns = (
  stored: Record<number, number> | undefined,
  events: GameEvent[],
  scoreField: "ourScore" | "opponentScore",
  total: number,
  currentInning: number,
) => {
  if (stored && Object.keys(stored).length > 0) return { ...stored };

  const restored: Record<number, number> = {};
  events.forEach((event, index) => {
    const before = event.before?.[scoreField] || 0;
    const after = events[index + 1]?.before?.[scoreField] ?? total;
    const change = after - before;
    if (change !== 0) {
      restored[event.inning] = Math.max(0, (restored[event.inning] || 0) + change);
    }
  });

  const restoredTotal = Object.values(restored).reduce((sum, runs) => sum + runs, 0);
  if (restoredTotal < total) {
    restored[Math.max(1, currentInning)] = (restored[Math.max(1, currentInning)] || 0) + total - restoredTotal;
  }
  return restored;
};

export const normalizeGameLog = (
  gameLog: GameLog | undefined,
  players: Player[],
  assignments: DefenseAssignments,
): NormalizedGameLog => {
  const playerStats = clonePlayerStats(gameLog?.playerStats || {});
  players.forEach((player) => {
    playerStats[player.id] = normalizePlayerStats(playerStats[player.id], player.active !== false);
  });
  const currentInning = Math.max(1, gameLog?.currentInning || 1);
  const status = gameLog?.status || (gameLog ? "final" : "not_started");
  const ourScore = Math.max(0, gameLog?.ourScore || 0);
  const opponentScore = Math.max(0, gameLog?.opponentScore || 0);
  const events = [...(gameLog?.events || [])];

  return {
    actualInnings: Math.max(1, gameLog?.actualInnings || currentInning),
    status,
    currentInning,
    half: gameLog?.half || "top",
    outs: Math.min(2, Math.max(0, gameLog?.outs || 0)),
    ourSide: gameLog?.ourSide || "home",
    ourScore,
    opponentScore,
    ourRunsByInning: restoreInningRuns(gameLog?.ourRunsByInning, events, "ourScore", ourScore, currentInning),
    opponentRunsByInning: restoreInningRuns(gameLog?.opponentRunsByInning, events, "opponentScore", opponentScore, currentInning),
    ourHits: Math.max(0, gameLog?.ourHits || 0),
    opponentHits: Math.max(0, gameLog?.opponentHits || 0),
    ourErrors: Math.max(0, gameLog?.ourErrors || 0),
    opponentErrors: Math.max(0, gameLog?.opponentErrors || 0),
    currentBatterId: gameLog?.currentBatterId,
    currentPitcherId: gameLog?.currentPitcherId || assignments.byInning[1]?.P,
    opponentHitters: (gameLog?.opponentHitters || []).map((hitter) => ({ ...hitter })),
    currentOpponentHitterId: gameLog?.currentOpponentHitterId,
    currentPitchSequence: [...(gameLog?.currentPitchSequence || [])],
    events,
    playerStats,
  };
};

const snapshot = (log: NormalizedGameLog): GameStateSnapshot => ({
  actualInnings: log.actualInnings,
  status: log.status,
  currentInning: log.currentInning,
  half: log.half,
  outs: log.outs,
  ourSide: log.ourSide,
  ourScore: log.ourScore,
  opponentScore: log.opponentScore,
  ourRunsByInning: { ...log.ourRunsByInning },
  opponentRunsByInning: { ...log.opponentRunsByInning },
  ourHits: log.ourHits,
  opponentHits: log.opponentHits,
  ourErrors: log.ourErrors,
  opponentErrors: log.opponentErrors,
  currentBatterId: log.currentBatterId,
  currentPitcherId: log.currentPitcherId,
  opponentHitters: log.opponentHitters.map((hitter) => ({ ...hitter })),
  currentOpponentHitterId: log.currentOpponentHitterId,
  currentPitchSequence: [...log.currentPitchSequence],
  playerStats: clonePlayerStats(log.playerStats),
});

const restoreSnapshot = (before: GameStateSnapshot, events: GameEvent[]): NormalizedGameLog => ({
  ...before,
  ourRunsByInning: { ...(before.ourRunsByInning || {}) },
  opponentRunsByInning: { ...(before.opponentRunsByInning || {}) },
  opponentHitters: (before.opponentHitters || []).map((hitter) => ({ ...hitter })),
  currentPitchSequence: [...(before.currentPitchSequence || [])],
  playerStats: clonePlayerStats(before.playerStats),
  events,
});

const adjustRuns = (
  log: NormalizedGameLog,
  side: "our" | "opponent",
  delta: number,
) => {
  const totalField = side === "our" ? "ourScore" : "opponentScore";
  const inningsField = side === "our" ? "ourRunsByInning" : "opponentRunsByInning";

  if (delta >= 0) {
    log[totalField] += delta;
    log[inningsField][log.currentInning] = (log[inningsField][log.currentInning] || 0) + delta;
    return;
  }

  let remaining = Math.min(Math.abs(delta), log[totalField]);
  log[totalField] -= remaining;
  for (let inning = log.currentInning; inning >= 1 && remaining > 0; inning -= 1) {
    const removable = Math.min(log[inningsField][inning] || 0, remaining);
    if (removable > 0) {
      log[inningsField][inning] -= removable;
      remaining -= removable;
    }
  }
};

const appendEvent = (
  log: NormalizedGameLog,
  event: Omit<GameEvent, "id" | "inning" | "half" | "createdAt" | "before">,
  update: (next: NormalizedGameLog) => void,
): NormalizedGameLog => {
  const before = snapshot(log);
  const next: NormalizedGameLog = {
    ...log,
    playerStats: clonePlayerStats(log.playerStats),
    events: [...log.events],
  };
  update(next);
  next.events.push({
    ...event,
    id: crypto.randomUUID(),
    inning: log.currentInning,
    half: log.half,
    createdAt: new Date().toISOString(),
    before,
  });
  return next;
};

const advanceHalf = (log: NormalizedGameLog) => {
  log.outs = 0;
  log.currentPitchSequence = [];
  if (log.half === "top") {
    log.half = "bottom";
  } else {
    log.half = "top";
    log.currentInning += 1;
    log.actualInnings = Math.max(log.actualInnings, log.currentInning);
  }
};

export const isOurAtBat = (log: NormalizedGameLog) =>
  (log.ourSide === "away" && log.half === "top") ||
  (log.ourSide === "home" && log.half === "bottom");

export const startGame = (log: NormalizedGameLog, ourSide: "home" | "away") =>
  appendEvent(log, { type: "game", description: `Game started (${ourSide})` }, (next) => {
    next.status = "in_progress";
    next.ourSide = ourSide;
    next.currentInning = 1;
    next.actualInnings = 1;
    next.half = "top";
    next.outs = 0;
    next.currentPitchSequence = [];
  });

export const finishGame = (log: NormalizedGameLog) =>
  appendEvent(log, { type: "game", description: "Game marked final" }, (next) => {
    next.status = "final";
    next.actualInnings = Math.max(next.actualInnings, next.currentInning);
  });

export const resumeGame = (log: NormalizedGameLog) =>
  appendEvent(log, { type: "game", description: "Game resumed" }, (next) => {
    next.status = "in_progress";
  });

export const advanceHalfInning = (log: NormalizedGameLog) =>
  appendEvent(log, { type: "inning", description: "Advanced half-inning" }, advanceHalf);

export const recordOut = (
  log: NormalizedGameLog,
  description = "Out recorded",
  playerId?: string,
) => appendEvent(log, {
  type: "opponent",
  description,
  playerId,
  pitchSequence: [...log.currentPitchSequence],
}, (next) => {
  next.currentPitchSequence = [];
  next.outs += 1;
  if (next.outs >= 3) advanceHalf(next);
});

export const correctOuts = (log: NormalizedGameLog, delta: number) =>
  appendEvent(log, {
    type: "inning",
    description: `Outs corrected ${delta > 0 ? "+" : ""}${delta}`,
  }, (next) => {
    next.outs = Math.min(2, Math.max(0, next.outs + delta));
  });

const OUTCOME_LABELS: Record<PlateAppearanceOutcome, string> = {
  single: "single",
  double: "double",
  triple: "triple",
  home_run: "home run",
  walk: "walk",
  hit_by_pitch: "hit by pitch",
  reached_on_error: "reached on error",
  strikeout: "strikeout",
  out: "out",
};

export const parsePlateAppearanceResult = (value: string): { code: string; outcome: PlateAppearanceOutcome } => {
  const code = value.trim().toUpperCase().replace(/\s+/g, "");
  if (["1B", "SINGLE"].includes(code)) return { code: "1B", outcome: "single" };
  if (["2B", "DOUBLE"].includes(code)) return { code: "2B", outcome: "double" };
  if (["3B", "TRIPLE"].includes(code)) return { code: "3B", outcome: "triple" };
  if (["HR", "HOMERUN"].includes(code)) return { code: "HR", outcome: "home_run" };
  if (["BB", "W", "WALK"].includes(code)) return { code: "BB", outcome: "walk" };
  if (["HBP", "HP"].includes(code)) return { code: "HBP", outcome: "hit_by_pitch" };
  if (code === "ROE" || code === "E" || /^E[1-9]$/.test(code)) return { code: code || "E", outcome: "reached_on_error" };
  if (code === "SO" || code.startsWith("K")) return { code: code || "K", outcome: "strikeout" };
  return { code: code || "OUT", outcome: "out" };
};

export interface PlateAppearanceInput {
  batterId: string;
  batterName: string;
  outcome: PlateAppearanceOutcome;
  resultCode?: string;
  runScorerIds: string[];
  runScorerNames?: string[];
  rbi: number;
}

export const recordPlateAppearance = (log: NormalizedGameLog, input: PlateAppearanceInput) =>
  appendEvent(log, {
    type: "plate_appearance",
    description: `${input.batterName}: ${input.resultCode || OUTCOME_LABELS[input.outcome]}${input.runScorerIds.length ? `, ${input.runScorerIds.length} run${input.runScorerIds.length === 1 ? "" : "s"}` : ""}`,
    playerId: input.batterId,
    outcome: input.outcome,
    resultCode: input.resultCode,
    battingSide: "our",
    pitchSequence: [...log.currentPitchSequence],
  }, (next) => {
    const batter = next.playerStats[input.batterId] || emptyPlayerGameStats();
    next.playerStats[input.batterId] = batter;
    batter.played = true;

    if (!["walk", "hit_by_pitch"].includes(input.outcome)) batter.ab += 1;
    if (["single", "double", "triple", "home_run"].includes(input.outcome)) {
      batter.hits = (batter.hits || 0) + 1;
      next.ourHits += 1;
    }
    if (input.outcome === "double") batter.doubles = (batter.doubles || 0) + 1;
    if (input.outcome === "triple") batter.triples = (batter.triples || 0) + 1;
    if (input.outcome === "home_run") batter.homeRuns = (batter.homeRuns || 0) + 1;
    if (input.outcome === "walk") batter.walks = (batter.walks || 0) + 1;
    if (input.outcome === "hit_by_pitch") batter.hitByPitch = (batter.hitByPitch || 0) + 1;
    if (input.outcome === "strikeout") batter.strikeouts = (batter.strikeouts || 0) + 1;
    if (input.outcome === "reached_on_error") next.opponentErrors += 1;
    batter.rbi = (batter.rbi || 0) + Math.max(0, input.rbi);

    input.runScorerIds.forEach((playerId) => {
      const scorer = next.playerStats[playerId] || emptyPlayerGameStats();
      next.playerStats[playerId] = scorer;
      scorer.played = true;
      scorer.runs = (scorer.runs || 0) + 1;
    });
    adjustRuns(next, "our", input.runScorerIds.length);
    next.currentPitchSequence = [];

    if (input.outcome === "strikeout" || input.outcome === "out") {
      next.outs += 1;
      if (next.outs >= 3) advanceHalf(next);
    }
  });

export const addOpponentHitter = (log: NormalizedGameLog, number: string) => {
  const cleanNumber = number.trim().replace(/^#/, "");
  if (!cleanNumber) return log;
  const existing = log.opponentHitters.find((hitter) => hitter.number.toLowerCase() === cleanNumber.toLowerCase());
  if (existing) return { ...log, currentOpponentHitterId: log.currentOpponentHitterId || existing.id };

  const hitter: OpponentHitter = { id: crypto.randomUUID(), number: cleanNumber };
  return appendEvent(log, {
    type: "lineup",
    description: `Added opponent #${cleanNumber}`,
    opponentHitterId: hitter.id,
  }, (next) => {
    next.opponentHitters = [...next.opponentHitters, hitter];
    next.currentOpponentHitterId ||= hitter.id;
  });
};

export const removeOpponentHitter = (log: NormalizedGameLog, hitterId: string) => {
  const hitter = log.opponentHitters.find((item) => item.id === hitterId);
  if (!hitter) return log;
  return appendEvent(log, {
    type: "lineup",
    description: `Removed opponent #${hitter.number}`,
    opponentHitterId: hitter.id,
  }, (next) => {
    const index = next.opponentHitters.findIndex((item) => item.id === hitterId);
    next.opponentHitters = next.opponentHitters.filter((item) => item.id !== hitterId);
    if (next.currentOpponentHitterId === hitterId) {
      next.currentOpponentHitterId = next.opponentHitters[index % Math.max(1, next.opponentHitters.length)]?.id;
    }
  });
};

export const setCurrentOpponentHitter = (log: NormalizedGameLog, hitterId: string) => ({
  ...log,
  currentOpponentHitterId: hitterId,
});

export interface OpponentPlateAppearanceInput {
  hitterId: string;
  hitterNumber: string;
  outcome: PlateAppearanceOutcome;
  resultCode: string;
  pitcherId?: string;
  errorFielderId?: string;
}

export const recordOpponentPlateAppearance = (
  log: NormalizedGameLog,
  input: OpponentPlateAppearanceInput,
) => appendEvent(log, {
  type: "plate_appearance",
  description: `Opponent #${input.hitterNumber}: ${input.resultCode}`,
  outcome: input.outcome,
  resultCode: input.resultCode,
  battingSide: "opponent",
  opponentHitterId: input.hitterId,
  playerId: input.pitcherId,
  pitchSequence: [...log.currentPitchSequence],
}, (next) => {
  if (["single", "double", "triple", "home_run"].includes(input.outcome)) next.opponentHits += 1;
  if (input.outcome === "home_run") adjustRuns(next, "opponent", 1);
  if (input.outcome === "reached_on_error") {
    next.ourErrors += 1;
    if (input.errorFielderId) {
      const fielder = next.playerStats[input.errorFielderId] || emptyPlayerGameStats();
      next.playerStats[input.errorFielderId] = fielder;
      fielder.played = true;
      fielder.errors = (fielder.errors || 0) + 1;
    }
  }

  if (input.pitcherId) {
    const pitcher = next.playerStats[input.pitcherId] || emptyPlayerGameStats();
    next.playerStats[input.pitcherId] = pitcher;
    pitcher.played = true;
    next.currentPitcherId = input.pitcherId;
    if (input.outcome === "strikeout") pitcher.pitchingStrikeouts = (pitcher.pitchingStrikeouts || 0) + 1;
    if (input.outcome === "walk") pitcher.walksAllowed = (pitcher.walksAllowed || 0) + 1;
  }

  next.currentPitchSequence = [];
  if (input.outcome === "strikeout" || input.outcome === "out") {
    next.outs += 1;
    if (next.outs >= 3) advanceHalf(next);
  }

  const currentIndex = next.opponentHitters.findIndex((hitter) => hitter.id === input.hitterId);
  if (next.opponentHitters.length > 0) {
    next.currentOpponentHitterId = next.opponentHitters[(Math.max(0, currentIndex) + 1) % next.opponentHitters.length].id;
  }
});

export const recordPitchCall = (
  log: NormalizedGameLog,
  call: PitchCall,
  pitcherId?: string,
  pitcherName?: string,
) => appendEvent(log, {
  type: "pitch",
  description: `${call === "ball" ? "Ball" : "Strike"}${pitcherName ? ` — ${pitcherName}` : ""}`,
  playerId: pitcherId,
  pitchSequence: [...log.currentPitchSequence, call],
}, (next) => {
  next.currentPitchSequence = [...next.currentPitchSequence, call];
  if (!pitcherId) return;
  const pitcher = next.playerStats[pitcherId] || emptyPlayerGameStats();
  next.playerStats[pitcherId] = pitcher;
  pitcher.played = true;
  pitcher.pitches = (pitcher.pitches || 0) + 1;
  next.currentPitcherId = pitcherId;
});

export const recordPitch = (
  log: NormalizedGameLog,
  pitcherId: string,
  pitcherName: string,
  count: number,
) => appendEvent(log, {
  type: "pitch",
  description: `${pitcherName}: ${count > 0 ? "+" : ""}${count} pitch${Math.abs(count) === 1 ? "" : "es"}`,
  playerId: pitcherId,
}, (next) => {
  const pitcher = next.playerStats[pitcherId] || emptyPlayerGameStats();
  next.playerStats[pitcherId] = pitcher;
  pitcher.played = true;
  pitcher.pitches = Math.max(0, (pitcher.pitches || 0) + count);
  next.currentPitcherId = pitcherId;
});

export const recordPitchingResult = (
  log: NormalizedGameLog,
  pitcherId: string,
  pitcherName: string,
  result: "strikeout" | "walk",
) => appendEvent(log, {
  type: "opponent",
  description: `${pitcherName}: ${result === "strikeout" ? "strikeout" : "walk allowed"}`,
  playerId: pitcherId,
  pitchSequence: [...log.currentPitchSequence],
}, (next) => {
  const pitcher = next.playerStats[pitcherId] || emptyPlayerGameStats();
  next.playerStats[pitcherId] = pitcher;
  pitcher.played = true;
  next.currentPitcherId = pitcherId;
  next.currentPitchSequence = [];
  if (result === "strikeout") {
    pitcher.pitchingStrikeouts = (pitcher.pitchingStrikeouts || 0) + 1;
    next.outs += 1;
    if (next.outs >= 3) advanceHalf(next);
  } else {
    pitcher.walksAllowed = (pitcher.walksAllowed || 0) + 1;
  }
});

export const recordOpponentTotal = (
  log: NormalizedGameLog,
  field: "opponentScore" | "opponentHits",
  delta: number,
) => appendEvent(log, {
  type: "opponent",
  description: `${field === "opponentScore" ? "Opponent run" : "Opponent hit"}${delta < 0 ? " removed" : ""}`,
  pitchSequence: field === "opponentHits" ? [...log.currentPitchSequence] : undefined,
}, (next) => {
  if (field === "opponentScore") adjustRuns(next, "opponent", delta);
  else {
    next.opponentHits = Math.max(0, next.opponentHits + delta);
    if (delta > 0) next.currentPitchSequence = [];
  }
});

export const recordFieldingError = (
  log: NormalizedGameLog,
  playerId: string,
  playerName: string,
) => appendEvent(log, {
  type: "fielding_error",
  description: `Error: ${playerName}`,
  playerId,
  pitchSequence: [...log.currentPitchSequence],
}, (next) => {
  const fielder = next.playerStats[playerId] || emptyPlayerGameStats();
  next.playerStats[playerId] = fielder;
  fielder.played = true;
  fielder.errors = (fielder.errors || 0) + 1;
  next.ourErrors += 1;
  next.currentPitchSequence = [];
});

export const recordSubstitution = (
  log: NormalizedGameLog,
  outgoingId: string,
  incomingId: string,
  outgoingName: string,
  incomingName: string,
  position: string,
) => appendEvent(log, {
  type: "substitution",
  description: `${incomingName} entered for ${outgoingName} at ${position}`,
  playerId: incomingId,
  secondaryPlayerId: outgoingId,
  position,
}, (next) => {
  const incoming = next.playerStats[incomingId] || emptyPlayerGameStats();
  next.playerStats[incomingId] = incoming;
  incoming.played = true;
});

export const correctScore = (
  log: NormalizedGameLog,
  side: "our" | "opponent",
  delta: number,
) => appendEvent(log, {
  type: "score",
  description: `${side === "our" ? "Our" : "Opponent"} score corrected ${delta > 0 ? "+" : ""}${delta}`,
}, (next) => {
  adjustRuns(next, side, delta);
});

export const undoLastEvent = (log: NormalizedGameLog) => {
  const lastEvent = log.events.at(-1);
  if (!lastEvent) return log;
  return restoreSnapshot(lastEvent.before, log.events.slice(0, -1));
};
