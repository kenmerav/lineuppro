import React, { useState, useMemo } from 'react';
import { Shield, AlertCircle, CheckCircle2, RefreshCw, Trash2, ChevronLeft, ChevronRight, UserPlus, LayoutGrid, Map as MapIcon, Save } from 'lucide-react';
import { Player, DefenseAssignments, InningAssignments, Settings } from '../types';
import { BATTING_ONLY_POSITIONS, getAllPositions, getPositionGroups } from '../constants';
import { validateAll, autoFixViolations } from '../utils';
import { cn, getContrastColor } from '../lib/utils';
import { DefensiveFieldDiagram } from './DefensiveFieldDiagram';

interface DefenseTabProps {
  players: Player[];
  assignments: DefenseAssignments;
  settings: Settings;
  onUpdate: (assignments: DefenseAssignments) => void;
  onInningsCountChange: (inningsCount: number) => void;
  onGenerate: () => void;
  onSaveAsGame: () => Promise<void>;
  selectedInning: number;
  onSelectedInningChange: (inning: number) => void;
}

export const getDefensePickerPlayers = (
  players: Player[],
  inning: InningAssignments | undefined,
  allPositions: string[],
) => players.filter((player) =>
  !allPositions.some((position) => inning?.[position] === player.id)
);

export const assignPlayerToDefense = (
  assignments: DefenseAssignments,
  allPositions: string[],
  inningNum: number,
  pos: string,
  playerId: string | null,
  strictSwap: boolean,
  mirrorAcrossInnings: boolean,
): DefenseAssignments => {
  const sourceInning = assignments.byInning[inningNum];
  const inning = {
    ...(sourceInning || {}),
    dugout: [...(sourceInning?.dugout || [])],
  };
  const nextAssignments: DefenseAssignments = {
    ...assignments,
    byInning: { ...assignments.byInning },
  };

  const currentPlayerAtPos = inning[pos];

  if (playerId === null) {
    if (pos !== 'dugout') delete inning[pos];
  } else {
    let oldPosOfNewPlayer: string | null = null;
    for (const position of allPositions) {
      if (inning[position] === playerId) {
        oldPosOfNewPlayer = position;
        break;
      }
    }
    const wasInDugout = inning.dugout.includes(playerId);

    if (pos === 'dugout') {
      if (oldPosOfNewPlayer) delete inning[oldPosOfNewPlayer];
      if (!wasInDugout) inning.dugout.push(playerId);
    } else {
      if (oldPosOfNewPlayer) {
        if (currentPlayerAtPos && strictSwap) {
          inning[oldPosOfNewPlayer] = currentPlayerAtPos;
        } else {
          delete inning[oldPosOfNewPlayer];
          if (currentPlayerAtPos && !inning.dugout.includes(currentPlayerAtPos)) {
            inning.dugout.push(currentPlayerAtPos);
          }
        }
      } else if (wasInDugout) {
        inning.dugout = inning.dugout.filter(id => id !== playerId);
        if (currentPlayerAtPos) inning.dugout.push(currentPlayerAtPos);
      } else if (currentPlayerAtPos) {
        inning.dugout.push(currentPlayerAtPos);
      }
      inning[pos] = playerId;
    }
  }

  if (mirrorAcrossInnings) {
    for (let gameInning = 1; gameInning <= assignments.innings; gameInning++) {
      nextAssignments.byInning[gameInning] = { ...inning, dugout: [...inning.dugout] };
    }
  } else {
    nextAssignments.byInning[inningNum] = inning;
  }

  return nextAssignments;
};

export const DefenseTab: React.FC<DefenseTabProps> = ({
  players,
  assignments,
  settings,
  onUpdate,
  onInningsCountChange,
  onGenerate,
  onSaveAsGame,
  selectedInning,
  onSelectedInningChange
}) => {
  const [selectedCell, setSelectedCell] = useState<{ inning: number; pos: string } | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'field'>('table');
  const validation = useMemo(() => validateAll(assignments, players, settings), [assignments, players, settings]);
  const positionGroups = useMemo(() => getPositionGroups(settings), [settings]);
  const allPositions = useMemo(() => getAllPositions(settings), [settings]);
  const usesFixedLineup = settings.sport === 'baseball';
  const lineupPositions = useMemo(
    () => usesFixedLineup ? [...allPositions, ...BATTING_ONLY_POSITIONS] : allPositions,
    [allPositions, usesFixedLineup],
  );
  const openPositionCount = usesFixedLineup
    ? allPositions.filter((position) => !assignments.byInning[1]?.[position]).length
    : 0;
  const displayedInnings = usesFixedLineup
    ? [1]
    : Array.from({ length: assignments.innings }, (_, index) => index + 1);

  const handleInningsInputChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return;
    onInningsCountChange(parsed);
  };

  const handleAssign = (playerId: string | null) => {
    if (!selectedCell) return;
    const { inning: inningNum, pos } = selectedCell;
    onUpdate(assignPlayerToDefense(
      assignments,
      lineupPositions,
      inningNum,
      pos,
      playerId,
      settings.strictSwap,
      usesFixedLineup,
    ));
    setSelectedCell(null);
  };

  const playerMap = new Map<string, Player>(players.map(p => [p.id, p]));

  return (
    <div className="p-6 space-y-6 overflow-x-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Shield className="text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-800">{usesFixedLineup ? 'Defensive Lineup' : 'Defensive Rotation'}</h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold",
            usesFixedLineup && openPositionCount > 0 ? "bg-amber-100 text-amber-700" :
            validation.errors.length > 0 ? "bg-red-100 text-red-700" :
            validation.warnings.length > 0 ? "bg-amber-100 text-amber-700" : 
            "bg-green-100 text-green-700"
          )}>
            {usesFixedLineup
              ? openPositionCount > 0 ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />
              : validation.errors.length > 0 ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            {usesFixedLineup
              ? openPositionCount > 0
                ? `${openPositionCount} Open ${openPositionCount === 1 ? 'Position' : 'Positions'}`
                : 'Lineup Ready'
              : validation.errors.length > 0
                ? `${validation.errors.length} Violations`
                : validation.warnings.length > 0
                  ? `${validation.warnings.length} Warnings`
                  : 'Valid Rotation'}
          </div>
          
          <button 
            onClick={onGenerate}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            <RefreshCw size={18} /> {usesFixedLineup ? 'Set Starting Lineup' : 'Auto Generate'}
          </button>

          <button
            onClick={() => void onSaveAsGame()}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
          >
            <Save size={18} /> Save As Game
          </button>

          <button 
            onClick={() => onUpdate(autoFixViolations(assignments, players, settings))}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
          >
            <CheckCircle2 size={18} /> Auto Fix
          </button>
          
          <button 
            onClick={() => onUpdate({ ...assignments, byInning: Object.fromEntries(Array.from({length: assignments.innings}, (_, i) => [i+1, {dugout: []}])) })}
            className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
          >
            <Trash2 size={18} /> Reset
          </button>
        </div>
      </div>

      {/* Validation Panel */}
      {!usesFixedLineup && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2">
          {validation.errors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-red-600 text-sm font-medium">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{err}</span>
            </div>
          ))}
          {validation.warnings.map((warn, i) => (
            <div key={i} className="flex items-start gap-2 text-amber-600 text-sm font-medium">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              "px-3 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors",
              viewMode === 'table' ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <LayoutGrid size={16} />
            Table View
          </button>
          <button
            onClick={() => setViewMode('field')}
            className={cn(
              "px-3 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors",
              viewMode === 'field' ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <MapIcon size={16} />
            Field View
          </button>
        </div>

        {!usesFixedLineup && <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1.5">
            <span className="px-2 text-xs font-bold uppercase tracking-wider text-slate-400">Planned innings</span>
            <button
              type="button"
              onClick={() => onInningsCountChange(Math.max(1, assignments.innings - 1))}
              className="h-9 w-9 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center"
              title="Decrease innings"
            >
              -
            </button>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={assignments.innings}
              onChange={(e) => handleInningsInputChange(e.target.value)}
              className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-center text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              aria-label="Planned innings"
            />
            <button
              type="button"
              onClick={() => onInningsCountChange(assignments.innings + 1)}
              className="h-9 w-9 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center"
              title="Increase innings"
            >
              +
            </button>
          </div>

          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1">
            <button
              onClick={() => onSelectedInningChange(Math.max(1, selectedInning - 1))}
              className="h-9 w-9 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center"
              title="Previous inning"
            >
              <ChevronLeft size={18} />
            </button>
            <select
              value={selectedInning}
              onChange={(e) => onSelectedInningChange(Number(e.target.value))}
              className="h-9 bg-transparent text-sm font-semibold text-slate-700 px-2 outline-none"
            >
              {Array.from({ length: assignments.innings }, (_, i) => i + 1).map((inning) => (
                <option key={inning} value={inning}>
                  Inning {inning}
                </option>
              ))}
            </select>
            <button
              onClick={() => onSelectedInningChange(Math.min(assignments.innings, selectedInning + 1))}
              className="h-9 w-9 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center"
              title="Next inning"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>}
      </div>

      {viewMode === 'field' ? (
        <DefensiveFieldDiagram
          assignments={assignments}
          players={players}
          settings={settings}
          inning={usesFixedLineup ? 1 : selectedInning}
          title={usesFixedLineup ? 'Starting Defense' : `Field View - Inning ${selectedInning}`}
        />
      ) : (
        <div className={usesFixedLineup ? "mx-auto max-w-2xl" : "min-w-[800px]"}>
          <table className="w-full border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-24 p-2 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Position</th>
                {displayedInnings.map((inning) => (
                  <th key={inning} className="p-2 text-center text-sm font-bold text-slate-700 bg-slate-100 rounded-lg">
                    {usesFixedLineup ? 'Player' : `Inning ${inning}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={displayedInnings.length + 1} className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Infield</td>
              </tr>
              {positionGroups.INFIELD.map(pos => (
                <tr key={pos}>
                  <td className="p-2 font-bold text-slate-600 text-sm">{pos}</td>
                  {displayedInnings.map((inningNum) => {
                    const playerId = assignments.byInning[inningNum]?.[pos];
                    const player = playerId ? playerMap.get(playerId) : null;
                    const isAbsent = player?.active === false;
                    return (
                      <td key={inningNum} className="p-0">
                        <button
                          onClick={() => setSelectedCell({ inning: inningNum, pos })}
                          className={cn(
                            "w-full h-12 rounded-lg border-2 transition-all flex items-center justify-center font-bold text-sm relative",
                            player ? "border-transparent" : "border-dashed border-slate-200 text-slate-300 hover:border-slate-300",
                            selectedCell?.inning === inningNum && selectedCell?.pos === pos ? "ring-2 ring-indigo-500 ring-offset-2" : "",
                            isAbsent ? "opacity-40 grayscale" : ""
                          )}
                          style={player ? { backgroundColor: player.color, color: getContrastColor(player.color) } : {}}
                        >
                          {player ? (
                            <span className="flex flex-col items-center leading-tight">
                              <span>{player.name}</span>
                              {player.grade && <span className="text-[9px] opacity-80">{player.grade}th</span>}
                            </span>
                          ) : "+"}
                          {isAbsent && (
                            <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm" title="Player is Absent">
                              <X size={10} strokeWidth={4} />
                            </div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr>
                <td colSpan={displayedInnings.length + 1} className="py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Outfield</td>
              </tr>
              {positionGroups.OUTFIELD.map(pos => (
                <tr key={pos}>
                  <td className="p-2 font-bold text-slate-600 text-sm">{pos}</td>
                  {displayedInnings.map((inningNum) => {
                    const playerId = assignments.byInning[inningNum]?.[pos];
                    const player = playerId ? playerMap.get(playerId) : null;
                    const isAbsent = player?.active === false;
                    return (
                      <td key={inningNum} className="p-0">
                        <button
                          onClick={() => setSelectedCell({ inning: inningNum, pos })}
                          className={cn(
                            "w-full h-12 rounded-lg border-2 transition-all flex items-center justify-center font-bold text-sm relative",
                            player ? "border-transparent" : "border-dashed border-slate-200 text-slate-300 hover:border-slate-300",
                            selectedCell?.inning === inningNum && selectedCell?.pos === pos ? "ring-2 ring-indigo-500 ring-offset-2" : "",
                            isAbsent ? "opacity-40 grayscale" : ""
                          )}
                          style={player ? { backgroundColor: player.color, color: getContrastColor(player.color) } : {}}
                        >
                          {player ? (
                            <span className="flex flex-col items-center leading-tight">
                              <span>{player.name}</span>
                              {player.grade && <span className="text-[9px] opacity-80">{player.grade}th</span>}
                            </span>
                          ) : "+"}
                          {isAbsent && (
                            <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm" title="Player is Absent">
                              <X size={10} strokeWidth={4} />
                            </div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {usesFixedLineup && <>
                <tr>
                  <td colSpan={displayedInnings.length + 1} className="py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Batting-only roles</td>
                </tr>
                {BATTING_ONLY_POSITIONS.map(pos => {
                  const playerId = assignments.byInning[1]?.[pos];
                  const player = playerId ? playerMap.get(playerId) : null;
                  const isAbsent = player?.active === false;
                  return (
                    <tr key={pos}>
                      <td className="p-2 font-bold text-slate-600 text-sm">{pos}</td>
                      <td className="p-0">
                        <button
                          onClick={() => setSelectedCell({ inning: 1, pos })}
                          className={cn(
                            "w-full h-12 rounded-lg border-2 transition-all flex items-center justify-center font-bold text-sm relative",
                            player ? "border-transparent" : "border-dashed border-slate-200 text-slate-300 hover:border-slate-300",
                            selectedCell?.inning === 1 && selectedCell?.pos === pos ? "ring-2 ring-indigo-500 ring-offset-2" : "",
                            isAbsent ? "opacity-40 grayscale" : ""
                          )}
                          style={player ? { backgroundColor: player.color, color: getContrastColor(player.color) } : {}}
                        >
                          {player ? (
                            <span className="flex flex-col items-center leading-tight">
                              <span>{player.name}</span>
                              {player.grade && <span className="text-[9px] opacity-80">{player.grade}th</span>}
                            </span>
                          ) : "+"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </>}

              <tr>
                <td colSpan={displayedInnings.length + 1} className="py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Dugout</td>
              </tr>
              <tr>
                <td className="p-2 font-bold text-slate-600 text-sm">Bench</td>
                {displayedInnings.map((inningNum) => {
                  const dugout = assignments.byInning[inningNum]?.dugout || [];
                  return (
                    <td key={inningNum} className="p-1 align-top">
                      <div className="min-h-[60px] p-2 bg-slate-50 rounded-xl border border-slate-100 flex flex-wrap gap-1">
                        {dugout.map(pid => {
                          const p = playerMap.get(pid);
                          if (!p) return null;
                          const isAbsent = p.active === false;
                          return (
                            <div
                              key={pid}
                              className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-bold shadow-sm cursor-pointer hover:scale-105 transition-transform relative",
                                isAbsent ? "opacity-40 grayscale" : ""
                              )}
                              style={{ backgroundColor: p.color, color: getContrastColor(p.color) }}
                              onClick={() => setSelectedCell({ inning: inningNum, pos: 'dugout' })}
                            >
                              {p.name}
                              {isAbsent && (
                                <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm">
                                  <X size={8} strokeWidth={4} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <button
                          onClick={() => setSelectedCell({ inning: inningNum, pos: 'dugout' })}
                          className="w-6 h-6 rounded-md border border-dashed border-slate-300 text-slate-400 flex items-center justify-center hover:bg-white transition-colors"
                        >
                          <UserPlus size={12} />
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Player Selector Modal */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">
                Assign to {selectedCell.pos}{usesFixedLineup ? '' : ` (Inning ${selectedCell.inning})`}
              </h3>
              <button onClick={() => setSelectedCell(null)} className="p-1 hover:bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
              <button
                onClick={() => handleAssign(null)}
                className="p-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-sm hover:border-slate-300"
              >
                Clear Slot
              </button>
              {getDefensePickerPlayers(
                players,
                assignments.byInning[selectedCell.inning],
                lineupPositions,
              ).map(p => {
                const currentInning = assignments.byInning[selectedCell.inning];
                let currentPos = "Unassigned";
                for (const pos of lineupPositions) {
                  if (currentInning?.[pos] === p.id) {
                    currentPos = pos;
                    break;
                  }
                }
                if (currentInning?.dugout?.includes(p.id)) currentPos = "Dugout";

                return (
                  <button
                    key={p.id}
                    onClick={() => handleAssign(p.id)}
                    className="p-3 rounded-xl flex flex-col items-start gap-1 transition-all hover:scale-[1.02]"
                    style={{ backgroundColor: p.color, color: getContrastColor(p.color) }}
                  >
                    <span className="font-bold text-sm">{p.name}</span>
                    {p.grade && <span className="text-[10px] opacity-80">{p.grade}th grade</span>}
                    <span className="text-[10px] opacity-80">Currently: {currentPos}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const X = ({ size, strokeWidth = 2 }: { size: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);
