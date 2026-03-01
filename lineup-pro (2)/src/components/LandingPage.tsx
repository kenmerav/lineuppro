import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Users, BarChart3 } from "lucide-react";

export const LandingPage: React.FC = () => {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/auth/me");
        setIsLoggedIn(res.ok);
      } catch {
        setIsLoggedIn(false);
      } finally {
        setCheckingAuth(false);
      }
    };
    run();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <header className="flex items-center justify-between mb-16">
          <div className="text-2xl font-black text-slate-900">Lineup Pro</div>
          <div className="flex items-center gap-3">
            {!checkingAuth && isLoggedIn ? (
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold">
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-black transition-colors"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="text-center max-w-3xl mx-auto mb-14">
          <h1 className="text-5xl font-black text-slate-900 leading-tight">
            Build fair softball lineups in minutes.
          </h1>
          <p className="text-slate-600 mt-6 text-lg">
            Manage your roster, batting order, defensive rotations, and game history in one place.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              to="/register"
              className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
            >
              Start free
            </Link>
            <Link to="/login" className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold">
              I already have an account
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <Users className="text-indigo-600" />
            <h2 className="mt-4 font-bold text-slate-800">Roster Tools</h2>
            <p className="mt-2 text-sm text-slate-600">Quickly add players, activate/deactivate, and maintain a master roster.</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <ShieldCheck className="text-indigo-600" />
            <h2 className="mt-4 font-bold text-slate-800">Defense Rotation</h2>
            <p className="mt-2 text-sm text-slate-600">Auto-generate positions with fairness-focused constraints across innings.</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <BarChart3 className="text-indigo-600" />
            <h2 className="mt-4 font-bold text-slate-800">Season Analytics</h2>
            <p className="mt-2 text-sm text-slate-600">Track infield/outfield/bench distribution and game-level stats over time.</p>
          </div>
        </section>
      </div>
    </div>
  );
};
