import type { AdditionalDefensivePosition, Settings } from "./types";

export const POSITION_GROUPS = {
  INFIELD: ["C", "P", "1B", "2B", "SS", "3B"],
  OUTFIELD: ["LF", "LCF", "RCF", "RF"],
  BENCH: ["DUGOUT"],
};

export const ALL_POSITIONS = [
  ...POSITION_GROUPS.INFIELD,
  ...POSITION_GROUPS.OUTFIELD,
];

const isValidAdditionalPosition = (position: unknown): position is AdditionalDefensivePosition => {
  if (!position || typeof position !== "object") return false;
  const { id, group } = position as AdditionalDefensivePosition;
  return typeof id === "string" && (group === "INFIELD" || group === "OUTFIELD");
};

export const getAdditionalPositions = (settings?: Pick<Settings, "additionalPositions">) => {
  const seen = new Set(ALL_POSITIONS);
  return (settings?.additionalPositions || []).reduce<AdditionalDefensivePosition[]>((positions, position) => {
    if (!isValidAdditionalPosition(position)) return positions;
    const id = position.id.trim().toUpperCase();
    if (!/^[A-Z0-9 -]{1,12}$/.test(id) || seen.has(id)) return positions;
    seen.add(id);
    positions.push({ id, group: position.group });
    return positions;
  }, []);
};

export const getPositionGroups = (settings?: Pick<Settings, "additionalPositions">) => {
  const groups = {
    INFIELD: [...POSITION_GROUPS.INFIELD],
    OUTFIELD: [...POSITION_GROUPS.OUTFIELD],
  };
  getAdditionalPositions(settings).forEach((position) => {
    groups[position.group].push(position.id);
  });
  return groups;
};

export const getAllPositions = (settings?: Pick<Settings, "additionalPositions">) => {
  const groups = getPositionGroups(settings);
  return [...groups.INFIELD, ...groups.OUTFIELD];
};

export const isInfieldPosition = (position: string, settings?: Pick<Settings, "additionalPositions">) =>
  getPositionGroups(settings).INFIELD.includes(position);

export const isOutfieldPosition = (position: string, settings?: Pick<Settings, "additionalPositions">) =>
  getPositionGroups(settings).OUTFIELD.includes(position);

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
  maxConsecutiveBench: 2,
  allowSamePositionBackToBack: false,
  preventDuplicatePositionInGame: true,
  requireEarlyInfieldByInning3: true,
  additionalPositions: [] as AdditionalDefensivePosition[],
  customRules: [] as string[],
};
