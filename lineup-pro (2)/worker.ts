import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";

type Player = {
  id: string;
  name: string;
  number?: string;
  walkoutSongName?: string;
  walkoutSongDataUrl?: string;
  walkoutStartSec?: number;
  color: string;
  active?: boolean;
};
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
  customRules: string[];
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

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  JWT_SECRET: string;
  ASSETS: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
};

type Variables = { userId: string };
type AppContext = { Bindings: Env; Variables: Variables };

const TOKEN_COOKIE = "lineup_pro_token";
const SESSION_SECONDS = 14 * 24 * 60 * 60;
const DEFAULT_SETTINGS: Settings = {
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
  customRules: [],
};

const app = new Hono<AppContext>();

const normalizeSettings = (value: Partial<Settings> | null | undefined): Settings => ({
  ...DEFAULT_SETTINGS,
  ...(value || {}),
});

const db = (env: Env): SupabaseClient => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase secrets are missing from the Cloudflare Worker.");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

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

const body = async (request: Request): Promise<Record<string, any>> => request.json().catch(() => ({}));

const setAuthCookie = async (c: any, userId: string) => {
  const token = await sign({ sub: userId, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }, c.env.JWT_SECRET, "HS256");
  setCookie(c, TOKEN_COOKIE, token, {
    httpOnly: true,
    maxAge: SESSION_SECONDS,
    path: "/",
    sameSite: "Lax",
    secure: true,
  });
};

const auth = async (c: any, next: () => Promise<void>) => {
  const token = getCookie(c, TOKEN_COOKIE);
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  try {
    const payload = await verify(token, c.env.JWT_SECRET, "HS256");
    const userId = typeof payload.sub === "string" ? payload.sub : "";
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const { data, error } = await db(c.env).from("users").select("id").eq("id", userId).maybeSingle();
    if (error || !data) return c.json({ error: "Unauthorized" }, 401);

    c.set("userId", userId);
    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
};

const teamFor = async (c: any, teamId: string): Promise<Team | null> => {
  const { data, error } = await db(c.env)
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .eq("owner_id", c.get("userId"))
    .maybeSingle();
  if (error) throw error;
  return data ? mapTeamRow(data as DbTeamRow) : null;
};

const ensureDefaultTeam = async (c: any, userId: string) => {
  const client = db(c.env);
  const { data, error } = await client.from("teams").select("id").eq("owner_id", userId).limit(1);
  if (error) throw error;
  if (data && data.length > 0) return;

  const { error: insertError } = await client.from("teams").insert({
    id: crypto.randomUUID(),
    owner_id: userId,
    name: "My Team",
    branding: { teamName: "My Team" },
    settings: DEFAULT_SETTINGS,
    roster: [],
  });
  if (insertError) throw insertError;
};

const hashPassword = async (c: any, password: string) => {
  const { data, error } = await db(c.env).rpc("hash_lineup_password", { p_password: password });
  if (error || typeof data !== "string") throw error || new Error("Unable to hash password.");
  return data;
};

const validUserForPassword = async (c: any, email: string, password: string) => {
  const { data, error } = await db(c.env).rpc("verify_lineup_password", {
    p_email: email,
    p_password: password,
  });
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] as { id: string; name: string; email: string } : null;
};

app.post("/api/auth/register", async (c) => {
  const payload = await body(c.req.raw);
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  if (!name || !email || password.length < 6) {
    return c.json({ error: "Name, email, and 6+ char password are required." }, 400);
  }

  try {
    const client = db(c.env);
    const { data: existing, error: existingError } = await client.from("users").select("id").eq("email", email).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return c.json({ error: "Email already in use." }, 409);

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(c, password);
    const { error } = await client.from("users").insert({ id: userId, name, email, password_hash: passwordHash });
    if (error) throw error;

    await ensureDefaultTeam(c, userId);
    await setAuthCookie(c, userId);
    return c.json({ id: userId, name, email });
  } catch (error) {
    console.error("Register failed", error);
    return c.json({ error: "Failed to register user." }, 500);
  }
});

app.post("/api/auth/login", async (c) => {
  const payload = await body(c.req.raw);
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");

  try {
    const user = await validUserForPassword(c, email, password);
    if (!user) return c.json({ error: "Invalid credentials." }, 401);

    await setAuthCookie(c, user.id);
    return c.json(user);
  } catch (error) {
    console.error("Login failed", error);
    return c.json({ error: "Login failed." }, 500);
  }
});

app.post("/api/auth/change-password", auth, async (c) => {
  const payload = await body(c.req.raw);
  const currentPassword = String(payload.currentPassword || "");
  const newPassword = String(payload.newPassword || "");
  if (!currentPassword || newPassword.length < 6) {
    return c.json({ error: "Your current password and a new password with 6+ characters are required." }, 400);
  }

  try {
    const userId = c.get("userId") as string;
    const { data: user, error } = await db(c.env).from("users").select("id,name,email").eq("id", userId).maybeSingle();
    if (error || !user) return c.json({ error: "Unauthorized" }, 401);

    const currentUser = await validUserForPassword(c, user.email, currentPassword);
    if (!currentUser) return c.json({ error: "Your current password is incorrect." }, 401);
    const samePasswordUser = await validUserForPassword(c, user.email, newPassword);
    if (samePasswordUser) return c.json({ error: "Choose a password different from your current password." }, 400);

    const passwordHash = await hashPassword(c, newPassword);
    const { error: updateError } = await db(c.env).from("users").update({ password_hash: passwordHash }).eq("id", userId);
    if (updateError) throw updateError;

    await setAuthCookie(c, userId);
    return c.json({ ok: true });
  } catch (error) {
    console.error("Password change failed", error);
    return c.json({ error: "Unable to change password right now." }, 500);
  }
});

app.get("/api/auth/me", auth, async (c) => {
  try {
    const { data, error } = await db(c.env).from("users").select("id,name,email").eq("id", c.get("userId")).maybeSingle();
    if (error || !data) return c.json({ error: "Unauthorized" }, 401);
    return c.json(data);
  } catch (error) {
    console.error("Auth check failed", error);
    return c.json({ error: "Failed to verify session." }, 500);
  }
});

app.post("/api/auth/logout", (c) => {
  deleteCookie(c, TOKEN_COOKIE, { path: "/" });
  return c.body(null, 204);
});

app.get("/api/teams", auth, async (c) => {
  try {
    const { data, error } = await db(c.env).from("teams").select("*").eq("owner_id", c.get("userId"));
    if (error) throw error;
    return c.json((data || []).map((row) => mapTeamRow(row as DbTeamRow)));
  } catch (error) {
    console.error("Failed to fetch teams", error);
    return c.json({ error: "Failed to fetch teams." }, 500);
  }
});

app.post("/api/teams", auth, async (c) => {
  const payload = await body(c.req.raw);
  const name = String(payload.name || "New Team").trim() || "New Team";
  const team: Team = {
    id: crypto.randomUUID(),
    ownerId: c.get("userId"),
    name,
    branding: payload.branding || { teamName: name },
    settings: normalizeSettings(payload.settings || {}),
    roster: Array.isArray(payload.roster) ? payload.roster : [],
  };

  try {
    const { error } = await db(c.env).from("teams").insert({
      id: team.id,
      owner_id: team.ownerId,
      name: team.name,
      branding: team.branding,
      settings: team.settings,
      roster: team.roster,
    });
    if (error) throw error;
    return c.json(team, 201);
  } catch (error) {
    console.error("Failed to create team", error);
    return c.json({ error: "Failed to create team." }, 500);
  }
});

app.put("/api/teams/:teamId", auth, async (c) => {
  try {
    const team = await teamFor(c, c.req.param("teamId"));
    if (!team) return c.json({ error: "Team not found" }, 404);
    const payload = await body(c.req.raw);
    const next: Team = {
      ...team,
      name: String(payload.name || team.name),
      branding: payload.branding || team.branding,
      settings: normalizeSettings({ ...team.settings, ...(payload.settings || {}) }),
      roster: Array.isArray(payload.roster) ? payload.roster : team.roster,
    };
    const { error } = await db(c.env).from("teams").update({
      name: next.name,
      branding: next.branding,
      settings: next.settings,
      roster: next.roster,
    }).eq("id", team.id).eq("owner_id", c.get("userId"));
    if (error) throw error;
    return c.json(next);
  } catch (error) {
    console.error("Failed to update team", error);
    return c.json({ error: "Failed to update team." }, 500);
  }
});

app.get("/api/teams/:teamId/games", auth, async (c) => {
  try {
    const team = await teamFor(c, c.req.param("teamId"));
    if (!team) return c.json({ error: "Team not found" }, 404);
    const { data, error } = await db(c.env).from("games").select("*").eq("team_id", team.id).eq("owner_id", c.get("userId"));
    if (error) throw error;
    return c.json((data || []).map((row) => mapGameRow(row as DbGameRow)));
  } catch (error) {
    console.error("Failed to fetch games", error);
    return c.json({ error: "Failed to fetch games." }, 500);
  }
});

app.get("/api/teams/:teamId/draft", auth, async (c) => {
  try {
    const team = await teamFor(c, c.req.param("teamId"));
    if (!team) return c.json({ error: "Team not found" }, 404);
    const { data, error } = await db(c.env).from("drafts").select("*").eq("team_id", team.id).eq("owner_id", c.get("userId")).maybeSingle();
    if (error) throw error;
    return c.json(data ? mapDraftRow(data as DbDraftRow) : null);
  } catch (error) {
    console.error("Failed to fetch draft", error);
    return c.json({ error: "Failed to fetch draft." }, 500);
  }
});

app.put("/api/teams/:teamId/draft", auth, async (c) => {
  try {
    const team = await teamFor(c, c.req.param("teamId"));
    if (!team) return c.json({ error: "Team not found" }, 404);
    const payload = await body(c.req.raw);
    const draft: DraftGameState = {
      teamId: team.id,
      ownerId: c.get("userId"),
      players: Array.isArray(payload.players) ? payload.players : [],
      battingOrder: Array.isArray(payload.battingOrder) ? payload.battingOrder : Array.isArray(payload.batting_order) ? payload.batting_order : [],
      assignments: payload.assignments || { innings: team.settings.inningsCount, byInning: {} },
      settings: normalizeSettings({ ...team.settings, ...(payload.settings || {}) }),
      branding: payload.branding || team.branding,
      log: payload.log,
      updatedAt: new Date().toISOString(),
    };
    const { error } = await db(c.env).from("drafts").upsert({
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
    return c.json({ ok: true, updatedAt: draft.updatedAt });
  } catch (error) {
    console.error("Failed to save draft", error);
    return c.json({ error: "Failed to save draft." }, 500);
  }
});

app.post("/api/teams/:teamId/games", auth, async (c) => {
  try {
    const team = await teamFor(c, c.req.param("teamId"));
    if (!team) return c.json({ error: "Team not found" }, 404);
    const payload = await body(c.req.raw);
    const game: SavedGame = {
      id: crypto.randomUUID(),
      teamId: team.id,
      ownerId: c.get("userId"),
      meta: payload.meta || {},
      players: Array.isArray(payload.players) ? payload.players : [],
      battingOrder: Array.isArray(payload.battingOrder) ? payload.battingOrder : Array.isArray(payload.batting_order) ? payload.batting_order : [],
      assignments: payload.assignments || { innings: team.settings.inningsCount, byInning: {} },
      settings: normalizeSettings({ ...team.settings, ...(payload.settings || {}) }),
      branding: payload.branding || team.branding,
      log: payload.log,
    };
    const { data, error } = await db(c.env).from("games").insert({
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
    }).select("id").single();
    if (error) throw error;
    return c.json({ id: data.id }, 201);
  } catch (error) {
    console.error("Failed to save game", error);
    return c.json({ error: "Failed to save game." }, 500);
  }
});

app.put("/api/teams/:teamId/games/:gameId", auth, async (c) => {
  try {
    const team = await teamFor(c, c.req.param("teamId"));
    if (!team) return c.json({ error: "Team not found" }, 404);
    const { data: existing, error: existingError } = await db(c.env).from("games").select("*")
      .eq("id", c.req.param("gameId")).eq("team_id", team.id).eq("owner_id", c.get("userId")).maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return c.json({ error: "Game not found" }, 404);

    const payload = await body(c.req.raw);
    const existingGame = mapGameRow(existing as DbGameRow);
    const updated: SavedGame = {
      ...existingGame,
      meta: payload.meta || existingGame.meta,
      players: Array.isArray(payload.players) ? payload.players : existingGame.players,
      battingOrder: Array.isArray(payload.battingOrder) ? payload.battingOrder : Array.isArray(payload.batting_order) ? payload.batting_order : existingGame.battingOrder,
      assignments: payload.assignments || existingGame.assignments,
      settings: normalizeSettings({ ...existingGame.settings, ...(payload.settings || {}) }),
      branding: payload.branding || existingGame.branding,
      log: payload.log ?? existingGame.log,
    };
    const { data, error } = await db(c.env).from("games").update({
      meta: updated.meta,
      players: updated.players,
      batting_order: updated.battingOrder,
      assignments: updated.assignments,
      settings: updated.settings,
      branding: updated.branding,
      log: updated.log || null,
    }).eq("id", updated.id).eq("team_id", team.id).eq("owner_id", c.get("userId")).select("*").single();
    if (error) throw error;
    return c.json(mapGameRow(data as DbGameRow));
  } catch (error) {
    console.error("Failed to update game", error);
    return c.json({ error: "Failed to update game." }, 500);
  }
});

app.delete("/api/teams/:teamId/games/:gameId", auth, async (c) => {
  try {
    const team = await teamFor(c, c.req.param("teamId"));
    if (!team) return c.json({ error: "Team not found" }, 404);
    const { data, error } = await db(c.env).from("games").delete()
      .eq("id", c.req.param("gameId")).eq("team_id", team.id).eq("owner_id", c.get("userId")).select("id");
    if (error) throw error;
    if (!data || data.length === 0) return c.json({ error: "Game not found" }, 404);
    return c.body(null, 204);
  } catch (error) {
    console.error("Failed to delete game", error);
    return c.json({ error: "Failed to delete game." }, 500);
  }
});

app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  scheduled(_controller: unknown, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    // A couple of small daily reads keep the free Supabase project active.
    ctx.waitUntil(
      fetch(`${env.SUPABASE_URL}/rest/v1/users?select=id&limit=1`, {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }).then((response) => {
        if (!response.ok) throw new Error(`Supabase keep-alive failed: ${response.status}`);
      }),
    );
  },
};
