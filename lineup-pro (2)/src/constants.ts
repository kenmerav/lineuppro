export const POSITION_GROUPS = {
  INFIELD: ["C", "P", "1B", "2B", "SS", "3B"],
  OUTFIELD: ["LF", "LCF", "RCF", "RF"],
  BENCH: ["DUGOUT"],
};

export const ALL_POSITIONS = [
  ...POSITION_GROUPS.INFIELD,
  ...POSITION_GROUPS.OUTFIELD,
];

export const PLAYER_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#64748b"
];

export const DEFAULT_SETTINGS = {
  inningsCount: 5,
  allowEmptyOutfield: true,
  requireDugout: true,
  strictSwap: true,
  maxConsecutiveInfield: 2,
  maxConsecutiveOutfield: 2,
  allowSamePositionBackToBack: false,
};
