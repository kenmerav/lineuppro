import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

dotenv.config();

type Player = { id: string; name: string; color: string; active?: boolean };
type TeamBranding = { teamName: string; logoDataUrl?: string; bannerColor?: string };
type Settings = {
  inningsCount: number;
  allowEmptyOutfield: boolean;
  requireDugout: boolean;
  strictSwap: boolean;
  maxConsecutiveInfield: number;
  maxConsecutiveOutfield: number;
  maxConsecutiveBench: number;
  allowSamePositionBackToBack: boolean;
  preventDuplicatePositionInGame: boolean;
  requireEarlyInfieldByInning3: boolean;
};
type Team = {
  id: string;
  ownerId: string;
  name: string;
  branding: TeamBranding;
  settings: Settings;
  roster: Player[];
};
type SavedGame = {
  id: string;
  teamId: string;
  ownerId: string;
  meta: Record<string, unknown>;
  players: Player[];
  battingOrder: string[];
  assignments: Record<string, unknown>;
  settings: Settings;
  branding: TeamBranding;
  log?: Record<string, unknown>;
};
type DraftGameState = {
  teamId: string;
  ownerId: string;
  players: Player[];
  battingOrder: string[];
  assignments: Record<string, unknown>;
  settings: Settings;
  branding: TeamBranding;
  log?: Record<string, unknown>;
  updatedAt: string;
};
type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
};
type AuthedRequest = Request & { userId?: string };
type PersistedStore = {
  users: User[];
  teams: Team[];
  gamesByTeam: Record<string, SavedGame[]>;
  draftsByTeam: Record<string, DraftGameState>;
};
type DbUserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
};
type DbTeamRow = {
  id: string;
  owner_id: string;
  name: string;
  branding: TeamBranding | null;
  settings: Partial<Settings> | null;
  roster: Player[] | null;
};
type DbGameRow = {
  id: string;
  team_id: string;
  owner_id: string;
  meta: Record<string, unknown> | null;
  players: Player[] | null;
  batting_order: string[] | null;
  assignments: Record<string, unknown> | null;
  settings: Partial<Settings> | null;
  branding: TeamBranding | null;
  log: Record<string, unknown> | null;
};
type DbDraftRow = {
  team_id: string;
  owner_id: string;
  players: Player[] | null;
  batting_order: string[] | null;
  assignments: Record<string, unknown> | null;
  settings: Partial<Settings> | null;
  branding: TeamBranding | null;
  log: Record<string, unknown> | null;
  updated_at: string | null;
};

const app = express();
const PORT = Number(process.env.PORT || 5173);
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const TOKEN_COOKIE = "lineup_pro_token";
const IS_PROD = process.env.NODE_ENV === "production";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const supabase = USE_SUPABASE
  ? createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "data");
const STORE_FILE = path.resolve(DATA_DIR, "store.json");

const DEFAULT_SETTINGS: Settings = {
  inningsCount: 5,
  allowEmptyOutfield: true,
  requireDugout: true,
  strictSwap: true,
  maxConsecutiveInfield: 2,
  maxConsecutiveOutfield: 2,
  maxConsecutiveBench: 2,
  allowSamePositionBackToBack: false,
  preventDuplicatePositionInGame: false,
  requireEarlyInfieldByInning3: true,
};

const users = new Map<string, User>();
const teams = new Map<string, Team>();
const gamesByTeam = new Map<string, SavedGame[]>();
const draftsByTeam = new Map<string, DraftGameState>();
let persistChain: Promise<void> = Promise.resolve();

if (!USE_SUPABASE) {
  console.warn("Supabase env vars missing. Falling back to local data/store.json persistence.");
}

const normalizeSettings = (value: Partial<Settings> | null | undefined): Settings => ({
  ...DEFAULT_SETTINGS,
  ...(value || {}),
});

const mapUserRow = (row: DbUserRow): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  passwordHash: row.password_hash,
});

const mapTeamRow = (row: DbTeamRow): Team => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  branding: row.branding || { teamName: row.name || "My Team" },
  settings: normalizeSettings(row.settings),
  roster: Array.isArray(row.roster) ? row.roster : [],
});

const mapGameRow = (row: DbGameRow): SavedGame => ({
  id: row.id,
  teamId: row.team_id,
  ownerId: row.owner_id,
  meta: row.meta || {},
  players: Array.isArray(row.players) ? row.players : [],
  battingOrder: Array.isArray(row.batting_order) ? row.batting_order : [],
  assignments: row.assignments || {},
  settings: normalizeSettings(row.settings),
  branding: row.branding || { teamName: "My Team" },
  log: row.log || undefined,
});

const mapDraftRow = (row: DbDraftRow): DraftGameState => ({
  teamId: row.team_id,
  ownerId: row.owner_id,
  players: Array.isArray(row.players) ? row.players : [],
  battingOrder: Array.isArray(row.batting_order) ? row.batting_order : [],
  assignments: row.assignments || {},
  settings: normalizeSettings(row.settings),
  branding: row.branding || { teamName: "My Team" },
  log: row.log || undefined,
  updatedAt: row.updated_at || new Date().toISOString(),
});

async function loadStore() {
  if (USE_SUPABASE) return;
  try {
    const raw = await fs.readFile(STORE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as PersistedStore;
    users.clear();
    teams.clear();
    gamesByTeam.clear();
    draftsByTeam.clear();

    for (const user of parsed.users || []) users.set(user.id, user);
    for (const team of parsed.teams || []) teams.set(team.id, team);
    for (const [teamId, games] of Object.entries(parsed.gamesByTeam || {})) {
      gamesByTeam.set(teamId, games || []);
    }
    for (const [teamId, draft] of Object.entries(parsed.draftsByTeam || {})) {
      if (draft) draftsByTeam.set(teamId, draft);
    }
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      console.error("Failed to load persisted store:", error);
    }
  }
}

function persistStore() {
  if (USE_SUPABASE) return Promise.resolve();

  persistChain = persistChain.then(async () => {
    const data: PersistedStore = {
      users: [...users.values()],
      teams: [...teams.values()],
      gamesByTeam: Object.fromEntries(gamesByTeam.entries()),
      draftsByTeam: Object.fromEntries(draftsByTeam.entries()),
    };
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
  }).catch((error) => {
    console.error("Failed to persist store:", error);
  });

  return persistChain;
}

await loadStore();

app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

function setAuthCookie(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "14d" });
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });
}

async function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[TOKEN_COOKIE];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: string };
    if (!payload?.sub) return res.status(401).json({ error: "Unauthorized" });

    if (USE_SUPABASE) {
      const { data, error } = await supabase!.from("users").select("id").eq("id", payload.sub).maybeSingle();
      if (error || !data) return res.status(401).json({ error: "Unauthorized" });
    } else if (!users.has(payload.sub)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

async function teamFor(req: AuthedRequest, teamId: string): Promise<Team | null> {
  if (!req.userId) return null;

  if (USE_SUPABASE) {
    const { data, error } = await supabase!
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .eq("owner_id", req.userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapTeamRow(data as DbTeamRow);
  }

  const team = teams.get(teamId);
  if (!team || team.ownerId !== req.userId) return null;
  return team;
}

async function ensureDefaultTeam(userId: string) {
  if (USE_SUPABASE) {
    const { data, error } = await supabase!.from("teams").select("id").eq("owner_id", userId).limit(1);
    if (error) throw error;
    if (data && data.length > 0) return;

    const teamId = crypto.randomUUID();
    const { error: insertError } = await supabase!.from("teams").insert({
      id: teamId,
      owner_id: userId,
      name: "My Team",
      branding: { teamName: "My Team" },
      settings: DEFAULT_SETTINGS,
      roster: [],
    });
    if (insertError) throw insertError;
    return;
  }

  const alreadyHasTeam = [...teams.values()].some((t) => t.ownerId === userId);
  if (alreadyHasTeam) return;
  const teamId = crypto.randomUUID();
  teams.set(teamId, {
    id: teamId,
    ownerId: userId,
    name: "My Team",
    branding: { teamName: "My Team" },
    settings: { ...DEFAULT_SETTINGS },
    roster: [],
  });
  gamesByTeam.set(teamId, []);
}

app.post("/api/auth/register", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!name || !email || password.length < 6) {
    return res.status(400).json({ error: "Name, email, and 6+ char password are required." });
  }

  try {
    if (USE_SUPABASE) {
      const { data: existing, error: existingError } = await supabase!
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return res.status(409).json({ error: "Email already in use." });

      const userId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, 10);
      const { error } = await supabase!.from("users").insert({
        id: userId,
        name,
        email,
        password_hash: passwordHash,
      });
      if (error) throw error;

      await ensureDefaultTeam(userId);
      setAuthCookie(res, userId);
      return res.json({ id: userId, name, email });
    }

    if ([...users.values()].some((u) => u.email === email)) {
      return res.status(409).json({ error: "Email already in use." });
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    users.set(userId, { id: userId, name, email, passwordHash });
    await ensureDefaultTeam(userId);
    await persistStore();
    setAuthCookie(res, userId);
    return res.json({ id: userId, name, email });
  } catch (error) {
    console.error("Register failed", error);
    return res.status(500).json({ error: "Failed to register user." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  try {
    let user: User | null = null;

    if (USE_SUPABASE) {
      const { data, error } = await supabase!.from("users").select("*").eq("email", email).maybeSingle();
      if (error) throw error;
      if (data) user = mapUserRow(data as DbUserRow);
    } else {
      user = [...users.values()].find((u) => u.email === email) || null;
    }

    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials." });

    setAuthCookie(res, user.id);
    return res.json({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    console.error("Login failed", error);
    return res.status(500).json({ error: "Login failed." });
  }
});

app.get("/api/auth/me", auth, async (req: AuthedRequest, res) => {
  try {
    if (USE_SUPABASE) {
      const { data, error } = await supabase!.from("users").select("id,name,email").eq("id", req.userId!).maybeSingle();
      if (error || !data) return res.status(401).json({ error: "Unauthorized" });
      return res.json(data);
    }

    const user = users.get(req.userId!);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    return res.json({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    console.error("Auth check failed", error);
    return res.status(500).json({ error: "Failed to verify session." });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(TOKEN_COOKIE);
  return res.status(204).end();
});

app.get("/api/teams", auth, async (req: AuthedRequest, res) => {
  try {
    if (USE_SUPABASE) {
      const { data, error } = await supabase!.from("teams").select("*").eq("owner_id", req.userId!);
      if (error) throw error;
      return res.json((data || []).map((row) => mapTeamRow(row as DbTeamRow)));
    }

    const userTeams = [...teams.values()].filter((t) => t.ownerId === req.userId);
    return res.json(userTeams);
  } catch (error) {
    console.error("Failed to fetch teams", error);
    return res.status(500).json({ error: "Failed to fetch teams." });
  }
});

app.post("/api/teams", auth, async (req: AuthedRequest, res) => {
  const name = String(req.body?.name || "New Team").trim();
  const teamId = crypto.randomUUID();
  const branding: TeamBranding = req.body?.branding || { teamName: name || "New Team" };
  const settings: Settings = normalizeSettings(req.body?.settings || {});
  const roster: Player[] = Array.isArray(req.body?.roster) ? req.body.roster : [];

  const team: Team = {
    id: teamId,
    ownerId: req.userId!,
    name: name || "New Team",
    branding,
    settings,
    roster,
  };

  try {
    if (USE_SUPABASE) {
      const { error } = await supabase!.from("teams").insert({
        id: team.id,
        owner_id: team.ownerId,
        name: team.name,
        branding: team.branding,
        settings: team.settings,
        roster: team.roster,
      });
      if (error) throw error;
      return res.status(201).json(team);
    }

    teams.set(teamId, team);
    gamesByTeam.set(teamId, []);
    await persistStore();
    return res.status(201).json(team);
  } catch (error) {
    console.error("Failed to create team", error);
    return res.status(500).json({ error: "Failed to create team." });
  }
});

app.put("/api/teams/:teamId", auth, async (req: AuthedRequest, res) => {
  try {
    const team = await teamFor(req, req.params.teamId);
    if (!team) return res.status(404).json({ error: "Team not found" });

    const next: Team = {
      ...team,
      name: String(req.body?.name || team.name),
      branding: req.body?.branding || team.branding,
      settings: normalizeSettings({ ...team.settings, ...(req.body?.settings || {}) }),
      roster: Array.isArray(req.body?.roster) ? req.body.roster : team.roster,
    };

    if (USE_SUPABASE) {
      const { error } = await supabase!
        .from("teams")
        .update({
          name: next.name,
          branding: next.branding,
          settings: next.settings,
          roster: next.roster,
        })
        .eq("id", team.id)
        .eq("owner_id", req.userId!);
      if (error) throw error;
      return res.json(next);
    }

    teams.set(team.id, next);
    await persistStore();
    return res.json(next);
  } catch (error) {
    console.error("Failed to update team", error);
    return res.status(500).json({ error: "Failed to update team." });
  }
});

app.get("/api/teams/:teamId/games", auth, async (req: AuthedRequest, res) => {
  try {
    const team = await teamFor(req, req.params.teamId);
    if (!team) return res.status(404).json({ error: "Team not found" });

    if (USE_SUPABASE) {
      const { data, error } = await supabase!
        .from("games")
        .select("*")
        .eq("team_id", team.id)
        .eq("owner_id", req.userId!);
      if (error) throw error;
      return res.json((data || []).map((row) => mapGameRow(row as DbGameRow)));
    }

    return res.json(gamesByTeam.get(team.id) || []);
  } catch (error) {
    console.error("Failed to fetch games", error);
    return res.status(500).json({ error: "Failed to fetch games." });
  }
});

app.get("/api/teams/:teamId/draft", auth, async (req: AuthedRequest, res) => {
  try {
    const team = await teamFor(req, req.params.teamId);
    if (!team) return res.status(404).json({ error: "Team not found" });

    if (USE_SUPABASE) {
      const { data, error } = await supabase!
        .from("drafts")
        .select("*")
        .eq("team_id", team.id)
        .eq("owner_id", req.userId!)
        .maybeSingle();
      if (error) throw error;
      return res.json(data ? mapDraftRow(data as DbDraftRow) : null);
    }

    return res.json(draftsByTeam.get(team.id) || null);
  } catch (error) {
    console.error("Failed to fetch draft", error);
    return res.status(500).json({ error: "Failed to fetch draft." });
  }
});

app.put("/api/teams/:teamId/draft", auth, async (req: AuthedRequest, res) => {
  try {
    const team = await teamFor(req, req.params.teamId);
    if (!team) return res.status(404).json({ error: "Team not found" });

    const draft: DraftGameState = {
      teamId: team.id,
      ownerId: req.userId!,
      players: Array.isArray(req.body?.players) ? req.body.players : [],
      battingOrder: Array.isArray(req.body?.battingOrder)
        ? req.body.battingOrder
        : Array.isArray(req.body?.batting_order)
          ? req.body.batting_order
          : [],
      assignments: req.body?.assignments || { innings: team.settings.inningsCount, byInning: {} },
      settings: normalizeSettings({ ...team.settings, ...(req.body?.settings || {}) }),
      branding: req.body?.branding || team.branding,
      log: req.body?.log,
      updatedAt: new Date().toISOString(),
    };

    if (USE_SUPABASE) {
      const { error } = await supabase!.from("drafts").upsert({
        team_id: draft.teamId,
        owner_id: draft.ownerId,
        players: draft.players,
        batting_order: draft.battingOrder,
        assignments: draft.assignments,
        settings: draft.settings,
        branding: draft.branding,
        log: draft.log || null,
        updated_at: draft.updatedAt,
      }, { onConflict: "team_id" });
      if (error) throw error;
      return res.json({ ok: true, updatedAt: draft.updatedAt });
    }

    draftsByTeam.set(team.id, draft);
    await persistStore();
    return res.json({ ok: true, updatedAt: draft.updatedAt });
  } catch (error) {
    console.error("Failed to save draft", error);
    return res.status(500).json({ error: "Failed to save draft." });
  }
});

app.post("/api/teams/:teamId/games", auth, async (req: AuthedRequest, res) => {
  try {
    const team = await teamFor(req, req.params.teamId);
    if (!team) return res.status(404).json({ error: "Team not found" });

    const game: SavedGame = {
      id: crypto.randomUUID(),
      teamId: team.id,
      ownerId: req.userId!,
      meta: req.body?.meta || {},
      players: Array.isArray(req.body?.players) ? req.body.players : [],
      battingOrder: Array.isArray(req.body?.battingOrder)
        ? req.body.battingOrder
        : Array.isArray(req.body?.batting_order)
          ? req.body.batting_order
          : [],
      assignments: req.body?.assignments || { innings: team.settings.inningsCount, byInning: {} },
      settings: normalizeSettings({ ...team.settings, ...(req.body?.settings || {}) }),
      branding: req.body?.branding || team.branding,
      log: req.body?.log,
    };

    if (USE_SUPABASE) {
      const { data, error } = await supabase!
        .from("games")
        .insert({
          id: game.id,
          team_id: game.teamId,
          owner_id: game.ownerId,
          meta: game.meta,
          players: game.players,
          batting_order: game.battingOrder,
          assignments: game.assignments,
          settings: game.settings,
          branding: game.branding,
          log: game.log || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return res.status(201).json({ id: data.id });
    }

    const games = gamesByTeam.get(team.id) || [];
    games.push(game);
    gamesByTeam.set(team.id, games);
    await persistStore();
    return res.status(201).json({ id: game.id });
  } catch (error) {
    console.error("Failed to save game", error);
    return res.status(500).json({ error: "Failed to save game." });
  }
});

app.put("/api/teams/:teamId/games/:gameId", auth, async (req: AuthedRequest, res) => {
  try {
    const team = await teamFor(req, req.params.teamId);
    if (!team) return res.status(404).json({ error: "Team not found" });

    if (USE_SUPABASE) {
      const { data: existing, error: existingError } = await supabase!
        .from("games")
        .select("*")
        .eq("id", req.params.gameId)
        .eq("team_id", team.id)
        .eq("owner_id", req.userId!)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) return res.status(404).json({ error: "Game not found" });

      const existingGame = mapGameRow(existing as DbGameRow);
      const updated: SavedGame = {
        ...existingGame,
        meta: req.body?.meta || existingGame.meta,
        players: Array.isArray(req.body?.players) ? req.body.players : existingGame.players,
        battingOrder: Array.isArray(req.body?.battingOrder)
          ? req.body.battingOrder
          : Array.isArray(req.body?.batting_order)
            ? req.body.batting_order
            : existingGame.battingOrder,
        assignments: req.body?.assignments || existingGame.assignments,
        settings: normalizeSettings({ ...existingGame.settings, ...(req.body?.settings || {}) }),
        branding: req.body?.branding || existingGame.branding,
        log: req.body?.log ?? existingGame.log,
      };

      const { data, error } = await supabase!
        .from("games")
        .update({
          meta: updated.meta,
          players: updated.players,
          batting_order: updated.battingOrder,
          assignments: updated.assignments,
          settings: updated.settings,
          branding: updated.branding,
          log: updated.log || null,
        })
        .eq("id", req.params.gameId)
        .eq("team_id", team.id)
        .eq("owner_id", req.userId!)
        .select("*")
        .single();
      if (error) throw error;
      return res.json(mapGameRow(data as DbGameRow));
    }

    const games = gamesByTeam.get(team.id) || [];
    const gameIndex = games.findIndex((g) => g.id === req.params.gameId);
    if (gameIndex === -1) return res.status(404).json({ error: "Game not found" });

    const existing = games[gameIndex];
    const updated: SavedGame = {
      ...existing,
      meta: req.body?.meta || existing.meta,
      players: Array.isArray(req.body?.players) ? req.body.players : existing.players,
      battingOrder: Array.isArray(req.body?.battingOrder)
        ? req.body.battingOrder
        : Array.isArray(req.body?.batting_order)
          ? req.body.batting_order
          : existing.battingOrder,
      assignments: req.body?.assignments || existing.assignments,
      settings: normalizeSettings({ ...existing.settings, ...(req.body?.settings || {}) }),
      branding: req.body?.branding || existing.branding,
      log: req.body?.log ?? existing.log,
    };

    games[gameIndex] = updated;
    gamesByTeam.set(team.id, games);
    await persistStore();
    return res.json(updated);
  } catch (error) {
    console.error("Failed to update game", error);
    return res.status(500).json({ error: "Failed to update game." });
  }
});

app.delete("/api/teams/:teamId/games/:gameId", auth, async (req: AuthedRequest, res) => {
  try {
    const team = await teamFor(req, req.params.teamId);
    if (!team) return res.status(404).json({ error: "Team not found" });

    if (USE_SUPABASE) {
      const { data, error } = await supabase!
        .from("games")
        .delete()
        .eq("id", req.params.gameId)
        .eq("team_id", team.id)
        .eq("owner_id", req.userId!)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) return res.status(404).json({ error: "Game not found" });
      return res.status(204).end();
    }

    const games = gamesByTeam.get(team.id) || [];
    gamesByTeam.set(
      team.id,
      games.filter((g) => g.id !== req.params.gameId),
    );
    await persistStore();
    return res.status(204).end();
  } catch (error) {
    console.error("Failed to delete game", error);
    return res.status(500).json({ error: "Failed to delete game." });
  }
});

if (IS_PROD) {
  const distPath = path.resolve(__dirname, "dist");
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    try {
      const templatePath = path.resolve(__dirname, "index.html");
      const template = await fs.readFile(templatePath, "utf-8");
      const html = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).setHeader("Content-Type", "text/html").end(html);
    } catch (error) {
      next(error);
    }
  });
}

app.listen(PORT, () => {
  console.log(`Lineup Pro server running on http://localhost:${PORT} (${IS_PROD ? "production" : "development"}, ${USE_SUPABASE ? "supabase" : "file-store"})`);
});
