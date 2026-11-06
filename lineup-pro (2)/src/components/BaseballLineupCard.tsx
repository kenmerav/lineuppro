import React from 'react';
import type { Player, DefenseAssignments, TeamBranding, Settings } from '../types';
import { BATTING_ONLY_POSITIONS, getAllPositions } from '../constants';
import { getBattingLineupIds } from '../utils';

interface Props {
  players: Player[];
  battingOrder: string[];
  assignments: DefenseAssignments;
  branding: TeamBranding;
  settings: Settings;
  opponent?: string;
  date?: string;
}

export const BaseballLineupCard: React.FC<Props> = ({ players, battingOrder, assignments, branding, settings, opponent, date }) => {
  const positions = getAllPositions(settings);
  const firstInning = assignments.byInning[1] || { dugout: [] };
  const playerById = new Map(players.map(player => [player.id, player]));
  const starters = new Set(positions.map(position => firstInning[position]).filter(Boolean));
  const initialPosition = (id: string) =>
    [...positions, ...BATTING_ONLY_POSITIONS].find(position => firstInning[position] === id) || '—';
  const reserves = players.filter(player => player.active !== false && !starters.has(player.id));
  const battingLineup = getBattingLineupIds(battingOrder, settings, assignments);
  return (
    <section className="lineup-card mx-auto max-w-3xl bg-white text-slate-950 p-6 print:p-0">
      <header className="flex items-center justify-between gap-4 border-b-4 border-slate-900 pb-4">
        <div className="flex items-center gap-3">
          {branding.logoDataUrl && <img src={branding.logoDataUrl} alt="Team logo" className="h-16 w-16 object-contain" />}
          <div><h1 className="text-2xl font-black uppercase tracking-tight">{branding.teamName || 'Home Team'}</h1>
            <p className="text-xs font-bold uppercase tracking-widest">Official lineup card · {settings.sport === 'baseball' ? 'Middle School Baseball' : 'Little League'}</p></div>
        </div>
        <div className="text-right text-xs"><p>Date: {date || '____________'}</p><p>Opponent: {opponent || '________________'}</p></div>
      </header>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead><tr className="bg-slate-900 text-white"><th className="p-2 text-left">Order</th><th className="p-2 text-left">No.</th><th className="p-2 text-left">Player</th><th className="p-2 text-left">Starting position</th></tr></thead>
        <tbody>{battingLineup.map((id, i) => {
          const player = playerById.get(id);
          return <tr key={id} className="border-b border-slate-300"><td className="p-2 font-bold">{i + 1}</td><td className="p-2">{player?.number || '—'}</td><td className="p-2 font-semibold">{player?.name || 'Unknown player'}</td><td className="p-2">{initialPosition(id)}</td></tr>;
        })}</tbody>
      </table>
      <div className="mt-5 grid grid-cols-2 gap-6 text-xs">
        <div><h2 className="border-b-2 border-slate-900 pb-1 font-black uppercase">Available substitutes / bench</h2>
          {reserves.length ? reserves.map(p => <p key={p.id} className="border-b border-slate-200 py-1">#{p.number || '—'} {p.name}</p>) : <p className="py-2">None listed</p>}
        </div>
        <div><h2 className="border-b-2 border-slate-900 pb-1 font-black uppercase">Game notes / changes</h2>
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-7 border-b border-slate-300" />)}
        </div>
      </div>
      <p className="mt-5 border-t pt-2 text-[10px]">Batting: {settings.battingFormat === 'standard' ? 'Standard' : 'Continuous'} · Confirm the official lineup and substitution rules with the league.</p>
    </section>
  );
};
