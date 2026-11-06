import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, LogOut, ArrowRight, KeyRound, Trash2, Users } from "lucide-react";
import { getTeamTypeDefaults, getTeamTypeLabel, TEAM_TYPES } from "../constants";
import type { TeamType } from "../types";

type Team = {
  id: string;
  name: string;
  branding: { teamName?: string };
  settings?: { sport?: TeamType };
  roster: Array<{ id: string }>;
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState("");
  const [teamType, setTeamType] = useState<TeamType>("baseball");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const displayTeams = useMemo(() => teams.sort((a, b) => a.name.localeCompare(b.name)), [teams]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok) {
          navigate("/login");
          return;
        }
        const res = await fetch("/api/teams");
        if (!res.ok) throw new Error("Failed to load teams");
        const data = await res.json();
        setTeams(Array.isArray(data) ? data : []);
      } catch {
        setError("Unable to load teams right now.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          settings: getTeamTypeDefaults(teamType),
        }),
      });
      if (!res.ok) throw new Error("Failed to create team");
      const team = await res.json();
      setTeams((prev) => [...prev, team]);
      setName("");
      navigate(`/team/${team.id}`);
    } catch {
      setError("Unable to create team.");
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    navigate("/login");
  };

  const deleteTeam = async (team: Team) => {
    const teamName = team.branding?.teamName || team.name;
    if (!window.confirm(`Delete ${teamName}? This will permanently remove the team, its working lineup, and all saved games.`)) return;

    setDeletingTeamId(team.id);
    setError("");
    try {
      const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete team");
      setTeams((prev) => prev.filter((item) => item.id !== team.id));
    } catch {
      setError(`Unable to delete ${teamName}.`);
    } finally {
      setDeletingTeamId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 font-medium">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Dashboard</h1>
            <p className="text-slate-500 mt-1">Choose a team or create a new one.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/account/password"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-100"
            >
              <KeyRound size={16} />
              Password
            </Link>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-100"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </header>

        <form onSubmit={createTeam} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm mb-8">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Create Team</label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.6fr)_auto]">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Team name (e.g. Coyotes 12U)"
              className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <select
              aria-label="Team type"
              value={teamType}
              onChange={(e) => setTeamType(e.target.value as TeamType)}
              className="p-3 border border-slate-200 rounded-xl bg-white text-slate-700 font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {TEAM_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-60"
            >
              <Plus size={16} />
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </form>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayTeams.map((team) => (
            <article key={team.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-800">{team.branding?.teamName || team.name}</h2>
              <p className="text-slate-500 mt-1">{getTeamTypeLabel(team.settings?.sport)} · Roster size: {team.roster?.length || 0}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-slate-400 text-sm">
                  <Users size={14} />
                  Manage lineup
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => deleteTeam(team)}
                    disabled={deletingTeamId === team.id}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label={`Delete ${team.branding?.teamName || team.name}`}
                    title="Delete team"
                  >
                    <Trash2 size={16} />
                  </button>
                  <Link
                    to={`/team/${team.id}`}
                    className="inline-flex items-center gap-1 text-indigo-600 font-semibold hover:text-indigo-700"
                  >
                    Open
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
};
