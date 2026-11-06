import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleStop,
  CloudOff,
  ListOrdered,
  LoaderCircle,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  UserRoundPlus,
} from 'lucide-react';
import type {
  DefenseAssignments,
  GameLog,
  PlateAppearanceOutcome,
  Player,
  Settings,
} from '../types';
import type { SyncStatus } from '../hooks/useAppState';
import { BATTING_ONLY_POSITIONS, getAllPositions } from '../constants';
import { getBattingLineupIds } from '../utils';
import {
  addOpponentHitter,
  advanceHalfInning,
  correctOuts,
  correctScore,
  emptyPlayerGameStats,
  finishGame,
  isOurAtBat,
  normalizeGameLog,
  parsePlateAppearanceResult,
  recordOpponentPlateAppearance,
  recordOpponentTotal,
  recordOut,
  recordPlateAppearance,
  recordSubstitution,
  removeOpponentHitter,
  resumeGame,
  setCurrentOpponentHitter,
  startGame,
  undoLastEvent,
  type NormalizedGameLog,
} from '../gameLog';

interface PostGameTabProps {
  players: Player[];
  battingOrder: string[];
  assignments: DefenseAssignments;
  settings: Settings;
  teamName: string;
  opponentName?: string;
  gameLog?: GameLog;
  onSaveLog: (log: GameLog) => void;
  activeGameName?: string;
  onStartNewGame: () => void;
  onDeleteCurrentGame?: () => Promise<void>;
  syncStatus?: SyncStatus;
}

const OUTCOMES: Array<{ value: PlateAppearanceOutcome; label: string }> = [
  { value: 'single', label: '1B' },
  { value: 'double', label: '2B' },
  { value: 'triple', label: '3B' },
  { value: 'home_run', label: 'HR' },
  { value: 'walk', label: 'BB' },
  { value: 'hit_by_pitch', label: 'HBP' },
  { value: 'reached_on_error', label: 'ROE' },
  { value: 'strikeout', label: 'K' },
  { value: 'out', label: 'Out' },
];
const RESULT_OPTIONS = ['K', 'BB', 'HBP', '1B', '2B', '3B', 'HR', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'FC', 'SAC', 'F8', '6-3', 'OUT'];
const QUICK_RESULTS = ['K', 'BB', '1B', '2B', '3B', 'HR', 'E1', 'OUT'];

const numberValue = (value: number | undefined) => value || 0;
const outcomeLabel = (outcome: PlateAppearanceOutcome | undefined) =>
  OUTCOMES.find((item) => item.value === outcome)?.label || 'PA';

export const PostGameTab: React.FC<PostGameTabProps> = ({
  players,
  battingOrder,
  assignments,
  settings,
  teamName,
  opponentName,
  gameLog,
  onSaveLog,
  activeGameName,
  onStartNewGame,
  onDeleteCurrentGame,
  syncStatus = 'saved',
}) => {
  const [log, setLog] = useState<NormalizedGameLog>(() => normalizeGameLog(gameLog, players, assignments));
  const [view, setView] = useState<'live' | 'stats' | 'plays'>('live');
  const [sideChoice, setSideChoice] = useState<'home' | 'away'>(log.ourSide);
  const [batterId, setBatterId] = useState(log.currentBatterId || '');
  const [resultCode, setResultCode] = useState('');
  const [runScorerIds, setRunScorerIds] = useState<string[]>([]);
  const [rbi, setRbi] = useState(0);
  const [pitcherId, setPitcherId] = useState(log.currentPitcherId || '');
  const [outgoingId, setOutgoingId] = useState('');
  const [incomingId, setIncomingId] = useState('');
  const [subPosition, setSubPosition] = useState('');
  const [opponentNumber, setOpponentNumber] = useState('');
  const [confirmAction, setConfirmAction] = useState<'new' | 'delete' | null>(null);
  const [isGameActionWorking, setIsGameActionWorking] = useState(false);

  const playerMap = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const battingLineup = useMemo(
    () => getBattingLineupIds(battingOrder, settings, assignments),
    [battingOrder, settings, assignments],
  );
  const lineupPositions = useMemo(
    () => [...getAllPositions(settings), ...(settings.sport === 'baseball' ? BATTING_ONLY_POSITIONS : [])],
    [settings],
  );

  useEffect(() => {
    setLog(normalizeGameLog(gameLog, players, assignments));
  }, [gameLog, players, assignments]);

  useEffect(() => {
    if (!batterId && battingLineup[0]) setBatterId(battingLineup[0]);
  }, [batterId, battingLineup]);

  useEffect(() => {
    if (!pitcherId) {
      const plannedPitcher = assignments.byInning[1]?.P;
      if (plannedPitcher) setPitcherId(plannedPitcher);
    }
  }, [pitcherId, assignments]);

  const isFinal = log.status === 'final';
  const commit = (next: NormalizedGameLog, allowFinalChange = false) => {
    if (isFinal && !allowFinalChange) return;
    setLog(next);
    onSaveLog(next);
  };

  const playerName = (id: string) => playerMap.get(id)?.name || 'Unknown player';
  const atBat = isOurAtBat(log);
  const opponentLabel = opponentName?.trim() || 'Opponent';
  const lineScoreInnings = Array.from(
    { length: Math.max(7, log.actualInnings, log.currentInning) },
    (_, index) => index + 1,
  );
  const awaySide = log.ourSide === 'away' ? 'our' : 'opponent';
  const homeSide = awaySide === 'our' ? 'opponent' : 'our';
  const lineScoreRows = [awaySide, homeSide] as const;
  const sideHasBatted = (side: 'our' | 'opponent', inning: number) => {
    if (log.status === 'not_started' || inning > log.currentInning) return false;
    if (inning < log.currentInning) return true;
    const isAway = side === awaySide;
    return isAway || log.half === 'bottom';
  };
  const plateAppearancesByPlayer = useMemo(() => {
    const appearances = new Map<string, typeof log.events>();
    log.events.filter((event) => event.type === 'plate_appearance' && event.battingSide !== 'opponent' && event.playerId).forEach((event) => {
      const playerEvents = appearances.get(event.playerId!) || [];
      playerEvents.push(event);
      appearances.set(event.playerId!, playerEvents);
    });
    return appearances;
  }, [log.events]);
  const plateAppearancesByOpponent = useMemo(() => {
    const appearances = new Map<string, typeof log.events>();
    log.events.filter((event) => event.type === 'plate_appearance' && event.battingSide === 'opponent' && event.opponentHitterId).forEach((event) => {
      const hitterEvents = appearances.get(event.opponentHitterId!) || [];
      hitterEvents.push(event);
      appearances.set(event.opponentHitterId!, hitterEvents);
    });
    return appearances;
  }, [log.events]);
  const playerPosition = (playerId: string) => {
    const entry = Object.entries(assignments.byInning[1] || {}).find(([position, assigned]) => position !== 'dugout' && assigned === playerId);
    return entry?.[0] || '';
  };
  const activeScorebookAppearanceCounts = atBat
    ? battingLineup.map((id) => plateAppearancesByPlayer.get(id)?.length || 0)
    : log.opponentHitters.map((hitter) => plateAppearancesByOpponent.get(hitter.id)?.length || 0);
  const scorebookRows = atBat
    ? battingLineup.map((id) => ({ id, label: playerName(id), detail: playerPosition(id) || '—' }))
    : log.opponentHitters.map((hitter) => ({ id: hitter.id, label: `#${hitter.number}`, detail: 'Opponent' }));
  const scorebookColumnCount = Math.max(
    4,
    ...activeScorebookAppearanceCounts.map((count) => count + 1),
  );
  const errorFielderId = (code: string) => {
    const positionByNumber: Record<string, string[]> = {
      '1': ['P'], '2': ['C'], '3': ['1B'], '4': ['2B'], '5': ['3B'], '6': ['SS'], '7': ['LF'], '8': ['CF', 'LCF', 'RCF'], '9': ['RF'],
    };
    const match = code.match(/^E([1-9])$/);
    if (!match) return undefined;
    const inning = assignments.byInning[1] || {};
    return positionByNumber[match[1]].map((position) => inning[position]).find((id): id is string => typeof id === 'string');
  };

  const toggleRunScorer = (playerId: string) => {
    setRunScorerIds((current) => current.includes(playerId)
      ? current.filter((id) => id !== playerId)
      : [...current, playerId]);
  };

  const handlePlateAppearance = () => {
    if (isFinal) return;
    if (!resultCode.trim()) return;
    const parsedResult = parsePlateAppearanceResult(resultCode);
    if (!atBat) {
      const hitter = log.opponentHitters.find((item) => item.id === log.currentOpponentHitterId);
      if (!hitter) return;
      commit(recordOpponentPlateAppearance(log, {
        hitterId: hitter.id,
        hitterNumber: hitter.number,
        outcome: parsedResult.outcome,
        resultCode: parsedResult.code,
        pitcherId: pitcherId || undefined,
        errorFielderId: errorFielderId(parsedResult.code),
      }));
      setResultCode('');
      return;
    }
    if (!batterId) return;
    const effectiveRunScorerIds = parsedResult.outcome === 'home_run' && !runScorerIds.includes(batterId)
      ? [...runScorerIds, batterId]
      : runScorerIds;
    let next = recordPlateAppearance(log, {
      batterId,
      batterName: playerName(batterId),
      outcome: parsedResult.outcome,
      resultCode: parsedResult.code,
      runScorerIds: effectiveRunScorerIds,
      runScorerNames: effectiveRunScorerIds.map(playerName),
      rbi: parsedResult.outcome === 'home_run' ? Math.max(rbi, effectiveRunScorerIds.length) : rbi,
    });
    const currentIndex = battingLineup.indexOf(batterId);
    const nextBatter = battingLineup.length > 0
      ? battingLineup[(Math.max(0, currentIndex) + 1) % battingLineup.length]
      : undefined;
    next = { ...next, currentBatterId: nextBatter };
    commit(next);
    setBatterId(nextBatter || '');
    setResultCode('');
    setRunScorerIds([]);
    setRbi(0);
  };

  const handleBatterSelection = (playerId: string) => {
    if (isFinal) return;
    setBatterId(playerId);
    commit({ ...log, currentBatterId: playerId || undefined });
  };

  const handleUndo = () => {
    if (isFinal) return;
    const lastEvent = log.events.at(-1);
    let next = undoLastEvent(log);
    if (lastEvent?.type === 'plate_appearance' && lastEvent.playerId) {
      next = { ...next, currentBatterId: lastEvent.playerId };
      setBatterId(lastEvent.playerId);
    }
    commit(next);
  };

  const handleAddOpponentHitter = () => {
    if (isFinal) return;
    if (!opponentNumber.trim()) return;
    commit(addOpponentHitter(log, opponentNumber));
    setOpponentNumber('');
  };

  const handleGameAction = async () => {
    if (!confirmAction) return;
    setIsGameActionWorking(true);
    try {
      if (confirmAction === 'delete' && onDeleteCurrentGame) await onDeleteCurrentGame();
      else if (confirmAction === 'new') onStartNewGame();
      setConfirmAction(null);
      setResultCode('');
      setOpponentNumber('');
    } finally {
      setIsGameActionWorking(false);
    }
  };

  const handleSubstitution = () => {
    if (isFinal) return;
    if (!outgoingId || !incomingId || !subPosition || outgoingId === incomingId) return;
    commit(recordSubstitution(
      log,
      outgoingId,
      incomingId,
      playerName(outgoingId),
      playerName(incomingId),
      subPosition,
    ));
    setOutgoingId('');
    setIncomingId('');
    setSubPosition('');
  };

  const togglePlayed = (playerId: string) => {
    if (isFinal) return;
    const next: NormalizedGameLog = {
      ...log,
      playerStats: { ...log.playerStats },
    };
    const stats = { ...(next.playerStats[playerId] || emptyPlayerGameStats()) };
    stats.played = !stats.played;
    next.playerStats[playerId] = stats;
    commit(next);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 pb-24 md:p-6">
      <datalist id="scorebook-result-codes">
        {RESULT_OPTIONS.map((code) => <option key={code} value={code} />)}
      </datalist>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Activity className="text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-800">Game Log</h2>
          <span className={`rounded-md px-2 py-1 text-xs font-bold ${
            log.status === 'in_progress'
              ? 'bg-emerald-100 text-emerald-700'
              : log.status === 'final'
                ? 'bg-slate-200 text-slate-700'
                : 'bg-amber-100 text-amber-700'
          }`}>
            {log.status === 'in_progress' ? 'LIVE' : log.status === 'final' ? 'FINAL' : 'NOT STARTED'}
          </span>
          <span className={`inline-flex items-center gap-1 text-xs font-bold ${syncStatus === 'offline' ? 'text-amber-700' : 'text-slate-400'}`}>
            {syncStatus === 'offline' ? <CloudOff size={14} /> : syncStatus === 'saving' ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
            {syncStatus === 'offline' ? 'Offline - saved on this device' : syncStatus === 'saving' ? 'Saving…' : 'Saved'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setConfirmAction('new')} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><Plus size={15} /> New Game</button>
          <button onClick={() => setConfirmAction('delete')} disabled={!onDeleteCurrentGame} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-sm font-bold text-red-600 disabled:border-slate-200 disabled:text-slate-300"><Trash2 size={15} /> Delete Game</button>
          <div className="inline-flex w-fit rounded-lg border border-slate-200 bg-white p-1">
            {([
              ['live', Activity, 'Live'],
              ['stats', BarChart3, 'Stats'],
              ['plays', ListOrdered, 'Plays'],
            ] as const).map(([id, Icon, label]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-bold ${view === id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-300 bg-white" aria-label="Line score">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] border-collapse text-center">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 text-[11px] font-black uppercase text-slate-500">
                <th className="sticky left-0 z-10 min-w-28 border-r border-slate-300 bg-slate-100 px-3 py-2 text-left">Line Score</th>
                {lineScoreInnings.map((inning) => (
                  <th key={inning} className={`w-9 border-r border-slate-200 px-1 py-2 ${log.status === 'in_progress' && inning === log.currentInning ? 'bg-amber-100 text-amber-800' : ''}`}>{inning}</th>
                ))}
                <th className="w-10 border-l-2 border-slate-400 px-1 py-2 text-slate-900">R</th>
                <th className="w-10 px-1 py-2">H</th>
                <th className="w-10 px-1 py-2">E</th>
              </tr>
            </thead>
            <tbody>
              {lineScoreRows.map((side, rowIndex) => {
                const isOurTeam = side === 'our';
                const isActiveSide = (isOurTeam && atBat) || (!isOurTeam && !atBat);
                const runsByInning = isOurTeam ? log.ourRunsByInning : log.opponentRunsByInning;
                return (
                  <tr key={side} className={`${rowIndex === 0 ? 'border-b border-slate-300' : ''} ${log.status === 'in_progress' && isActiveSide ? 'bg-emerald-50/60' : ''}`}>
                    <th className={`sticky left-0 z-10 border-r border-slate-300 px-3 py-3 text-left ${log.status === 'in_progress' && isActiveSide ? 'bg-emerald-50' : 'bg-white'}`}>
                      <span className="block max-w-24 truncate text-sm font-black text-slate-800">{isOurTeam ? teamName || 'Our Team' : opponentLabel}</span>
                      <span className="text-[10px] font-bold uppercase text-slate-400">{side === awaySide ? 'Away' : 'Home'}</span>
                    </th>
                    {lineScoreInnings.map((inning) => (
                      <td key={inning} className={`border-r border-slate-200 px-1 py-3 font-mono text-base font-bold text-slate-700 ${log.status === 'in_progress' && inning === log.currentInning ? 'bg-amber-50' : ''}`}>
                        {sideHasBatted(side, inning) ? runsByInning[inning] || 0 : '–'}
                      </td>
                    ))}
                    <td className="border-l-2 border-slate-400 px-1 py-3 text-lg font-black text-slate-950">{isOurTeam ? log.ourScore : log.opponentScore}</td>
                    <td className="px-1 py-3 font-bold text-slate-700">{isOurTeam ? log.ourHits : log.opponentHits}</td>
                    <td className="px-1 py-3 font-bold text-slate-700">{isOurTeam ? log.ourErrors : log.opponentErrors}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-slate-300 bg-slate-50 px-3 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase text-slate-700">{log.half} {log.currentInning}</span>
            <div className="flex items-center gap-1" aria-label={`${log.outs} outs`}>
              {[0, 1, 2].map((index) => <span key={index} className={`h-3 w-3 rounded-full border ${index < log.outs ? 'border-red-600 bg-red-500' : 'border-slate-300 bg-white'}`} />)}
              <span className="ml-1 text-[10px] font-bold uppercase text-slate-400">Outs</span>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">Score correction</span>
            {(['our', 'opponent'] as const).map((side) => (
              <div key={side} className="inline-flex items-center overflow-hidden rounded-md border border-slate-200 bg-white">
                <span className="max-w-24 truncate px-2 text-xs font-bold text-slate-600">{side === 'our' ? teamName || 'Our Team' : opponentLabel}</span>
                <button onClick={() => commit(correctScore(log, side, -1))} disabled={isFinal} className="h-8 w-8 border-l border-slate-200 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300" title={`Remove ${side === 'our' ? 'our' : 'opponent'} run`} aria-label={`Remove ${side === 'our' ? 'our' : 'opponent'} run`}><Minus size={13} className="mx-auto" /></button>
                <button onClick={() => commit(correctScore(log, side, 1))} disabled={isFinal} className="h-8 w-8 border-l border-slate-200 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300" title={`Add ${side === 'our' ? 'our' : 'opponent'} run`} aria-label={`Add ${side === 'our' ? 'our' : 'opponent'} run`}><Plus size={13} className="mx-auto" /></button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {view === 'live' && (
        <>
          <section className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
            {log.status === 'not_started' && (
              <>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                  {(['home', 'away'] as const).map((side) => (
                    <button key={side} onClick={() => setSideChoice(side)} className={`rounded-md px-3 py-2 text-sm font-bold capitalize ${sideChoice === side ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{side}</button>
                  ))}
                </div>
                <button onClick={() => commit(startGame(log, sideChoice))} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white"><Play size={16} /> Start Game</button>
              </>
            )}
            {log.status === 'final' && (
              <button onClick={() => commit(resumeGame(log), true)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white"><Play size={16} /> Resume Game</button>
            )}
            {log.status === 'in_progress' && (
              <button onClick={() => commit(finishGame(log))} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-bold text-white"><CircleStop size={16} /> End Game</button>
            )}
            <button onClick={() => commit(correctOuts(log, -1))} disabled={log.status !== 'in_progress' || log.outs === 0} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-40"><Minus size={14} /> Out</button>
            <button onClick={() => commit(recordOut(log))} disabled={log.status !== 'in_progress'} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-40"><Plus size={14} /> Out</button>
            <button onClick={() => commit(advanceHalfInning(log))} disabled={log.status !== 'in_progress'} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-40">Next Half <ChevronRight size={15} /></button>
            <button onClick={handleUndo} disabled={log.status !== 'in_progress' || log.events.length === 0} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-40"><Undo2 size={15} /> Undo</button>
          </section>

          {(atBat ? battingLineup.length > 0 : log.status !== 'not_started') && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-800">{atBat ? 'Our Hitters' : 'Opponent Hitters'}</h3>
                  <p className="text-xs text-slate-400">{atBat ? 'Results follow your batting order.' : 'Add jersey numbers as you face them.'}</p>
                </div>
                {!atBat && log.status === 'in_progress' && (
                  <div className="flex items-center gap-2">
                    <input aria-label="Opponent jersey number" value={opponentNumber} onChange={(event) => setOpponentNumber(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleAddOpponentHitter(); }} placeholder="Jersey #" className="h-10 w-28 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold" />
                    <button onClick={handleAddOpponentHitter} disabled={!opponentNumber.trim()} className="inline-flex h-10 items-center gap-1 rounded-md bg-indigo-600 px-3 text-sm font-bold text-white disabled:opacity-40"><Plus size={15} /> Add</button>
                  </div>
                )}
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
                {scorebookRows.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Add the first opponent jersey number to begin.</p>}
                {scorebookRows.map((row, lineupIndex) => {
                  const appearances = atBat ? plateAppearancesByPlayer.get(row.id) || [] : plateAppearancesByOpponent.get(row.id) || [];
                  const isCurrentBatter = log.status === 'in_progress' && (atBat ? row.id === batterId : row.id === log.currentOpponentHitterId);
                  return (
                    <div key={row.id} className={`grid grid-cols-[120px_minmax(0,1fr)] border-b border-slate-300 last:border-0 sm:grid-cols-[160px_minmax(0,1fr)] ${isCurrentBatter ? 'bg-indigo-50' : 'bg-white'}`}>
                      <div className="border-r border-slate-300 p-3">
                        <button onClick={() => { if (!atBat) commit(setCurrentOpponentHitter(log, row.id)); }} className="text-left disabled:cursor-default" disabled={atBat || isFinal}>
                          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-xs font-black text-slate-500">{lineupIndex + 1}</span>
                          <span className="font-black text-slate-800">{row.label}</span>
                          <span className="mt-2 block text-[10px] font-bold uppercase text-slate-400">{row.detail}</span>
                        </button>
                        {!atBat && !isFinal && (
                          <button onClick={() => commit(removeOpponentHitter(log, row.id))} className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-500"><Trash2 size={12} /> Remove</button>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-wrap items-stretch gap-2 p-2">
                        {Array.from({ length: scorebookColumnCount }, (_, paIndex) => {
                          const appearance = appearances[paIndex];
                          const isCurrentCell = isCurrentBatter && paIndex === appearances.length;
                          if (appearance) return (
                            <div key={paIndex} className="flex h-16 w-20 flex-col justify-between border border-slate-200 bg-white p-2">
                              <span className="text-[9px] font-bold uppercase text-slate-400">PA {paIndex + 1} · {appearance.half === 'top' ? 'T' : 'B'}{appearance.inning}</span>
                              <span className="text-xl font-black text-slate-900">{appearance.resultCode || outcomeLabel(appearance.outcome)}</span>
                            </div>
                          );
                          if (isCurrentCell) return (
                            <div key={paIndex} className="w-40 border-2 border-indigo-500 bg-indigo-50 p-2">
                              <span className="text-[9px] font-black uppercase text-indigo-600">PA {paIndex + 1} · Enter result</span>
                              <input aria-label={`${row.label} result`} list="scorebook-result-codes" value={resultCode} onChange={(event) => setResultCode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handlePlateAppearance(); }} placeholder="K, BB, E1…" className="mt-1 h-8 w-full border border-indigo-300 bg-white px-2 text-sm font-black uppercase text-slate-900" />
                              <button onClick={handlePlateAppearance} disabled={!resultCode.trim()} className="mt-1 h-7 w-full bg-indigo-600 text-[10px] font-black text-white disabled:opacity-40">Record</button>
                            </div>
                          );
                          return <div key={paIndex} className="flex h-16 w-20 items-center justify-center border border-slate-100 text-xs text-slate-300">PA {paIndex + 1}</div>;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {log.status === 'in_progress' && atBat && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Our At-Bat</h3>
                <span className="text-xs font-bold uppercase text-emerald-600">{log.half} {log.currentInning}</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                <label className="space-y-1 text-sm font-bold text-slate-600">Batter
                  <select value={batterId} onChange={(event) => handleBatterSelection(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-slate-800">
                    <option value="">Select batter</option>
                    {battingLineup.map((id) => <option key={id} value={id}>{playerName(id)}</option>)}
                  </select>
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label className="text-xs font-black uppercase text-slate-500">Result
                    <input list="scorebook-result-codes" value={resultCode} onChange={(event) => setResultCode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handlePlateAppearance(); }} placeholder="K, BB, E1, 1B, F8, 6-3…" className="mt-1 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base font-black uppercase text-slate-900" />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {QUICK_RESULTS.map((code) => (
                      <button key={code} onClick={() => setResultCode(code)} className={`h-8 min-w-10 rounded-md border px-2 text-xs font-black ${resultCode.toUpperCase() === code ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{code}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase text-slate-400">Run scorers</p>
                <div className="flex flex-wrap gap-2">
                  {battingLineup.map((id) => (
                    <button key={id} onClick={() => toggleRunScorer(id)} className={`rounded-md border px-2.5 py-1.5 text-xs font-bold ${runScorerIds.includes(id) ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{playerName(id)}</button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm font-bold text-slate-600">RBI
                  <input type="number" min={0} max={4} value={rbi} onChange={(event) => setRbi(Math.max(0, Number(event.target.value) || 0))} className="mt-1 block w-20 rounded-lg border border-slate-200 p-2 text-center" />
                </label>
                <button onClick={handlePlateAppearance} disabled={!batterId || !resultCode.trim()} className="h-11 rounded-lg bg-indigo-600 px-5 font-bold text-white disabled:opacity-40">Record Result</button>
              </div>
            </section>
          )}

          {log.status === 'in_progress' && !atBat && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Opponent At-Bat</h3>
                <span className="text-xs font-bold uppercase text-red-500">{log.half} {log.currentInning}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-600">Pitcher
                    <select value={pitcherId} onChange={(event) => setPitcherId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-slate-800">
                      <option value="">Select pitcher</option>
                      {players.filter((player) => player.active !== false).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-bold text-slate-600">Current hitter
                    <select value={log.currentOpponentHitterId || ''} onChange={(event) => commit(setCurrentOpponentHitter(log, event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-slate-800">
                      <option value="">Select hitter</option>
                      {log.opponentHitters.map((hitter) => <option key={hitter.id} value={hitter.id}>#{hitter.number}</option>)}
                    </select>
                  </label>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label className="text-xs font-black uppercase text-slate-500">Result
                    <input list="scorebook-result-codes" value={resultCode} onChange={(event) => setResultCode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handlePlateAppearance(); }} placeholder="K, BB, E1, 1B, F8, 6-3…" className="mt-1 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base font-black uppercase text-slate-900" />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {QUICK_RESULTS.map((code) => (
                      <button key={code} onClick={() => setResultCode(code)} className={`h-8 min-w-10 rounded-md border px-2 text-xs font-black ${resultCode.toUpperCase() === code ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{code}</button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={handlePlateAppearance} disabled={!log.currentOpponentHitterId || !resultCode.trim()} className="h-11 rounded-lg bg-indigo-600 px-5 font-bold text-white disabled:opacity-40">Record Result</button>
                    <button onClick={() => commit(recordOpponentTotal(log, 'opponentScore', 1))} className="h-11 rounded-lg bg-red-600 px-4 font-bold text-white">Add Run</button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {log.status === 'in_progress' && <section className="space-y-3 border-t border-slate-200 pt-5">
            <div className="flex items-center gap-2"><UserRoundPlus size={18} className="text-indigo-600" /><h3 className="font-bold text-slate-800">Substitution</h3></div>
            <div className="grid gap-2 sm:grid-cols-4">
              <select aria-label="Player leaving" value={outgoingId} onChange={(event) => setOutgoingId(event.target.value)} className="rounded-lg border border-slate-200 bg-white p-2.5"><option value="">Player out</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select>
              <select aria-label="Player entering" value={incomingId} onChange={(event) => setIncomingId(event.target.value)} className="rounded-lg border border-slate-200 bg-white p-2.5"><option value="">Player in</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select>
              <select aria-label="Substitution position" value={subPosition} onChange={(event) => setSubPosition(event.target.value)} className="rounded-lg border border-slate-200 bg-white p-2.5"><option value="">Position</option>{lineupPositions.map((position) => <option key={position} value={position}>{position}</option>)}</select>
              <button onClick={handleSubstitution} disabled={!outgoingId || !incomingId || !subPosition || outgoingId === incomingId} className="rounded-lg bg-slate-900 px-4 py-2.5 font-bold text-white disabled:opacity-40">Log Substitution</button>
            </div>
          </section>}
        </>
      )}

      {view === 'stats' && (
        <section className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead><tr className="border-b-2 border-slate-200 text-left text-xs uppercase text-slate-400"><th className="p-2">Player</th><th className="p-2">Played</th><th className="p-2">AB</th><th className="p-2">H</th><th className="p-2">AVG</th><th className="p-2">R</th><th className="p-2">RBI</th><th className="p-2">BB</th><th className="p-2">K</th><th className="p-2">E</th><th className="p-2">Pitches</th><th className="p-2">Pitch K</th><th className="p-2">BB allowed</th></tr></thead>
            <tbody>{players.map((player) => {
              const stats = log.playerStats[player.id] || emptyPlayerGameStats(player.active !== false);
              const avg = stats.ab > 0 ? numberValue(stats.hits) / stats.ab : 0;
              return <tr key={player.id} className="border-b border-slate-100">
                <td className="p-2 font-semibold text-slate-800">{player.name}</td>
                <td className="p-2"><button onClick={() => togglePlayed(player.id)} disabled={isFinal} className={`${stats.played ? 'text-emerald-600' : 'text-slate-300'} disabled:cursor-not-allowed`} title={isFinal ? 'Resume the game to edit' : 'Toggle played'}><CheckCircle2 size={20} /></button></td>
                <td className="p-2">{stats.ab}</td><td className="p-2">{numberValue(stats.hits)}</td><td className="p-2 font-bold">{avg.toFixed(3).replace(/^0/, '')}</td><td className="p-2">{numberValue(stats.runs)}</td><td className="p-2">{numberValue(stats.rbi)}</td><td className="p-2">{numberValue(stats.walks)}</td><td className="p-2">{numberValue(stats.strikeouts)}</td><td className="p-2">{numberValue(stats.errors)}</td><td className="p-2">{numberValue(stats.pitches)}</td><td className="p-2">{numberValue(stats.pitchingStrikeouts)}</td><td className="p-2">{numberValue(stats.walksAllowed)}</td>
              </tr>;
            })}</tbody>
          </table>
        </section>
      )}

      {view === 'plays' && (
        <section className="space-y-2">
          <div className="flex items-center justify-between"><h3 className="font-bold text-slate-800">Play Log</h3><button onClick={handleUndo} disabled={isFinal || log.events.length === 0} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-40"><RotateCcw size={15} /> Undo Last</button></div>
          {log.events.length === 0 && <p className="border-y border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">No plays logged yet.</p>}
          {[...log.events].reverse().map((event) => (
            <div key={event.id} className="flex items-start gap-3 border-b border-slate-100 py-3">
              <span className="min-w-20 rounded-md bg-slate-100 px-2 py-1 text-center text-[10px] font-black uppercase text-slate-500">{event.half} {event.inning}</span>
              <div><p className="text-sm font-semibold text-slate-800">{event.description}</p><p className="text-xs text-slate-400">{new Date(event.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p></div>
            </div>
          ))}
        </section>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">{confirmAction === 'new' ? 'Start a new game?' : 'Delete this game?'}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {confirmAction === 'new'
                ? activeGameName
                  ? 'Your current saved game will stay in the game library. The roster stays and the game log resets.'
                  : 'The roster stays and the current game log resets.'
                : activeGameName
                  ? `This permanently deletes “${activeGameName}” and its statistics. Your roster stays.`
                  : 'This clears the current game log and its statistics. Your roster stays.'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmAction(null)} disabled={isGameActionWorking} className="h-10 rounded-md border border-slate-200 px-4 text-sm font-bold text-slate-600">Cancel</button>
              <button onClick={handleGameAction} disabled={isGameActionWorking} className={`h-10 rounded-md px-4 text-sm font-bold text-white disabled:opacity-50 ${confirmAction === 'delete' ? 'bg-red-600' : 'bg-indigo-600'}`}>
                {isGameActionWorking ? 'Working…' : confirmAction === 'delete' ? 'Delete Game' : 'Start New Game'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
