import React, { useMemo, useState } from "react";
import { Save, FolderOpen, Download, Upload, Trash2, Copy, Search, Calendar, MapPin, FileText } from "lucide-react";
import { SavedGame, GameMeta } from "../types";
import { DEFAULT_SETTINGS } from "../constants";
import { format } from "date-fns";

interface GamesTabProps {
  savedGames: SavedGame[];
  activeGameId: string | null;
  onSave: (meta: GameMeta) => Promise<SavedGame>;
  onUpdate: (gameId: string, meta: GameMeta) => Promise<SavedGame>;
  onLoad: (game: SavedGame) => void;
  onDelete: (id: string) => Promise<void>;
  onImport: (game: SavedGame) => Promise<SavedGame>;
  onNewGame: (keepRoster: boolean) => void;
}

type StatusTone = "success" | "error";

const newDefaultMeta = (): GameMeta => ({
  name: "",
  date: format(new Date(), "yyyy-MM-dd"),
  opponent: "",
  location: "",
  notes: ""
});

const toDateValue = (value?: string) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const byGameDateDesc = (a: SavedGame, b: SavedGame) => toDateValue(b.meta.date) - toDateValue(a.meta.date);

export const GamesTab: React.FC<GamesTabProps> = ({
  savedGames, activeGameId, onSave, onUpdate, onLoad, onDelete, onImport, onNewGame
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isNewGameModal, setIsNewGameModal] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [search, setSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<StatusTone>("success");
  const [meta, setMeta] = useState<GameMeta>(newDefaultMeta());

  const sortedGames = useMemo(() => [...savedGames].sort(byGameDateDesc), [savedGames]);
  const latestGame = sortedGames[0];
  const activeGame = useMemo(
    () => sortedGames.find((game) => game.id === activeGameId) || null,
    [sortedGames, activeGameId]
  );
  const filteredGames = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sortedGames;
    return sortedGames.filter((game) => {
      const name = game.meta.name.toLowerCase();
      const opponent = (game.meta.opponent || "").toLowerCase();
      const location = (game.meta.location || "").toLowerCase();
      return name.includes(needle) || opponent.includes(needle) || location.includes(needle);
    });
  }, [search, sortedGames]);

  const stats = useMemo(() => {
    const totalGames = sortedGames.length;
    const avgRosterSize = totalGames === 0
      ? 0
      : Math.round((sortedGames.reduce((sum, game) => sum + game.players.length, 0) / totalGames) * 10) / 10;
    const opponents = new Set(
      sortedGames
        .map((game) => (game.meta.opponent || "").trim().toLowerCase())
        .filter(Boolean)
    );

    return {
      totalGames,
      avgRosterSize,
      uniqueOpponents: opponents.size
    };
  }, [sortedGames]);

  const showStatus = (message: string, tone: StatusTone) => {
    setStatusMessage(message);
    setStatusTone(tone);
  };

  const withWorkingState = async (work: () => Promise<void>) => {
    setIsWorking(true);
    try {
      await work();
    } finally {
      setIsWorking(false);
    }
  };

  const handleSave = async () => {
    if (!meta.name.trim()) {
      showStatus("Game name is required.", "error");
      return;
    }

    await withWorkingState(async () => {
      try {
        await onSave(meta);
        setIsSaving(false);
        setMeta(newDefaultMeta());
        showStatus("Game saved.", "success");
      } catch (error) {
        showStatus(error instanceof Error ? error.message : "Could not save game.", "error");
      }
    });
  };

  const handleUpdateLoadedGame = async () => {
    if (!activeGame) {
      showStatus("Load a game first, then update it.", "error");
      return;
    }

    await withWorkingState(async () => {
      try {
        await onUpdate(activeGame.id, activeGame.meta);
        showStatus(`Updated "${activeGame.meta.name}".`, "success");
      } catch (error) {
        showStatus(error instanceof Error ? error.message : "Could not update loaded game.", "error");
      }
    });
  };

  const handleQuickSave = async () => {
    await withWorkingState(async () => {
      const now = new Date();
      try {
        await onSave({
          name: `Game ${format(now, "MMM d, yyyy h:mm a")}`,
          date: format(now, "yyyy-MM-dd"),
          opponent: "",
          location: "",
          notes: ""
        });
        showStatus("Quick save complete.", "success");
      } catch (error) {
        showStatus(error instanceof Error ? error.message : "Quick save failed.", "error");
      }
    });
  };

  const handleNewGame = (keepRoster: boolean) => {
    onNewGame(keepRoster);
    setIsNewGameModal(false);
    showStatus("Started a new game setup.", "success");
  };

  const handleLoad = (game: SavedGame) => {
    onLoad(game);
    showStatus(`Loaded "${game.meta.name}".`, "success");
  };

  const handleExport = (game: SavedGame) => {
    const blob = new Blob([JSON.stringify(game, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${game.meta.name.replace(/\s+/g, "_")}_${game.meta.date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus(`Exported "${game.meta.name}".`, "success");
  };

  const normalizeImportedGame = (raw: any): SavedGame => {
    const fallbackDate = format(new Date(), "yyyy-MM-dd");
    return {
      id: typeof raw?.id === "string" ? raw.id : crypto.randomUUID(),
      meta: {
        name: String(raw?.meta?.name || `Imported Game ${format(new Date(), "MMM d")}`),
        date: String(raw?.meta?.date || fallbackDate),
        opponent: String(raw?.meta?.opponent || ""),
        location: String(raw?.meta?.location || ""),
        notes: String(raw?.meta?.notes || "")
      },
      players: Array.isArray(raw?.players) ? raw.players : [],
      battingOrder: Array.isArray(raw?.battingOrder)
        ? raw.battingOrder
        : Array.isArray(raw?.batting_order)
          ? raw.batting_order
          : [],
      assignments: raw?.assignments || { innings: DEFAULT_SETTINGS.inningsCount, byInning: {} },
      settings: raw?.settings || DEFAULT_SETTINGS,
      branding: raw?.branding || { teamName: "Imported Team" },
      log: raw?.log
    };
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await withWorkingState(async () => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const game = normalizeImportedGame(parsed);
        await onImport(game);
        showStatus(`Imported "${game.meta.name}".`, "success");
      } catch {
        showStatus("Invalid game file. Expected exported Lineup Pro JSON.", "error");
      } finally {
        event.target.value = "";
      }
    });
  };

  const handleDelete = async (game: SavedGame) => {
    if (!confirm(`Delete "${game.meta.name}"?`)) return;

    await withWorkingState(async () => {
      try {
        await onDelete(game.id);
        showStatus(`Deleted "${game.meta.name}".`, "success");
      } catch (error) {
        showStatus(error instanceof Error ? error.message : "Could not delete game.", "error");
      }
    });
  };

  const handleDuplicate = async (game: SavedGame) => {
    await withWorkingState(async () => {
      const copiedGame: SavedGame = {
        ...game,
        meta: {
          ...game.meta,
          name: `${game.meta.name} (Copy)`,
          date: format(new Date(), "yyyy-MM-dd")
        }
      };
      try {
        await onImport(copiedGame);
        showStatus(`Duplicated "${game.meta.name}".`, "success");
      } catch (error) {
        showStatus(error instanceof Error ? error.message : "Could not duplicate game.", "error");
      }
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-800">Game Library</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsNewGameModal(true)}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl font-semibold hover:bg-slate-900 transition-colors"
          >
            <FileText size={18} /> New Game
          </button>
          <button
            onClick={handleQuickSave}
            disabled={isWorking}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            <Save size={18} /> Quick Save
          </button>
          <button
            onClick={() => setIsSaving(true)}
            disabled={isWorking}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            <Save size={18} /> Save Details
          </button>
          {activeGame && (
            <button
              onClick={handleUpdateLoadedGame}
              disabled={isWorking}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60"
            >
              <Save size={18} /> Update Loaded Game
            </button>
          )}
          <label className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-semibold hover:bg-slate-200 transition-colors cursor-pointer">
            <Upload size={18} /> Import
            <input type="file" className="hidden" onChange={handleImport} accept=".json" />
          </label>
        </div>
      </div>

      {statusMessage && (
        <div
          className={[
            "text-sm font-semibold rounded-xl px-4 py-2 border",
            statusTone === "success"
              ? "text-emerald-700 bg-emerald-50 border-emerald-100"
              : "text-red-700 bg-red-50 border-red-100"
          ].join(" ")}
        >
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saved Games</p>
          <p className="text-2xl font-black text-slate-800">{stats.totalGames}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Roster Size</p>
          <p className="text-2xl font-black text-slate-800">{stats.avgRosterSize}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unique Opponents</p>
          <p className="text-2xl font-black text-slate-800">{stats.uniqueOpponents}</p>
        </div>
      </div>

      {activeGame && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Loaded Game</p>
            <p className="font-bold text-slate-800">{activeGame.meta.name} <span className="text-slate-500 font-medium">({activeGame.meta.date})</span></p>
          </div>
          <button
            onClick={handleUpdateLoadedGame}
            disabled={isWorking}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-700 transition-colors disabled:opacity-60"
          >
            Save Changes To This Game
          </button>
        </div>
      )}

      {latestGame && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Latest Saved Game</p>
            <p className="font-bold text-slate-800">{latestGame.meta.name} <span className="text-slate-400 font-medium">({latestGame.meta.date})</span></p>
          </div>
          <button
            onClick={() => handleLoad(latestGame)}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 transition-colors"
          >
            Load Latest
          </button>
        </div>
      )}

      {isNewGameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-800">Start New Game?</h3>
              <p className="text-slate-500 text-sm mt-2">This clears current defense assignments and game results.</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => handleNewGame(true)}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
              >
                Keep Current Roster
              </button>
              <button
                onClick={() => handleNewGame(false)}
                className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                Clear Everything
              </button>
              <button
                onClick={() => setIsNewGameModal(false)}
                className="w-full text-slate-400 py-2 text-sm font-medium hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isSaving && (
        <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-md space-y-4">
          <h3 className="font-bold text-slate-800">Save Game Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">Game Name *</label>
              <input
                type="text"
                value={meta.name}
                onChange={(event) => setMeta({ ...meta, name: event.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. Season Opener"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">Date</label>
              <input
                type="date"
                value={meta.date}
                onChange={(event) => setMeta({ ...meta, date: event.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">Opponent</label>
              <input
                type="text"
                value={meta.opponent}
                onChange={(event) => setMeta({ ...meta, opponent: event.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">Location</label>
              <input
                type="text"
                value={meta.location}
                onChange={(event) => setMeta({ ...meta, location: event.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Notes</label>
            <textarea
              value={meta.notes}
              onChange={(event) => setMeta({ ...meta, notes: event.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-20"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsSaving(false)} className="px-4 py-2 text-slate-500 font-semibold hover:bg-slate-50 rounded-xl">Cancel</button>
            <button disabled={isWorking} onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-60">Save Game</button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, opponent, or location..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredGames.map((game) => (
          <div
            key={game.id}
            className={[
              "bg-white p-5 rounded-2xl border shadow-sm transition-colors",
              game.id === activeGameId ? "border-indigo-400" : "border-slate-100 hover:border-indigo-200"
            ].join(" ")}
          >
            <div className="flex justify-between items-start mb-4 gap-2">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{game.meta.name}</h3>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                    <Calendar size={12} /> {game.meta.date}
                  </span>
                  {game.meta.opponent && (
                    <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                      vs {game.meta.opponent}
                    </span>
                  )}
                  {game.id === activeGameId && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100 rounded-full px-2 py-0.5">
                      Loaded
                    </span>
                  )}
                </div>
              </div>
            </div>

            {game.meta.location && (
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <MapPin size={14} /> {game.meta.location}
              </div>
            )}

            <div className="text-xs text-slate-500 mb-4">
              {game.players.length} players, {game.assignments?.innings || 0} innings planned
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-50">
              <button
                onClick={() => handleLoad(game)}
                className="flex items-center gap-1 bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-900 transition-colors"
              >
                Load
              </button>
              <button
                onClick={() => handleExport(game)}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
              >
                <Download size={14} /> Export
              </button>
              <button
                onClick={() => handleDuplicate(game)}
                disabled={isWorking}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors disabled:opacity-60"
              >
                <Copy size={14} /> Duplicate
              </button>
              <button
                onClick={() => handleDelete(game)}
                disabled={isWorking}
                className="flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-60"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        ))}

        {filteredGames.length === 0 && (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <p className="text-slate-400">{savedGames.length === 0 ? "No saved games yet." : "No games match your search."}</p>
          </div>
        )}
      </div>
    </div>
  );
};
