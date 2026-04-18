import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { HeartPulse, Lock, User, ArrowRight } from "lucide-react";
import { api } from "../lib/api";
import { setAdminToken, isAdmin } from "../lib/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("hackathon2026");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (isAdmin()) {
    navigate("/dashboard/beds", { replace: true });
    return null;
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const r = await api.login(username, password);
      setAdminToken(r.token, r.username);
      const redirectTo = (location.state as any)?.from || "/dashboard/beds";
      navigate(redirectTo, { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Login failed. Check username and password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-180px)] grid lg:grid-cols-2 gap-0 -mx-4 overflow-hidden">
      {/* Left promo panel (hidden on mobile) */}
      <div className="hidden lg:block relative bg-gradient-to-br from-[#0a2a52] via-primary to-[#0d4980] text-white overflow-hidden">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-accent/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div className="relative h-full flex flex-col justify-between p-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent pulse-dot" />
              <span className="text-[10px] font-bold tracking-[0.15em]">STAFF PORTAL</span>
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight leading-[1.05]">
              Smart Bed<br />Allocation
            </h2>
            <p className="text-white/70 mt-4 max-w-sm text-sm leading-relaxed">
              Priority-aware hospital bed and lab management.
              <br /> Hungarian runs automatically. Every decision is logged.
            </p>
          </div>
          <div className="space-y-3 max-w-sm">
            <BulletPoint text="One click reveals every patient's priority score and reason." />
            <BulletPoint text="High-risk arrivals auto-bump lower-risk priority occupants." />
            <BulletPoint text="Lab assignments preempt under emergency mode." />
          </div>
          <div className="text-[11px] text-white/50">
            Powered by Jonker–Volgenant · O(n³) · 100% transparent scoring
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center px-4 py-10 sm:py-16 bg-bg">
        <div className="w-full max-w-sm slide-up">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primaryDark text-white flex items-center justify-center shadow-card">
              <HeartPulse className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div className="font-bold text-base">Smart Allocation</div>
          </Link>

          <h1 className="text-2xl font-extrabold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted mt-1 mb-6">
            Staff only. Citizens can submit requests without logging in.
          </p>

          <form onSubmit={login} className="space-y-3">
            <div>
              <label className="label mb-1 block">Username</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  className="input-lg pl-9"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>
            <div>
              <label className="label mb-1 block">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  className="input-lg pl-9"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </div>
            {err && (
              <div className="rounded-md bg-dangerLight border border-danger/30 text-danger text-sm px-3 py-2">
                {err}
              </div>
            )}
            <button className="btn-primary-lg w-full" disabled={submitting}>
              {submitting ? (
                <><span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-5 rounded-lg bg-gradient-to-br from-accentLight/60 to-surface border border-accent/20 text-[12px] px-3 py-2.5 text-inkMuted">
            <div className="font-semibold text-ink mb-0.5">Demo credentials</div>
            <div>Username <span className="kbd">admin</span> · Password <span className="kbd">hackathon2026</span></div>
          </div>

          <div className="mt-5 text-center text-[12px]">
            <Link to="/" className="text-accent hover:underline">← Back to public home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function BulletPoint({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center shrink-0 text-[11px] font-bold">✓</div>
      <div className="text-[13px] text-white/80 leading-snug">{text}</div>
    </div>
  );
}
