import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
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
  allowSamePositionBackToBack: boolean;
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

const app = express();
const PORT = Number(process.env.PORT || 5173);
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const TOKEN_COOKIE = "lineup_pro_token";
const IS_PROD = process.env.NODE_ENV === "production";
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
  allowSamePositionBackToBack: false,
};

const users = new Map<string, User>();
const teams = new Map<string, Team>();
const gamesByTeam = new Map<string, SavedGame[]>();
const draftsByTeam = new Map<string, DraftGameState>();
let persistChain: Promise<void> = Promise.resolve();

async function loadStore() {
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

function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[TOKEN_COOKIE];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: string };
    if (!payload?.sub || !users.has(payload.sub)) return res.status(401).json({ error: "Unauthorized" });
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function teamFor(req: AuthedRequest, teamId: string) {
  const team = teams.get(teamId);
  if (!team || team.ownerId !== req.userId) return null;
  return team;
}

function ensureDefaultTeam(userId: string) {
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
  if ([...users.values()].some((u) => u.email === email)) {
    return res.status(409).json({ error: "Email already in use." });
  }

  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  users.set(userId, { id: userId, name, email, passwordHash });
  ensureDefaultTeam(userId);
  await persistStore();
  setAuthCookie(res, userId);
  return res.json({ id: userId, name, email });
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const user = [...users.values()].find((u) => u.email === email);
  if (!user) return res.status(401).json({ error: "Invalid credentials." });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials." });

  setAuthCookie(res, user.id);
  return res.json({ id: user.id, name: user.name, email: user.email });
});

app.get("/api/auth/me", auth, (req: AuthedRequest, res) => {
  const user = users.get(req.userId!);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  return res.json({ id: user.id, name: user.name, email: user.email });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(TOKEN_COOKIE);
  return res.status(204).end();
});

app.get("/api/teams", auth, (req: AuthedRequest, res) => {
  const userTeams = [...teams.values()].filter((t) => t.ownerId === req.userId);
  return res.json(userTeams);
});

app.post("/api/teams", auth, async (req: AuthedRequest, res) => {
  const name = String(req.body?.name || "New Team").trim();
  const teamId = crypto.randomUUID();
  const branding: TeamBranding = req.body?.branding || { teamName: name || "New Team" };
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(req.body?.settings || {}) };
  const roster: Player[] = Array.isArray(req.body?.roster) ? req.body.roster : [];

  const team: Team = {
    id: teamId,
    ownerId: req.userId!,
    name: name || "New Team",
    branding,
    settings,
    roster,
  };
  teams.set(teamId, team);
  gamesByTeam.set(teamId, []);
  await persistStore();
  return res.status(201).json(team);
});

app.put("/api/teams/:teamId", auth, async (req: AuthedRequest, res) => {
  const team = teamFor(req, req.params.teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const next: Team = {
    ...team,
    name: String(req.body?.name || team.name),
    branding: req.body?.branding || team.branding,
    settings: req.body?.settings || team.settings,
    roster: Array.isArray(req.body?.roster) ? req.body.roster : team.roster,
  };
  teams.set(team.id, next);
  await persistStore();
  return res.json(next);
});

app.get("/api/teams/:teamId/games", auth, (req: AuthedRequest, res) => {
  const team = teamFor(req, req.params.teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });
  return res.json(gamesByTeam.get(team.id) || []);
});

app.get("/api/teams/:teamId/draft", auth, (req: AuthedRequest, res) => {
  const team = teamFor(req, req.params.teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });
  return res.json(draftsByTeam.get(team.id) || null);
});

app.put("/api/teams/:teamId/draft", auth, async (req: AuthedRequest, res) => {
  const team = teamFor(req, req.params.teamId);
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
    settings: req.body?.settings || team.settings,
    branding: req.body?.branding || team.branding,
    log: req.body?.log,
    updatedAt: new Date().toISOString(),
  };

  draftsByTeam.set(team.id, draft);
  await persistStore();
  return res.json({ ok: true, updatedAt: draft.updatedAt });
});

app.post("/api/teams/:teamId/games", auth, async (req: AuthedRequest, res) => {
  const team = teamFor(req, req.params.teamId);
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
    settings: req.body?.settings || team.settings,
    branding: req.body?.branding || team.branding,
    log: req.body?.log,
  };

  const games = gamesByTeam.get(team.id) || [];
  games.push(game);
  gamesByTeam.set(team.id, games);
  await persistStore();
  return res.status(201).json({ id: game.id });
});

app.put("/api/teams/:teamId/games/:gameId", auth, async (req: AuthedRequest, res) => {
  const team = teamFor(req, req.params.teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });

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
    settings: req.body?.settings || existing.settings,
    branding: req.body?.branding || existing.branding,
    log: req.body?.log ?? existing.log,
  };

  games[gameIndex] = updated;
  gamesByTeam.set(team.id, games);
  await persistStore();
  return res.json(updated);
});

app.delete("/api/teams/:teamId/games/:gameId", auth, async (req: AuthedRequest, res) => {
  const team = teamFor(req, req.params.teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const games = gamesByTeam.get(team.id) || [];
  gamesByTeam.set(
    team.id,
    games.filter((g) => g.id !== req.params.gameId),
  );
  await persistStore();
  return res.status(204).end();
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
  console.log(`Lineup Pro server running on http://localhost:${PORT} (${IS_PROD ? "production" : "development"})`);
});
