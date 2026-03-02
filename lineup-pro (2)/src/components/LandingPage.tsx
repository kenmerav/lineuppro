import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

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

  const features = [
    {
      icon: Users,
      title: "Roster Control",
      description: "Add players fast, manage availability, and keep a clean master roster for every game day.",
    },
    {
      icon: ClipboardList,
      title: "Instant Lineup Planning",
      description: "Set batting orders and build defensive assignments with fewer clicks before first pitch.",
    },
    {
      icon: ShieldCheck,
      title: "Fair Rotation Logic",
      description: "Balance infield, outfield, and bench reps so athletes get consistent opportunities.",
    },
    {
      icon: BarChart3,
      title: "Postgame Analytics",
      description: "Track innings and outcomes over time to guide decisions with real data, not guesswork.",
    },
    {
      icon: Clock3,
      title: "Save Coaching Time",
      description: "Build your lineup quickly and focus more on what matters, coaching the athletes.",
    },
    {
      icon: Target,
      title: "Game-Ready Output",
      description: "Share, print, and communicate assignments clearly with players, assistants, and families.",
    },
  ];

  const steps = [
    "Create your team and import players",
    "Generate and adjust lineup + defensive rotation",
    "Run game day, then review outcomes and trends",
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-16 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute top-40 -right-12 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-10 md:py-14">
        <header className="flex items-center justify-between mb-12 md:mb-16">
          <div className="text-2xl font-black text-white">Lineup Pro</div>
          <div className="flex items-center gap-3">
            {!checkingAuth && isLoggedIn ? (
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-400 transition-colors"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 rounded-xl text-slate-200 hover:bg-white/10 font-semibold">
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3 py-1 text-xs font-semibold text-slate-200">
              <Sparkles size={14} />
              Built for baseball and softball coaches
            </div>
            <h1 className="mt-5 text-4xl md:text-6xl font-black leading-tight text-white">
              Build your lineup quickly.
              <span className="block text-indigo-300">Focus more on coaching athletes.</span>
            </h1>
            <p className="mt-5 text-slate-300 text-lg max-w-xl">
              Plan batting order, defensive rotations, and game-day decisions in one place so you spend less time on logistics and more
              time developing your team.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={isLoggedIn ? "/dashboard" : "/register"}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-500 text-white font-bold hover:bg-indigo-400 transition-colors"
              >
                {isLoggedIn ? "Open dashboard" : "Start free"}
                <ArrowRight size={17} />
              </Link>
              {!isLoggedIn && (
                <Link
                  to="/login"
                  className="px-5 py-3 rounded-xl bg-white/10 border border-white/15 text-white font-bold hover:bg-white/15"
                >
                  I already have an account
                </Link>
              )}
            </div>
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                <div className="text-2xl font-black text-white">5 min</div>
                <div className="text-xs text-slate-300 uppercase tracking-wider">Typical setup</div>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                <div className="text-2xl font-black text-white">1 app</div>
                <div className="text-xs text-slate-300 uppercase tracking-wider">Roster to postgame</div>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                <div className="text-2xl font-black text-white">2 sports</div>
                <div className="text-xs text-slate-300 uppercase tracking-wider">Baseball + softball</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-6 md:p-8 backdrop-blur-sm">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-200">Game-Day Snapshot</p>
            <h2 className="mt-2 text-2xl font-black text-white">Your plan, ready before warmups</h2>
            <div className="mt-6 space-y-3">
              {[
                "Batting order finalized for all innings",
                "Defensive rotation balanced and clear",
                "Bench reps tracked across the game",
                "Printable + shareable plan for staff",
              ].map((line) => (
                <div key={line} className="flex items-start gap-2 text-slate-200">
                  <CheckCircle2 size={18} className="text-emerald-300 mt-0.5" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-20">
          <div className="flex items-center gap-2 mb-5 text-indigo-200">
            <Sparkles size={16} />
            <p className="text-xs font-semibold tracking-widest uppercase">What you get</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-white/15 bg-white/10 p-5">
                <feature.icon className="text-indigo-300" />
                <h3 className="mt-4 font-bold text-white text-lg">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div>
            <h2 className="text-3xl font-black text-white">Simple coaching workflow</h2>
            <p className="mt-3 text-slate-300">Lineup Pro is designed around how baseball and softball coaches actually run game day.</p>
            <div className="mt-6 space-y-3">
              {steps.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 p-3">
                  <div className="h-8 w-8 rounded-full bg-indigo-400/25 text-indigo-200 text-sm font-black flex items-center justify-center">
                    {index + 1}
                  </div>
                  <p className="text-slate-100 font-medium">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-indigo-500/20 to-sky-500/20 p-6">
            <h3 className="text-2xl font-black text-white">Coach-first promise</h3>
            <p className="mt-3 text-slate-200">
              You should not be stuck in spreadsheets during pregame. Use Lineup Pro to get organized fast, then spend your energy where it
              matters most, developing your athletes.
            </p>
            <div className="mt-6">
              <Link
                to={isLoggedIn ? "/dashboard" : "/register"}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-100"
              >
                {isLoggedIn ? "Back to dashboard" : "Create your account"}
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
