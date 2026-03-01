import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, Info, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Player, DefenseAssignments, Settings, GameLog, SavedGame } from '../types';
import { computeFairness, suggestSwapsForFairness, computeSeasonFairness } from '../utils';
import { getContrastColor, cn } from '../lib/utils';

interface AnalyticsTabProps {
  players: Player[];
  assignments: DefenseAssignments;
  settings: Settings;
  gameLog?: GameLog;
  savedGames: SavedGame[];
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ players, assignments, settings, gameLog, savedGames }) => {
  const [view, setView] = useState<'current' | 'season'>('current');
  const metrics = useMemo(() => computeFairness(players, assignments, gameLog), [players, assignments, gameLog]);
  const seasonMetrics = useMemo(() => computeSeasonFairness(savedGames, players), [savedGames, players]);

  const chartData = useMemo(() => {
    if (view === 'current') {
      return players
        .filter(p => metrics.playerStats[p.id])
        .map(p => ({
          name: p.name,
          infield: metrics.playerStats[p.id]?.infield || 0,
          outfield: metrics.playerStats[p.id]?.outfield || 0,
          bench: metrics.playerStats[p.id]?.bench || 0,
          color: p.color
        })).sort((a, b) => b.infield - a.infield);
    } else {
      return players
        .filter(p => seasonMetrics.playerStats[p.id]?.gamesPlayed > 0)
        .map(p => ({
          name: p.name,
          infield: seasonMetrics.playerStats[p.id]?.avgInfieldPerGame || 0,
          outfield: seasonMetrics.playerStats[p.id]?.avgOutfieldPerGame || 0,
          bench: seasonMetrics.playerStats[p.id]?.avgBenchPerGame || 0,
          color: p.color
        })).sort((a, b) => b.infield - a.infield);
    }
  }, [players, metrics, seasonMetrics, view]);

  const warnings = useMemo(() => {
    const list: string[] = [];
    const stats = Object.values(metrics.playerStats);
    if (stats.length > 0) {
      const maxInfield = Math.max(...stats.map(s => (s as any).infield));
      const minInfield = Math.min(...stats.map(s => (s as any).infield));
      if (maxInfield - minInfield > 2) {
        list.push(`Large disparity in infield time: Max ${maxInfield} vs Min ${minInfield}.`);
      }
      
      players.forEach(p => {
        const pStats = metrics.playerStats[p.id];
        if (pStats) {
          Object.entries(pStats.positions).forEach(([pos, count]) => {
            if ((count as number) >= 3 && pos !== 'DUGOUT') {
              list.push(`${p.name} is playing ${pos} ${count} times.`);
            }
          });
          if (pStats.maxStreak > settings.maxConsecutiveInfield) {
            list.push(`${p.name} played infield for ${pStats.maxStreak} consecutive innings.`);
          }
        }
      });
    }
    return list;
  }, [metrics, players, settings.maxConsecutiveInfield]);

  const suggestions = useMemo(() => suggestSwapsForFairness(players, assignments, gameLog), [players, assignments, gameLog]);

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-800">Fairness Analytics</h2>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setView('current')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
              view === 'current' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Current Game
          </button>
          <button
            onClick={() => setView('season')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
              view === 'season' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Season Stats
          </button>
        </div>
      </div>

      {view === 'current' ? (
        <>
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-indigo-800 font-bold text-sm mb-2">
                <Info size={16} />
                Fairness Suggestions
              </div>
              {suggestions.map((s: string, i: number) => (
                <p key={i} className="text-indigo-700 text-sm ml-6">{s}</p>
              ))}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Avg Infield</p>
              <p className="text-2xl font-bold text-slate-800">{metrics.teamStats.avgInfield.toFixed(1)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Infield Range</p>
              <p className="text-2xl font-bold text-slate-800">{metrics.teamStats.minInfield} - {metrics.teamStats.maxInfield}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Std Dev</p>
              <p className="text-2xl font-bold text-slate-800">{metrics.teamStats.stdDevInfield.toFixed(2)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Innings</p>
              <p className="text-2xl font-bold text-slate-800">
                {gameLog ? gameLog.actualInnings : assignments.innings}
                {gameLog && gameLog.actualInnings !== assignments.innings && (
                  <span className="text-sm text-slate-400 font-normal ml-2">
                    (of {assignments.innings})
                  </span>
                )}
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-4">
            <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="font-bold text-indigo-900 text-sm">Season Fairness Logic</h3>
              <p className="text-indigo-700/80 text-xs mt-1 leading-relaxed">
                Averages are calculated based on **games attended**. If a player misses a game, 
                their season average isn't penalized. This helps you ensure everyone gets equal 
                opportunities whenever they show up.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Season Avg Infield/Game</p>
              <p className="text-2xl font-bold text-slate-800">{seasonMetrics.teamStats.avgInfieldPerGame.toFixed(2)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Season Range</p>
              <p className="text-2xl font-bold text-slate-800">{seasonMetrics.teamStats.minInfieldPerGame.toFixed(1)} - {seasonMetrics.teamStats.maxInfieldPerGame.toFixed(1)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Games Saved</p>
              <p className="text-2xl font-bold text-slate-800">{savedGames.length}</p>
            </div>
          </div>
        </>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-2">
            <AlertTriangle size={16} />
            Fairness Warnings
          </div>
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-amber-700 text-sm">
              <div className="w-1 h-1 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <TrendingUp size={18} className="text-indigo-500" />
          {view === 'current' ? 'Infield Innings Distribution' : 'Avg Infield Innings per Game'}
        </h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => [view === 'current' ? value : value.toFixed(2), view === 'current' ? 'Innings' : 'Avg Innings']}
              />
              <Bar dataKey="infield" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Player</th>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                {view === 'current' ? 'Infield' : 'Avg Infield'}
              </th>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                {view === 'current' ? 'Outfield' : 'Avg Outfield'}
              </th>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                {view === 'current' ? 'Bench' : 'Avg Bench'}
              </th>
              {(gameLog || view === 'season') && (
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                  {view === 'current' ? 'AB' : 'Avg AB'}
                </th>
              )}
              {view === 'current' && <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Max Streak</th>}
              {view === 'season' && <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Games</th>}
            </tr>
          </thead>
          <tbody>
            {(players || []).map(p => {
              const s = metrics.playerStats[p.id];
              const ss = seasonMetrics.playerStats[p.id];
              
              if (view === 'season' && (!ss || ss.gamesPlayed === 0)) return null;
              if (view === 'current' && !s) return null;

              return (
                <tr key={p.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="font-semibold text-slate-700">{p.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center font-bold text-slate-800">
                    {view === 'current' ? (s?.infield || 0) : (ss?.avgInfieldPerGame.toFixed(2))}
                  </td>
                  <td className="p-4 text-center text-slate-600">
                    {view === 'current' ? (s?.outfield || 0) : (ss?.avgOutfieldPerGame.toFixed(2))}
                  </td>
                  <td className="p-4 text-center text-slate-600">
                    {view === 'current' ? (s?.bench || 0) : (ss?.avgBenchPerGame.toFixed(2))}
                  </td>
                  {(gameLog || view === 'season') && (
                    <td className="p-4 text-center font-bold text-indigo-600">
                      {view === 'current' ? (gameLog?.playerStats[p.id]?.ab || 0) : (ss?.avgABPerGame.toFixed(2))}
                    </td>
                  )}
                  {view === 'current' && (
                    <td className="p-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-bold",
                        (s?.maxStreak || 0) > settings.maxConsecutiveInfield ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                      )}>
                        {s?.maxStreak || 0}
                      </span>
                    </td>
                  )}
                  {view === 'season' && (
                    <td className="p-4 text-center font-medium text-slate-500">
                      {ss?.gamesPlayed}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
