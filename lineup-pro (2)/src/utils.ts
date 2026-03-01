import { Player, DefenseAssignments, Settings, ValidationResult, FairnessMetrics, Position, GameLog, SavedGame, SeasonFairnessMetrics } from "./types";
import { POSITION_GROUPS, ALL_POSITIONS } from "./constants";

export const isInfield = (pos: string) => POSITION_GROUPS.INFIELD.includes(pos);
export const isOutfield = (pos: string) => POSITION_GROUPS.OUTFIELD.includes(pos);

export const validateAll = (
  assignments: DefenseAssignments,
  players: Player[],
  settings: Settings
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const playerMap = new Map(players.map(p => [p.id, p]));

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
        assignedInInning.add(pid);
      } else {
        // Warning for unassigned positions
        if (isInfield(pos)) {
          errors.push(`Inning ${i}: ${pos} is unassigned.`);
        } else if (!settings.allowEmptyOutfield) {
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

    if (settings.requireDugout && players.length >= 10 && inning.dugout.length === 0) {
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
            if (settings.allowSamePositionBackToBack) {
              // No warning if allowed
            } else {
              warnings.push(`Inning ${i}: ${p.name} is playing ${currentPos} back-to-back.`);
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
        if (infieldStreak > settings.maxConsecutiveInfield) {
          errors.push(`${player.name} plays infield ${infieldStreak} innings in a row (Innings ${i-infieldStreak+1}–${i}).`);
        }
      } else if (playedOutfield) {
        outfieldStreak++;
        infieldStreak = 0;
        if (outfieldStreak > settings.maxConsecutiveOutfield) {
          warnings.push(`${player.name} plays outfield ${outfieldStreak} innings in a row (Innings ${i-outfieldStreak+1}–${i}).`);
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
        warnings.push(`${player.name} is playing ${pos} ${count} times in this game.`);
      }
    });
  });

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
  const assignments: DefenseAssignments = {
    innings: inningsCount,
    byInning: {}
  };

  // Initialize empty
  for (let i = 1; i <= inningsCount; i++) {
    assignments.byInning[i] = { dugout: [] };
  }

  if (!players || players.length === 0) return assignments;

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

  // Simple greedy algorithm with fairness and rule enforcement
  const playerInfieldCounts = new Map(players.map(p => [p.id, 0]));
  const playerBenchCounts = new Map(players.map(p => [p.id, 0]));
  const playerLastInfieldStreak = new Map(players.map(p => [p.id, 0]));
  const playerLastOutfieldStreak = new Map(players.map(p => [p.id, 0]));
  const playerPositionsPlayed = new Map<string, Set<string>>(players.map(p => [p.id, new Set<string>()]));
  const playerLastPosition = new Map<string, string>(); // playerId -> last position name

  for (let i = 1; i <= inningsCount; i++) {
    const availablePlayers = [...players].sort((a, b) => {
      // 1. Prioritize players who have been on the bench MORE (must play)
      const benchA = playerBenchCounts.get(a.id) || 0;
      const benchB = playerBenchCounts.get(b.id) || 0;
      if (benchA !== benchB) return benchB - benchA;

      // 2. Prioritize players with fewer infield innings
      const countA = playerInfieldCounts.get(a.id) || 0;
      const countB = playerInfieldCounts.get(b.id) || 0;
      if (countA !== countB) return countA - countB;

      return Math.random() - 0.5; // Randomize for variety
    });

    const inning = assignments.byInning[i];
    const assignedThisInning = new Set<string>();

    // 1. Fill Infield
    for (const pos of POSITION_GROUPS.INFIELD) {
      // Try to find a candidate who hasn't played this position in THIS game AND hasn't played it RECENTLY
      let candidate = availablePlayers.find(p => 
        !assignedThisInning.has(p.id) && 
        (playerLastInfieldStreak.get(p.id) || 0) < settings.maxConsecutiveInfield &&
        !playerPositionsPlayed.get(p.id)?.has(pos) &&
        !historicalPositions.get(p.id)?.has(pos)
      );

      // Fallback: ignore historical positions if no one fits
      if (!candidate) {
        candidate = availablePlayers.find(p => 
          !assignedThisInning.has(p.id) && 
          (playerLastInfieldStreak.get(p.id) || 0) < settings.maxConsecutiveInfield &&
          !playerPositionsPlayed.get(p.id)?.has(pos)
        );
      }

      if (candidate) {
        inning[pos] = candidate.id;
        assignedThisInning.add(candidate.id);
        playerInfieldCounts.set(candidate.id, (playerInfieldCounts.get(candidate.id) || 0) + 1);
        playerLastPosition.set(candidate.id, pos);
        playerPositionsPlayed.get(candidate.id)?.add(pos);
      }
    }

    // 2. Fill Outfield
    for (const pos of POSITION_GROUPS.OUTFIELD) {
      let candidate = availablePlayers.find(p => 
        !assignedThisInning.has(p.id) &&
        (playerLastOutfieldStreak.get(p.id) || 0) < settings.maxConsecutiveOutfield &&
        !playerPositionsPlayed.get(p.id)?.has(pos) &&
        !historicalPositions.get(p.id)?.has(pos)
      );

      if (!candidate) {
        candidate = availablePlayers.find(p => 
          !assignedThisInning.has(p.id) &&
          (playerLastOutfieldStreak.get(p.id) || 0) < settings.maxConsecutiveOutfield && // Limit outfield streak
          !playerPositionsPlayed.get(p.id)?.has(pos)
        );
      }

      if (candidate) {
        inning[pos] = candidate.id;
        assignedThisInning.add(candidate.id);
        playerLastPosition.set(candidate.id, pos);
        playerPositionsPlayed.get(candidate.id)?.add(pos);
      } else {
        // Fallback if everyone is on a streak or already played this position
        const fallback = availablePlayers.find(p => !assignedThisInning.has(p.id));
        if (fallback) {
          inning[pos] = fallback.id;
          assignedThisInning.add(fallback.id);
          playerLastPosition.set(fallback.id, pos);
          playerPositionsPlayed.get(fallback.id)?.add(pos);
        }
      }
    }

    // 3. Fill Dugout
    availablePlayers.forEach(p => {
      if (!assignedThisInning.has(p.id)) {
        inning.dugout.push(p.id);
        playerBenchCounts.set(p.id, (playerBenchCounts.get(p.id) || 0) + 1);
        playerLastPosition.set(p.id, "DUGOUT");
      }
    });

    // Update streaks for next inning
    players.forEach(p => {
      let playedInfield = false;
      let playedOutfield = false;
      for (const pos of POSITION_GROUPS.INFIELD) {
        if (inning[pos] === p.id) {
          playedInfield = true;
          break;
        }
      }
      for (const pos of POSITION_GROUPS.OUTFIELD) {
        if (inning[pos] === p.id) {
          playedOutfield = true;
          break;
        }
      }

      if (playedInfield) {
        playerLastInfieldStreak.set(p.id, (playerLastInfieldStreak.get(p.id) || 0) + 1);
        playerLastOutfieldStreak.set(p.id, 0);
      } else if (playedOutfield) {
        playerLastOutfieldStreak.set(p.id, (playerLastOutfieldStreak.get(p.id) || 0) + 1);
        playerLastInfieldStreak.set(p.id, 0);
      } else {
        playerLastInfieldStreak.set(p.id, 0);
        playerLastOutfieldStreak.set(p.id, 0);
      }
    });
  }

  return assignments;
};

export const autoFixViolations = (
  assignments: DefenseAssignments,
  players: Player[],
  settings: Settings
): DefenseAssignments => {
  const next = JSON.parse(JSON.stringify(assignments)) as DefenseAssignments;
  const activePlayers = players.filter(p => p.active !== false);
  const activePlayerIds = new Set(activePlayers.map(p => p.id));

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
        if (inning.dugout.length > 0) {
          // Simple fill: take first from dugout
          const swapPid = inning.dugout[0];
          inning[pos] = swapPid;
          inning.dugout = inning.dugout.slice(1);
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
          if (dugout.length > 0) {
            const swapPid = dugout[0];
            inning[posInfield] = swapPid;
            inning.dugout = [player.id, ...dugout.slice(1)];
          } else {
            // Try outfield
            for (const outPos of POSITION_GROUPS.OUTFIELD) {
              const outPid = inning[outPos];
              if (outPid) {
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
          if (dugout.length > 0) {
            const swapPid = dugout[0];
            inning[posOutfield] = swapPid;
            inning.dugout = [player.id, ...dugout.slice(1)];
          } else {
            // Try infield
            for (const inPos of POSITION_GROUPS.INFIELD) {
              const inPid = inning[inPos];
              if (inPid) {
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
          if (dugout.length > 0) {
            const swapPid = dugout[0];
            inning[currentPos] = swapPid;
            inning.dugout = [player.id, ...dugout.slice(1)];
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
