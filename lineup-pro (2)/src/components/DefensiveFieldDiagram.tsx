import React from "react";
import { DefenseAssignments, Player } from "../types";

interface DefensiveFieldDiagramProps {
  assignments: DefenseAssignments;
  players: Player[];
  inning: number;
  title?: string;
  className?: string;
  showPlayerNames?: boolean;
  showBenchSummary?: boolean;
}

const POSITION_LAYOUT: Record<string, { x: number; y: number }> = {
  C: { x: 50, y: 90 },
  P: { x: 50, y: 71 },
  "1B": { x: 71, y: 62 },
  "2B": { x: 64, y: 48 },
  SS: { x: 36, y: 48 },
  "3B": { x: 29, y: 62 },
  LF: { x: 16, y: 38 },
  LCF: { x: 35, y: 26 },
  RCF: { x: 65, y: 26 },
  RF: { x: 84, y: 38 },
};

const POSITIONS = ["LF", "LCF", "RCF", "RF", "3B", "SS", "2B", "1B", "P", "C"];

export const DefensiveFieldDiagram: React.FC<DefensiveFieldDiagramProps> = ({
  assignments,
  players,
  inning,
  title,
  className = "",
  showPlayerNames = true,
  showBenchSummary = true,
}) => {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const inningAssignments = assignments.byInning[inning] || { dugout: [] };
  const dugout = inningAssignments.dugout || [];

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>
      {title && <h3 className="text-base font-bold text-slate-800 mb-3">{title}</h3>}

      <div className="relative mx-auto max-w-xl aspect-square rounded-3xl overflow-hidden border border-slate-300 bg-slate-100">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d="M8 62 A42 42 0 0 1 92 62" fill="none" stroke="#9ca3af" strokeWidth="0.6" />
          <path d="M26 66 A24 24 0 0 1 74 66" fill="none" stroke="#9ca3af" strokeWidth="0.6" />
          <line x1="8" y1="62" x2="34" y2="87" stroke="#9ca3af" strokeWidth="0.6" />
          <line x1="92" y1="62" x2="66" y2="87" stroke="#9ca3af" strokeWidth="0.6" />
          <polyline points="50,87 38,75 50,63 62,75 50,87" fill="none" stroke="#9ca3af" strokeWidth="0.6" />
          <line x1="50" y1="87" x2="50" y2="71" stroke="#9ca3af" strokeWidth="0.6" />
          <circle cx="50" cy="71" r="3.9" fill="none" stroke="#9ca3af" strokeWidth="0.6" />
          <line x1="48.4" y1="71" x2="51.6" y2="71" stroke="#9ca3af" strokeWidth="0.7" />
          <polygon points="50,89.2 51.4,87.8 50,86.4 48.6,87.8" fill="none" stroke="#9ca3af" strokeWidth="0.6" />
          <polygon points="38,75 39.4,73.6 38,72.2 36.6,73.6" fill="none" stroke="#9ca3af" strokeWidth="0.6" />
          <polygon points="62,75 63.4,73.6 62,72.2 60.6,73.6" fill="none" stroke="#9ca3af" strokeWidth="0.6" />
          <polygon points="50,63 51.4,61.6 50,60.2 48.6,61.6" fill="none" stroke="#9ca3af" strokeWidth="0.6" />
        </svg>

        {POSITIONS.map((pos) => {
          const placement = POSITION_LAYOUT[pos];
          const playerId = inningAssignments[pos];
          const player = playerId ? playerMap.get(playerId) : null;
          const isAbsent = player?.active === false;
          const label = showPlayerNames ? (player?.name || "Open") : pos;

          return (
            <div
              key={pos}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: `${placement.x}%`, top: `${placement.y}%` }}
            >
              <div
                className={`px-1.5 py-0.5 rounded-md shadow-sm text-[9px] md:text-[10px] font-semibold border border-slate-300 bg-white text-slate-700 min-w-[54px] ${isAbsent ? "opacity-45 grayscale" : ""}`}
                title={`${pos}: ${label}`}
              >
                <div className="uppercase tracking-wide text-[8px] text-slate-500">{pos}</div>
                <div className="truncate max-w-[82px] flex items-center justify-center gap-1">
                  {showPlayerNames && player && (
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: player.color }} />
                  )}
                  <span>{label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showBenchSummary && (
        <div className="mt-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bench / Dugout</p>
          <div className="text-sm text-slate-700 min-h-6">
            {dugout.length > 0
              ? dugout.map((id) => playerMap.get(id)?.name).filter(Boolean).join(", ")
              : "No players in dugout"}
          </div>
        </div>
      )}
    </div>
  );
};
