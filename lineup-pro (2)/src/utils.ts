import { Player, DefenseAssignments, Settings, ValidationResult, FairnessMetrics, Position, GameLog, SavedGame, SeasonFairnessMetrics } from "./types";
import { POSITION_GROUPS, ALL_POSITIONS } from "./constants";

export const isInfield = (pos: string) => POSITION_GROUPS.INFIELD.includes(pos);
export const isOutfield = (pos: string) => POSITION_GROUPS.OUTFIELD.includes(pos);

const POSITION_ALIASES: Record<Position, string[]> = {
  C: ["c", "catcher"],
  P: ["p", "pitcher"],
  "1B": ["1b", "first base", "1st base"],
  "2B": ["2b", "second base", "2nd base"],
  SS: ["ss", "shortstop", "short"],
  "3B": ["3b", "third base", "3rd base"],
  LF: ["lf", "left field", "leftfield"],
  LCF: ["lcf", "left center", "left center field", "left centerfield"],
  RCF: ["rcf", "right center", "right center field", "right centerfield"],
  RF: ["rf", "right field", "rightfield"],
  DUGOUT: ["dugout", "bench"],
};

const POSITION_LABELS: Record<Position, string> = {
  C: "catcher",
  P: "pitcher",
  "1B": "first base",
  "2B": "second base",
  SS: "shortstop",
  "3B": "third base",
  LF: "left field",
  LCF: "left center field",
  RCF: "right center field",
  RF: "right field",
  DUGOUT: "dugout",
};

const normalizeRuleText = (value: string) =>
  value
    .toLowerCase()
    .replace(/doesn't/g, "doesnt")
    .replace(/can't/g, "cant")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasWholePhrase = (text: string, phrase: string) =>
  new RegExp(`(?:^| )${escapeRegex(phrase)}(?: |$)`).test(text);

const getRestrictedPositionsByPlayer = (players: Player[], settings: Settings): Map<string, Set<Position>> => {
  const restricted = new Map<string, Set<Position>>();
  const customRules = Array.isArray(settings.customRules) ? settings.customRules : [];

  for (const rawRule of customRules) {
    const rule = normalizeRuleText(rawRule);
    if (!rule) continue;

    const isRestrictionRule =
      rule.includes("doesnt play") ||
      rule.includes("does not play") ||
      rule.includes("cant play") ||
      rule.includes("cannot play") ||
      rule.includes("never play") ||
      rule.includes("never plays");

    if (!isRestrictionRule) continue;

    const matchingPlayers = players.filter((player) => {
      const normalizedName = normalizeRuleText(player.name);
      return normalizedName.length > 0 && hasWholePhrase(rule, normalizedName);
    });

    if (matchingPlayers.length === 0) continue;

    const restrictedPositions = (Object.entries(POSITION_ALIASES) as Array<[Position, string[]]>)
      .filter(([, aliases]) => aliases.some((alias) => hasWholePhrase(rule, normalizeRuleText(alias))))
      .map(([position]) => position);

    if (restrictedPositions.length === 0) continue;

    matchingPlayers.forEach((player) => {
      const existing = restricted.get(player.id) || new Set<Position>();
      restrictedPositions.forEach((position) => existing.add(position));
      restricted.set(player.id, existing);
    });
  }

  return restricted;
};

const canPlayerPlayPosition = (
  playerId: string,
  position: Position,
  restrictedPositionsByPlayer: Map<string, Set<Position>>
) => !restrictedPositionsByPlayer.get(playerId)?.has(position);

const parseRuleNumber = (rule: string) => {
  const match = rule.match(/\b(\d+)\b/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return Math.max(1, Math.min(12, Math.floor(value)));
};

const applyCustomRuleText = (settings: Settings): Settings => {
  const next: Settings = {
    ...settings,
    customRules: Array.isArray(settings.customRules) ? settings.customRules : []
  };

  for (const rawRule of next.customRules) {
    const rule = rawRule.toLowerCase();
    const num = parseRuleNumber(rule);

    if (
      rule.includes("no duplicate") ||
      rule.includes("same position twice") ||
      rule.includes("same position 2x")
    ) {
      next.preventDuplicatePositionInGame = true;
    }

    if (
      rule.includes("infield") &&
      (rule.includes("first 3") || rule.includes("inning 3") || rule.includes("by inning 3"))
    ) {
      next.requireEarlyInfieldByInning3 = true;
    }

    if (num && rule.includes("max") && rule.includes("bench")) {
      next.maxConsecutiveBench = num;
    }

    if (num && rule.includes("max") && rule.includes("infield")) {
      next.maxConsecutiveInfield = num;
    }

    if (num && rule.includes("max") && rule.includes("outfield")) {
      next.maxConsecutiveOutfield = num;
    }

    if (rule.includes("no back-to-back") && rule.includes("position")) {
      next.allowSamePositionBackToBack = false;
    }
  }

  return next;
};

export const validateAll = (
  assignments: DefenseAssignments,
  players: Player[],
  settings: Settings
): ValidationResult => {
  const effectiveSettings = applyCustomRuleText(settings);
  const errors: string[] = [];
  const warnings: string[] = [];
  const playerMap = new Map(players.map(p => [p.id, p]));
  const restrictedPositionsByPlayer = getRestrictedPositionsByPlayer(players, settings);

  // 1. Check for duplicates and unassigned positions
  for (let i = 1; i <= assignments.innings; i++) {
    const inning = assignments.byInning[i];
    if (!inning) continue;

    const assignedInInning = new Set<string>();
    
    // Check standard positions
    ALL_POSITIONS.forEach(pos => {
      const pid = inning[pos];
      if (pid) {
        if (assignedInInning.has(pid)) {
          errors.push(`Inning ${i}: ${playerMap.get(pid)?.name || pid} appears multiple times.`);
        }
        if (!canPlayerPlayPosition(pid, pos as Position, restrictedPositionsByPlayer)) {
          errors.push(
            `Inning ${i}: ${playerMap.get(pid)?.name || pid} cannot play ${POSITION_LABELS[pos as Position]} because of a custom rule.`
          );
        }
        assignedInInning.add(pid);
      } else {
        // Warning for unassigned positions
        if (isInfield(pos)) {
          errors.push(`Inning ${i}: ${pos} is unassigned.`);
        } else if (!effectiveSettings.allowEmptyOutfield) {
          errors.push(`Inning ${i}: ${pos} is unassigned.`);
        }
      }
    });

    // Check dugout
    inning.dugout.forEach(pid => {
      if (assignedInInning.has(pid)) {
        errors.push(`Inning ${i}: ${playerMap.get(pid)?.name || pid} appears in dugout and a position.`);
      }
      assignedInInning.add(pid);
    });

    // Check if everyone is assigned
    players.forEach(p => {
      if (!assignedInInning.has(p.id)) {
        errors.push(`Inning ${i}: ${p.name} is not assigned to any position or dugout.`);
      }
    });

    if (effectiveSettings.requireDugout && players.length >= 10 && inning.dugout.length === 0) {
      warnings.push(`Inning ${i}: No players are in the dugout despite roster size.`);
    }

    // 1.5 Check for back-to-back same position
    if (i > 1) {
      const prevInning = assignments.byInning[i - 1];
      if (prevInning) {
        players.forEach(p => {
          let currentPos = "";
          let prevPos = "";
          for (const pos of ALL_POSITIONS) {
            if (inning[pos] === p.id) currentPos = pos;
            if (prevInning[pos] === p.id) prevPos = pos;
          }
          if (currentPos && currentPos === prevPos) {
            if (effectiveSettings.allowSamePositionBackToBack) {
              // No warning if allowed
            } else {
              errors.push(`Inning ${i}: ${p.name} is playing ${currentPos} back-to-back.`);
            }
          }
        });
      }
    }
  }

  // 2. Hard Rule: Max consecutive innings in infield/outfield
  players.forEach(player => {
    let infieldStreak = 0;
    let outfieldStreak = 0;
    for (let i = 1; i <= assignments.innings; i++) {
      const inning = assignments.byInning[i];
      let playedInfield = false;
      let playedOutfield = false;
      
      for (const pos of POSITION_GROUPS.INFIELD) {
        if (inning?.[pos] === player.id) {
          playedInfield = true;
          break;
        }
      }
      for (const pos of POSITION_GROUPS.OUTFIELD) {
        if (inning?.[pos] === player.id) {
          playedOutfield = true;
          break;
        }
      }

      if (playedInfield) {
        infieldStreak++;
        outfieldStreak = 0;
        if (infieldStreak > effectiveSettings.maxConsecutiveInfield) {
          errors.push(`${player.name} plays infield ${infieldStreak} innings in a row (Innings ${i-infieldStreak+1}–${i}).`);
        }
      } else if (playedOutfield) {
        outfieldStreak++;
        infieldStreak = 0;
        if (outfieldStreak > effectiveSettings.maxConsecutiveOutfield) {
          errors.push(`${player.name} plays outfield ${outfieldStreak} innings in a row (Innings ${i-outfieldStreak+1}–${i}).`);
        }
      } else {
        infieldStreak = 0;
        outfieldStreak = 0;
      }
    }
  });

  // 3. Rule: Same position more than once a game
  players.forEach(player => {
    const positionsPlayed = new Map<string, number>();
    for (let i = 1; i <= assignments.innings; i++) {
      const inning = assignments.byInning[i];
      if (!inning) continue;
      for (const pos of ALL_POSITIONS) {
        if (inning[pos] === player.id) {
          positionsPlayed.set(pos, (positionsPlayed.get(pos) || 0) + 1);
        }
      }
    }
    positionsPlayed.forEach((count, pos) => {
      if (count > 1) {
        if (effectiveSettings.preventDuplicatePositionInGame) {
          errors.push(`${player.name} is playing ${pos} ${count} times in this game.`);
        } else {
          warnings.push(`${player.name} is playing ${pos} ${count} times in this game.`);
        }
      }
    });
  });

  // 4. Hard Rule: Max consecutive bench innings
  players.forEach(player => {
    let benchStreak = 0;
    for (let i = 1; i <= assignments.innings; i++) {
      const inning = assignments.byInning[i];
      const onBench = (inning?.dugout || []).includes(player.id);
      if (onBench) {
        benchStreak++;
        if (benchStreak > effectiveSettings.maxConsecutiveBench) {
          errors.push(`${player.name} sits ${benchStreak} innings in a row (Innings ${i-benchStreak+1}–${i}).`);
        }
      } else {
        benchStreak = 0;
      }
    }
  });

  // 5. Hard Rule: Everyone gets infield by inning 3 when mathematically possible.
  if (effectiveSettings.requireEarlyInfieldByInning3) {
    const firstThreeInnings = Math.min(3, assignments.innings);
    const earlyInfieldSlots = firstThreeInnings * POSITION_GROUPS.INFIELD.length;
    if (players.length <= earlyInfieldSlots) {
      players.forEach((player) => {
        let hasEarlyInfield = false;
        for (let i = 1; i <= firstThreeInnings; i++) {
          const inning = assignments.byInning[i];
          if (!inning) continue;
          if (POSITION_GROUPS.INFIELD.some((pos) => inning[pos] === player.id)) {
            hasEarlyInfield = true;
            break;
          }
        }
        if (!hasEarlyInfield) {
          errors.push(`${player.name} has no infield inning in the first ${firstThreeInnings} innings.`);
        }
      });
    }
  }

  return { errors, warnings };
};

export const computeFairness = (
  players: Player[] = [],
  assignments: DefenseAssignments,
  gameLog?: GameLog
): FairnessMetrics => {
  const stats: FairnessMetrics["playerStats"] = {};
  
  // Filter for players who are actually part of this game's calculation
  const relevantPlayers = (players || []).filter(p => {
    if (gameLog) return gameLog.playerStats[p.id]?.played;
    return p.active !== false;
  });

  relevantPlayers.forEach(p => {
    stats[p.id] = {
      infield: 0,
      outfield: 0,
      bench: 0,
      maxStreak: 0,
      positions: {}
    };
  });

  const activeInnings = gameLog ? gameLog.actualInnings : assignments.innings;

  for (let i = 1; i <= activeInnings; i++) {
    const inning = assignments.byInning[i];
    if (!inning) continue;

    relevantPlayers.forEach(p => {
      let found = false;
      for (const pos of ALL_POSITIONS) {
        if (inning[pos] === p.id) {
          if (isInfield(pos)) stats[p.id].infield++;
          else stats[p.id].outfield++;
          stats[p.id].positions[pos] = (stats[p.id].positions[pos] || 0) + 1;
          found = true;
          break;
        }
      }
      if (!found && inning.dugout.includes(p.id)) {
        stats[p.id].bench++;
        stats[p.id].positions["DUGOUT"] = (stats[p.id].positions["DUGOUT"] || 0) + 1;
      }
    });
  }

  // Calculate streaks (only for active innings)
  relevantPlayers.forEach(p => {
    let currentStreak = 0;
    let maxStreak = 0;
    for (let i = 1; i <= activeInnings; i++) {
      const inning = assignments.byInning[i];
      let isInfieldNow = false;
      for (const pos of POSITION_GROUPS.INFIELD) {
        if (inning?.[pos] === p.id) {
          isInfieldNow = true;
          break;
        }
      }
      if (isInfieldNow) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    stats[p.id].maxStreak = maxStreak;
  });

  const infieldCounts = Object.values(stats).map(s => s.infield);
  const avgInfield = infieldCounts.reduce((a, b) => a + b, 0) / (relevantPlayers.length || 1);
  const minInfield = infieldCounts.length > 0 ? Math.min(...infieldCounts) : 0;
  const maxInfield = infieldCounts.length > 0 ? Math.max(...infieldCounts) : 0;
  const stdDevInfield = Math.sqrt(infieldCounts.reduce((sq, n) => sq + Math.pow(n - avgInfield, 2), 0) / (relevantPlayers.length || 1));

  const benchCounts = Object.values(stats).map(s => s.bench);
  const minBench = benchCounts.length > 0 ? Math.min(...benchCounts) : 0;
  const maxBench = benchCounts.length > 0 ? Math.max(...benchCounts) : 0;

  return {
    playerStats: stats,
    teamStats: { avgInfield, minInfield, maxInfield, stdDevInfield, minBench, maxBench }
  };
};

export const computeSeasonFairness = (
  savedGames: SavedGame[] = [],
  masterPlayers: Player[] = []
): SeasonFairnessMetrics => {
  const stats: SeasonFairnessMetrics["playerStats"] = {};
  
  if (!masterPlayers) return { playerStats: {}, teamStats: { avgInfieldPerGame: 0, minInfieldPerGame: 0, maxInfieldPerGame: 0 } };

  masterPlayers.forEach(p => {
    stats[p.id] = {
      totalInfield: 0,
      totalOutfield: 0,
      totalBench: 0,
      gamesPlayed: 0,
      avgInfieldPerGame: 0,
      avgOutfieldPerGame: 0,
      avgBenchPerGame: 0,
      totalAB: 0,
      avgABPerGame: 0
    };
  });

  savedGames.forEach(game => {
    const gameMetrics = computeFairness(game.players, game.assignments, game.log);
    
    Object.entries(gameMetrics.playerStats).forEach(([pid, pStats]) => {
      if (!stats[pid]) {
        // Player might have been added later, ensure they exist in stats
        stats[pid] = {
          totalInfield: 0, totalOutfield: 0, totalBench: 0, gamesPlayed: 0,
          avgInfieldPerGame: 0, avgOutfieldPerGame: 0, avgBenchPerGame: 0,
          totalAB: 0, avgABPerGame: 0
        };
      }
      
      stats[pid].totalInfield += pStats.infield;
      stats[pid].totalOutfield += pStats.outfield;
      stats[pid].totalBench += pStats.bench;
      stats[pid].gamesPlayed += 1;
      
      if (game.log?.playerStats[pid]) {
        stats[pid].totalAB += game.log.playerStats[pid].ab;
      }
    });
  });

  // Calculate averages
  Object.keys(stats).forEach(pid => {
    const s = stats[pid];
    if (s.gamesPlayed > 0) {
      s.avgInfieldPerGame = s.totalInfield / s.gamesPlayed;
      s.avgOutfieldPerGame = s.totalOutfield / s.gamesPlayed;
      s.avgBenchPerGame = s.totalBench / s.gamesPlayed;
      s.avgABPerGame = s.totalAB / s.gamesPlayed;
    }
  });

  const infieldAverages = Object.values(stats).filter(s => s.gamesPlayed > 0).map(s => s.avgInfieldPerGame);
  const avgInfieldPerGame = infieldAverages.length > 0 
    ? infieldAverages.reduce((a, b) => a + b, 0) / infieldAverages.length 
    : 0;
  const minInfieldPerGame = infieldAverages.length > 0 ? Math.min(...infieldAverages) : 0;
  const maxInfieldPerGame = infieldAverages.length > 0 ? Math.max(...infieldAverages) : 0;

  return {
    playerStats: stats,
    teamStats: { avgInfieldPerGame, minInfieldPerGame, maxInfieldPerGame }
  };
};

export const autoGenerateDefense = (
  players: Player[] = [],
  inningsCount: number,
  settings: Settings,
  savedGames: SavedGame[] = []
): DefenseAssignments => {
  const effectiveSettings = applyCustomRuleText(settings);
  const restrictedPositionsByPlayer = getRestrictedPositionsByPlayer(players, settings);
  const createEmptyAssignments = (): DefenseAssignments => {
    const empty: DefenseAssignments = { innings: inningsCount, byInning: {} };
    for (let i = 1; i <= inningsCount; i++) empty.byInning[i] = { dugout: [] };
    return empty;
  };

  if (!players || players.length === 0) return createEmptyAssignments();

  // Gather historical positions from the last 2 games to encourage variety
  const historicalPositions = new Map<string, Set<string>>();
  const recentGames = [...savedGames]
    .sort((a, b) => new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime())
    .slice(0, 2);

  recentGames.forEach(game => {
    Object.values(game.assignments.byInning).forEach(inning => {
      Object.entries(inning).forEach(([pos, pid]) => {
        if (pos !== 'dugout' && typeof pid === 'string') {
          if (!historicalPositions.has(pid)) historicalPositions.set(pid, new Set());
          historicalPositions.get(pid)?.add(pos);
        }
      });
    });
  });

  const firstThreeInnings = Math.min(3, inningsCount);
  const enforceEarlyInfield = effectiveSettings.requireEarlyInfieldByInning3;
  const minimumMissingEarlyInfield = enforceEarlyInfield
    ? Math.max(0, players.length - (firstThreeInnings * POSITION_GROUPS.INFIELD.length))
    : players.length;
  const MAX_ATTEMPTS = 160;
  let bestAssignments = createEmptyAssignments();
  let bestScore = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const assignments = createEmptyAssignments();
    const playerInfieldCounts = new Map(players.map(p => [p.id, 0]));
    const playerBenchCounts = new Map(players.map(p => [p.id, 0]));
    const playerLastInfieldStreak = new Map(players.map(p => [p.id, 0]));
    const playerLastOutfieldStreak = new Map(players.map(p => [p.id, 0]));
    const playerBenchStreak = new Map(players.map(p => [p.id, 0]));
    const playerPositionsPlayed = new Map<string, Set<string>>(players.map(p => [p.id, new Set<string>()]));
    const playerLastPosition = new Map<string, string>();
    const playerEarlyInfield = new Map(players.map(p => [p.id, false]));

    for (let i = 1; i <= inningsCount; i++) {
      const inning = assignments.byInning[i];
      const assignedThisInning = new Set<string>();
      const maxFieldSlots = Math.min(players.length, ALL_POSITIONS.length);
      const outfieldSlots = Math.max(0, Math.min(POSITION_GROUPS.OUTFIELD.length, maxFieldSlots - POSITION_GROUPS.INFIELD.length));
      const positionsThisInning = [
        ...POSITION_GROUPS.INFIELD,
        ...POSITION_GROUPS.OUTFIELD.slice(0, outfieldSlots)
      ];

      const orderedPlayers = [...players].sort((a, b) => {
        const benchStreakA = playerBenchStreak.get(a.id) || 0;
        const benchStreakB = playerBenchStreak.get(b.id) || 0;
        if (benchStreakA !== benchStreakB) return benchStreakB - benchStreakA;

        const benchA = playerBenchCounts.get(a.id) || 0;
        const benchB = playerBenchCounts.get(b.id) || 0;
        if (benchA !== benchB) return benchB - benchA;

        const infieldA = playerInfieldCounts.get(a.id) || 0;
        const infieldB = playerInfieldCounts.get(b.id) || 0;
        if (infieldA !== infieldB) return infieldA - infieldB;

        return Math.random() - 0.5;
      });

      const chooseCandidates = (pos: string): Player[] => {
        const isPosInfield = isInfield(pos);
        const isPosOutfield = isOutfield(pos);
        const hardCandidates = orderedPlayers.filter((p) => {
          if (assignedThisInning.has(p.id)) return false;
          if (!canPlayerPlayPosition(p.id, pos as Position, restrictedPositionsByPlayer)) return false;
          if (isPosInfield && (playerLastInfieldStreak.get(p.id) || 0) >= effectiveSettings.maxConsecutiveInfield) return false;
          if (isPosOutfield && (playerLastOutfieldStreak.get(p.id) || 0) >= effectiveSettings.maxConsecutiveOutfield) return false;
          if (!effectiveSettings.allowSamePositionBackToBack && playerLastPosition.get(p.id) === pos) return false;
          // Never allow the same exact position twice in a game.
          if (playerPositionsPlayed.get(p.id)?.has(pos)) return false;
          return true;
        });

        const scored = hardCandidates.map((p) => {
          let score = 0;
          const alreadyPlayedPos = playerPositionsPlayed.get(p.id)?.has(pos) ? 1 : 0;
          const inHistory = historicalPositions.get(p.id)?.has(pos) ? 1 : 0;
          const benchCount = playerBenchCounts.get(p.id) || 0;
          const benchStreak = playerBenchStreak.get(p.id) || 0;
          const infieldCount = playerInfieldCounts.get(p.id) || 0;
          const needsEarlyInfield = enforceEarlyInfield && i <= 3 && !playerEarlyInfield.get(p.id);

          if (isPosInfield && needsEarlyInfield) score -= 1000;
          if (!isPosInfield && needsEarlyInfield) score += 300;
          if (benchStreak >= effectiveSettings.maxConsecutiveBench) score -= 1200;
          score += alreadyPlayedPos * 35;
          score += inHistory * 20;
          score += infieldCount * 4;
          score -= benchCount * 6;
          score += Math.random() * 5;
          return { p, score };
        });

        return scored.sort((a, b) => a.score - b.score).map((x) => x.p);
      };

      const assignPosition = (idx: number): boolean => {
        if (idx >= positionsThisInning.length) return true;
        const pos = positionsThisInning[idx];
        const isRequired = isInfield(pos) || !effectiveSettings.allowEmptyOutfield;
        const candidates = chooseCandidates(pos);

        for (const candidate of candidates) {
          inning[pos] = candidate.id;
          assignedThisInning.add(candidate.id);
          if (assignPosition(idx + 1)) return true;
          delete inning[pos];
          assignedThisInning.delete(candidate.id);
        }

        if (!isRequired) {
          return assignPosition(idx + 1);
        }

        return false;
      };

      assignPosition(0);

      orderedPlayers.forEach((p) => {
        if (!assignedThisInning.has(p.id)) {
          inning.dugout.push(p.id);
          playerBenchCounts.set(p.id, (playerBenchCounts.get(p.id) || 0) + 1);
          playerLastPosition.set(p.id, "DUGOUT");
        }
      });

      players.forEach((p) => {
        let playedPosition: string | null = null;
        let playedInfield = false;
        let playedOutfield = false;
        for (const pos of ALL_POSITIONS) {
          if (inning[pos] === p.id) {
            playedPosition = pos;
            break;
          }
        }

        if (playedPosition && isInfield(playedPosition)) {
          playedInfield = true;
          if (i <= 3) playerEarlyInfield.set(p.id, true);
        }
        if (playedPosition && isOutfield(playedPosition)) {
          playedOutfield = true;
        }

        if (playedInfield) {
          playerLastInfieldStreak.set(p.id, (playerLastInfieldStreak.get(p.id) || 0) + 1);
          playerLastOutfieldStreak.set(p.id, 0);
          playerBenchStreak.set(p.id, 0);
        } else if (playedOutfield) {
          playerLastOutfieldStreak.set(p.id, (playerLastOutfieldStreak.get(p.id) || 0) + 1);
          playerLastInfieldStreak.set(p.id, 0);
          playerBenchStreak.set(p.id, 0);
        } else {
          playerLastInfieldStreak.set(p.id, 0);
          playerLastOutfieldStreak.set(p.id, 0);
          playerBenchStreak.set(p.id, (playerBenchStreak.get(p.id) || 0) + 1);
        }

        if (playedPosition) {
          playerLastPosition.set(p.id, playedPosition);
          playerPositionsPlayed.get(p.id)?.add(playedPosition);
        } else if ((inning.dugout || []).includes(p.id)) {
          playerLastPosition.set(p.id, "DUGOUT");
        }
      });
    }

    const validation = validateAll(assignments, players, settings);
    const dugoutWarnings = validation.warnings.filter((w) => w.includes("No players are in the dugout")).length;
    const nonDugoutWarnings = validation.warnings.length - dugoutWarnings;
    const missingEarlyInfield = players.filter((p) => !playerEarlyInfield.get(p.id)).length;
    const earlyInfieldPenalty = enforceEarlyInfield ? missingEarlyInfield * 25 : 0;
    const score = validation.errors.length * 10000 + earlyInfieldPenalty + nonDugoutWarnings * 50 + dugoutWarnings;

    if (score < bestScore) {
      bestScore = score;
      bestAssignments = assignments;
    }

    if (
      validation.errors.length === 0 &&
      nonDugoutWarnings === 0 &&
      missingEarlyInfield <= minimumMissingEarlyInfield
    ) {
      return assignments;
    }
  }

  return bestAssignments;
};

export const autoFixViolations = (
  assignments: DefenseAssignments,
  players: Player[],
  settings: Settings
): DefenseAssignments => {
  const next = JSON.parse(JSON.stringify(assignments)) as DefenseAssignments;
  const activePlayers = players.filter(p => p.active !== false);
  const activePlayerIds = new Set(activePlayers.map(p => p.id));
  const restrictedPositionsByPlayer = getRestrictedPositionsByPlayer(activePlayers, settings);

  // 1. Remove absent players from positions and move to dugout (or just remove if dugout is full/not needed)
  for (let i = 1; i <= next.innings; i++) {
    const inning = next.byInning[i];
    if (!inning) continue;

    // Clean up positions: if player is not active, remove them
    ALL_POSITIONS.forEach(pos => {
      const pid = inning[pos];
      if (pid && !activePlayerIds.has(pid)) {
        delete inning[pos];
      }
    });

    // Clean up dugout: remove inactive players
    inning.dugout = (inning.dugout || []).filter(pid => activePlayerIds.has(pid));

    // 2. Fill holes from dugout
    const requiredPositions = [...POSITION_GROUPS.INFIELD, ...POSITION_GROUPS.OUTFIELD];
    requiredPositions.forEach(pos => {
      if (!inning[pos]) {
        const swapPid = inning.dugout.find((playerId) =>
          canPlayerPlayPosition(playerId, pos as Position, restrictedPositionsByPlayer)
        );
        if (swapPid) {
          inning[pos] = swapPid;
          inning.dugout = inning.dugout.filter((playerId) => playerId !== swapPid);
        }
      }
    });

    // 3. If still have holes and people are missing from this inning entirely, add them to dugout
    const assignedInInning = new Set<string>();
    ALL_POSITIONS.forEach(pos => { if (inning[pos]) assignedInInning.add(inning[pos]); });
    inning.dugout.forEach(pid => assignedInInning.add(pid));

    activePlayers.forEach(p => {
      if (!assignedInInning.has(p.id)) {
        inning.dugout.push(p.id);
      }
    });
  }

  // 4. Fix infield streaks (existing logic)
  players.forEach(player => {
    let streak = 0;
    for (let i = 1; i <= next.innings; i++) {
      const inning = next.byInning[i];
      let posInfield: string | null = null;
      for (const pos of POSITION_GROUPS.INFIELD) {
        if (inning[pos] === player.id) {
          posInfield = pos;
          break;
        }
      }

      if (posInfield) {
        streak++;
        if (streak > settings.maxConsecutiveInfield) {
          // Violation at inning i. Swap this player with someone in the dugout or outfield
          const dugout = inning.dugout;
          const swapPid = dugout.find((candidateId) =>
            canPlayerPlayPosition(candidateId, posInfield as Position, restrictedPositionsByPlayer)
          );
          if (swapPid) {
            inning[posInfield] = swapPid;
            inning.dugout = [player.id, ...dugout.filter((candidateId) => candidateId !== swapPid)];
          } else {
            // Try outfield
            for (const outPos of POSITION_GROUPS.OUTFIELD) {
              const outPid = inning[outPos];
              if (
                outPid &&
                canPlayerPlayPosition(outPid, posInfield as Position, restrictedPositionsByPlayer) &&
                canPlayerPlayPosition(player.id, outPos as Position, restrictedPositionsByPlayer)
              ) {
                inning[posInfield] = outPid;
                inning[outPos] = player.id;
                break;
              }
            }
          }
          streak = 0; // Reset after fix
        }
      } else {
        streak = 0;
      }
    }
  });

  // 5. Fix outfield streaks
  players.forEach(player => {
    let streak = 0;
    for (let i = 1; i <= next.innings; i++) {
      const inning = next.byInning[i];
      let posOutfield: string | null = null;
      for (const pos of POSITION_GROUPS.OUTFIELD) {
        if (inning[pos] === player.id) {
          posOutfield = pos;
          break;
        }
      }

      if (posOutfield) {
        streak++;
        if (streak > settings.maxConsecutiveOutfield) {
          // Violation at inning i. Swap this player with someone in the dugout or infield
          const dugout = inning.dugout;
          const swapPid = dugout.find((candidateId) =>
            canPlayerPlayPosition(candidateId, posOutfield as Position, restrictedPositionsByPlayer)
          );
          if (swapPid) {
            inning[posOutfield] = swapPid;
            inning.dugout = [player.id, ...dugout.filter((candidateId) => candidateId !== swapPid)];
          } else {
            // Try infield
            for (const inPos of POSITION_GROUPS.INFIELD) {
              const inPid = inning[inPos];
              if (
                inPid &&
                canPlayerPlayPosition(inPid, posOutfield as Position, restrictedPositionsByPlayer) &&
                canPlayerPlayPosition(player.id, inPos as Position, restrictedPositionsByPlayer)
              ) {
                inning[posOutfield] = inPid;
                inning[inPos] = player.id;
                break;
              }
            }
          }
          streak = 0; // Reset after fix
        }
      } else {
        streak = 0;
      }
    }
  });

  // 6. Fix duplicate positions
  players.forEach(player => {
    const seenPositions = new Set<string>();
    for (let i = 1; i <= next.innings; i++) {
      const inning = next.byInning[i];
      let currentPos: string | null = null;
      for (const pos of ALL_POSITIONS) {
        if (inning[pos] === player.id) {
          currentPos = pos;
          break;
        }
      }

      if (currentPos) {
        if (seenPositions.has(currentPos)) {
          // Duplicate! Swap with someone in the dugout
          const dugout = inning.dugout;
          const swapPid = dugout.find((candidateId) =>
            canPlayerPlayPosition(candidateId, currentPos as Position, restrictedPositionsByPlayer)
          );
          if (swapPid) {
            inning[currentPos] = swapPid;
            inning.dugout = [player.id, ...dugout.filter((candidateId) => candidateId !== swapPid)];
          }
        } else {
          seenPositions.add(currentPos);
        }
      }
    }
  });

  return next;
};

export const suggestSwapsForFairness = (
  players: Player[],
  assignments: DefenseAssignments,
  gameLog?: GameLog
): string[] => {
  const metrics = computeFairness(players, assignments, gameLog);
  const suggestions: string[] = [];
  
  const stats = Object.entries(metrics.playerStats).map(([id, s]) => ({ id, ...s }));
  const sortedByInfield = [...stats].sort((a, b) => a.infield - b.infield);
  
  const leastInfield = sortedByInfield.slice(0, 2);
  const mostInfield = sortedByInfield.slice(-2).reverse();

  if (mostInfield[0].infield - leastInfield[0].infield > 1) {
    const playerMost = players.find(p => p.id === mostInfield[0].id);
    const playerLeast = players.find(p => p.id === leastInfield[0].id);
    if (playerMost && playerLeast) {
      suggestions.push(`Swap ${playerMost.name} with ${playerLeast.name} in one inning where ${playerMost.name} is Infield.`);
    }
  }

  const sortedByBench = [...stats].sort((a, b) => a.bench - b.bench);
  const leastBench = sortedByBench[0];
  const mostBench = sortedByBench[sortedByBench.length - 1];

  if (mostBench.bench - leastBench.bench > 1) {
    const playerMost = players.find(p => p.id === mostBench.id);
    const playerLeast = players.find(p => p.id === leastBench.id);
    if (playerMost && playerLeast) {
      suggestions.push(`Swap ${playerMost.name} with ${playerLeast.name} in one inning where ${playerLeast.name} is on the bench.`);
    }
  }

  return suggestions;
};
