import React, { useState, useEffect } from 'react';
import { Player, DefenseAssignments, GameLog } from '../types';
import { Save, CheckCircle2, AlertCircle, History, Plus, Minus, RotateCcw } from 'lucide-react';

interface PostGameTabProps {
  players: Player[];
  assignments: DefenseAssignments;
  gameLog?: GameLog;
  onSaveLog: (log: GameLog) => void;
}

export const PostGameTab: React.FC<PostGameTabProps> = ({
  players,
  assignments,
  gameLog,
  onSaveLog
}) => {
  const [actualInnings, setActualInnings] = useState(gameLog?.actualInnings || assignments.innings);
  const [bulkAB, setBulkAB] = useState(0);
  const [playerStats, setPlayerStats] = useState<GameLog['playerStats']>(
    gameLog?.playerStats || 
    Object.fromEntries((players || []).map(p => [p.id, { ab: 0, played: p.active !== false }]))
  );

  // Update stats if players change
  useEffect(() => {
    if (!players) return;
    setPlayerStats(prev => {
      const next = { ...prev };
      players.forEach(p => {
        if (!next[p.id]) {
          next[p.id] = { ab: 0, played: p.active !== false };
        } else if (p.active === false) {
          // If marked absent in roster, ensure they are marked as not played here
          next[p.id] = { ...next[p.id], played: false };
        }
      });
      return next;
    });
  }, [players]);

  const handleSave = () => {
    onSaveLog({
      actualInnings,
      playerStats
    });
    alert('Game log saved! Analytics will now reflect actual play.');
  };

  const updateStat = (pid: string, field: keyof GameLog['playerStats'][string], value: any) => {
    setPlayerStats(prev => ({
      ...prev,
      [pid]: { ...prev[pid], [field]: value }
    }));
  };

  const applyBulkAB = () => {
    if (!players) return;
    setPlayerStats(prev => {
      const next = { ...prev };
      players.forEach(p => {
        if (next[p.id]?.played) {
          next[p.id] = { ...next[p.id], ab: bulkAB };
        }
      });
      return next;
    });
  };

  const clearAllABs = () => {
    if (!players) return;
    if (window.confirm('Clear all At-Bats?')) {
      setPlayerStats(prev => {
        const next = { ...prev };
        players.forEach(p => {
          next[p.id] = { ...next[p.id], ab: 0 };
        });
        return next;
      });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Post-Game Log</h2>
            <p className="text-slate-500 text-sm">Record what actually happened during the game.</p>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Save size={20} /> Save Results
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Innings Actually Played</label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="1"
                max={assignments.innings}
                value={actualInnings}
                onChange={(e) => setActualInnings(parseInt(e.target.value) || 0)}
                className="w-24 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg"
              />
              <span className="text-slate-400 text-sm italic">
                (Scheduled: {assignments.innings})
              </span>
            </div>
            {actualInnings < assignments.innings && (
              <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-50 p-2 rounded-lg border border-amber-100">
                <AlertCircle size={14} />
                <span>Only innings 1 through {actualInnings} will count towards player stats.</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Bulk Set At-Bats (AB)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={bulkAB}
                onChange={(e) => setBulkAB(parseInt(e.target.value) || 0)}
                className="w-24 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg"
              />
              <button
                onClick={applyBulkAB}
                className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold hover:bg-indigo-100 transition-colors text-sm"
              >
                Apply to All Active
              </button>
              <button
                onClick={clearAllABs}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                title="Clear All ABs"
              >
                <RotateCcw size={20} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400">Sets AB for everyone marked as "Played".</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="py-4 font-semibold text-slate-600 text-sm">Player</th>
                <th className="py-4 font-semibold text-slate-600 text-sm">Played?</th>
                <th className="py-4 font-semibold text-slate-600 text-sm">At-Bats (AB)</th>
                <th className="py-4 font-semibold text-slate-600 text-sm">Planned Positions</th>
              </tr>
            </thead>
            <tbody>
              {players.map(player => {
                const stats = playerStats[player.id] || { ab: 0, played: true };
                
                // Get planned positions for the actual innings played
                const planned = [];
                for (let i = 1; i <= actualInnings; i++) {
                  const inning = assignments.byInning[i];
                  let pos = "Bench";
                  if (inning) {
                    for (const [p, pid] of Object.entries(inning)) {
                      if (pid === player.id && p !== 'dugout') {
                        pos = p;
                        break;
                      }
                    }
                  }
                  planned.push(pos);
                }

                return (
                  <tr key={player.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: player.color }}
                        />
                        <span className="font-medium text-slate-700">{player.name}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <button
                        onClick={() => updateStat(player.id, 'played', !stats.played)}
                        className={`p-2 rounded-lg transition-colors ${
                          stats.played 
                            ? 'text-emerald-600 bg-emerald-50' 
                            : 'text-slate-400 bg-slate-100'
                        }`}
                      >
                        <CheckCircle2 size={20} />
                      </button>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateStat(player.id, 'ab', Math.max(0, stats.ab - 1))}
                          disabled={!stats.played}
                          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 disabled:opacity-30 transition-colors"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={stats.ab}
                          onChange={(e) => updateStat(player.id, 'ab', parseInt(e.target.value) || 0)}
                          disabled={!stats.played}
                          className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 text-center font-bold"
                        />
                        <button
                          onClick={() => updateStat(player.id, 'ab', stats.ab + 1)}
                          disabled={!stats.played}
                          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 disabled:opacity-30 transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-1">
                        {planned.map((p, idx) => (
                          <span 
                            key={idx}
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              p === 'Bench' 
                                ? 'bg-slate-50 text-slate-400 border-slate-100' 
                                : 'bg-indigo-50 text-indigo-600 border-indigo-100 font-medium'
                            }`}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex items-start gap-4">
        <div className="p-3 bg-white rounded-xl shadow-sm text-indigo-600">
          <History size={24} />
        </div>
        <div>
          <h3 className="font-bold text-indigo-900">Why log results?</h3>
          <p className="text-indigo-700/80 text-sm mt-1 leading-relaxed">
            Logging actual game data ensures your season-long fairness metrics are accurate. 
            If a game is cut short, players who were scheduled to play the infield in later innings 
            won't be credited for those innings, helping you balance the rotation in the next game.
          </p>
        </div>
      </div>
    </div>
  );
};
