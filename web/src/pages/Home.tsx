import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, ArrowRight, ArrowUpRight, BedDouble, HeartPulse, LogIn, ShieldCheck,
  Sparkles, TrendingUp, Users, Zap,
} from "lucide-react";
import { api, type DomainRow } from "../lib/api";
import { isAdmin } from "../lib/auth";

export function HomePage() {
  const [meta, setMeta] = useState<DomainRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const admin = isAdmin();

  useEffect(() => {
    let mounted = true;
    function load() {
      api.domains()
        .then(d => {
          if (!mounted) return;
          setMeta(d.find(x => x.id === "hospital") || null);
          setLoading(false);
          setErr(null);
        })
        .catch(e => mounted && setErr(String(e.message || e)));
    }
    load();
    const id = setInterval(load, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const free = meta?.stats.free ?? 0;
  const waiting = meta?.stats.waiting ?? 0;
  const allocated = meta?.stats.allocated_today ?? 0;
  const total = meta?.stats.total_resources ?? 0;
  const utilization = total > 0 ? Math.round((1 - free / total) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="slide-up">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a2a52] via-primary to-[#0d4980] text-white shadow-pop">
          {/* decorative blobs */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-accent/25 blur-3xl" />
          <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-accent/15 blur-3xl" />
          {/* subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="relative px-6 sm:px-10 py-10 sm:py-14 grid lg:grid-cols-[1.3fr_1fr] gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-sm px-3 py-1 rounded-full mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent pulse-dot" />
                <span className="text-[11px] font-bold tracking-[0.15em]">LIVE · FAIR · FAST · AUDITABLE</span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.02]">
                Every bed.<br /> Every patient.
                <br />
                <span className="text-accent">One fair system.</span>
              </h1>
              <p className="text-white/80 mt-5 max-w-xl text-base sm:text-lg leading-relaxed">
                A hospital admission engine that matches patients to beds <strong className="text-white">automatically</strong>,
                re-shuffles priority rows the instant a high-risk patient arrives, and logs every decision with a reason.
              </p>
              <div className="flex flex-wrap gap-2 mt-7">
                <Link to="/d/hospital/request" className="btn bg-white text-primary hover:bg-white/90 text-sm font-bold shadow-card">
                  <HeartPulse className="w-4 h-4" /> Request a bed
                </Link>
                <Link to="/d/hospital/queue" className="btn bg-white/10 text-white border border-white/30 hover:bg-white/20 text-sm">
                  <Activity className="w-4 h-4" /> Live queue
                </Link>
                {admin ? (
                  <Link to="/dashboard/beds" className="btn bg-accent text-white hover:brightness-110 text-sm font-semibold">
                    <BedDouble className="w-4 h-4" /> Staff dashboard <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link to="/login" className="btn bg-transparent text-white/70 hover:text-white hover:bg-white/10 text-sm">
                    <LogIn className="w-4 h-4" /> Staff login
                  </Link>
                )}
              </div>
            </div>

            {/* Stat panel */}
            <div className="relative">
              <div className="absolute inset-0 bg-white/5 rounded-2xl blur-2xl" />
              <div className="relative grid grid-cols-2 gap-3">
                <HeroStat icon={<BedDouble className="w-4 h-4" />} label="Beds free"  value={loading ? "—" : free} total={total} tone="ok" />
                <HeroStat icon={<Users     className="w-4 h-4" />} label="Waiting"    value={loading ? "—" : waiting}              tone="warn" />
                <HeroStat icon={<Sparkles  className="w-4 h-4" />} label="Allocated"  value={loading ? "—" : allocated}            tone="brand" />
                <HeroStat icon={<TrendingUp className="w-4 h-4" />} label="Utilization" value={loading ? "—" : `${utilization}%`} tone="primary" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {err && (
        <div className="card text-danger text-sm flex items-center gap-2 border-danger/30">
          <span>⚠️</span>
          <span>API unreachable — check that the server is running.</span>
        </div>
      )}

      {/* Venue card */}
      {meta && (
        <section className="slide-up" style={{ animationDelay: "120ms" }}>
          <div className="card">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-accentLight text-accent flex items-center justify-center">
                  <HeartPulse className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="font-bold text-base">{meta.label}</div>
                  <div className="text-xs text-muted">{meta.venue}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/d/hospital/queue" className="btn-outline text-xs">
                  <Activity className="w-3.5 h-3.5" /> Live queue
                </Link>
                <Link to="/d/hospital/request" className="btn-primary text-xs">
                  + New request
                </Link>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-[11px] text-muted mb-1.5">
                <span className="font-semibold uppercase tracking-wider">Bed utilization</span>
                <span className="font-bold tabular-nums text-ink">{utilization}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    utilization >= 90 ? "bg-gradient-to-r from-danger to-warn" :
                    utilization >= 70 ? "bg-warn" : "bg-gradient-to-r from-accent to-success"
                  }`}
                  style={{ width: `${Math.min(100, utilization)}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* USPs */}
      <section className="slide-up" style={{ animationDelay: "200ms" }}>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-bold tracking-tight">Why this isn't just a form</h2>
          <span className="text-[11px] text-muted uppercase tracking-wider">Three things make it smart</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <USPCard
            number="1"
            icon={<Zap className="w-5 h-5" strokeWidth={2.5} />}
            title="URGENT FIRST"
            body="A transparent priority score (urgency · wait · vulnerability · rules) feeds the Hungarian algorithm. Emergencies never wait behind routine admissions."
            tone="danger"
          />
          <USPCard
            number="2"
            icon={<ArrowUpRight className="w-5 h-5" strokeWidth={2.5} />}
            title="AUTO-REALLOCATES"
            body="When a high-risk patient arrives, priority beds fill first. Lower-risk patients auto-shift to regular rows. No button. No manual paperwork."
            tone="brand"
          />
          <USPCard
            number="3"
            icon={<ShieldCheck className="w-5 h-5" strokeWidth={2.5} />}
            title="FULLY AUDITED"
            body="Every move logs who, when, why, and what score. No black-box AI. Staff can always answer 'why did this patient get that bed?'"
            tone="primary"
          />
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="slide-up" style={{ animationDelay: "260ms" }}>
        <div className="rounded-2xl border border-border bg-gradient-to-br from-accentLight/50 via-surface to-primaryLight/40 px-6 py-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center">
              <HeartPulse className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-bold">Need a bed now?</div>
              <div className="text-xs text-muted">Submit in 30 seconds · auto-matched the moment you press Submit.</div>
            </div>
          </div>
          <Link to="/d/hospital/request" className="btn-primary text-sm">
            Request a bed <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function HeroStat({ icon, label, value, total, tone }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  total?: number;
  tone: "ok" | "warn" | "brand" | "primary";
}) {
  const valueTone = {
    ok: "text-green-300", warn: "text-amber-300", brand: "text-teal-300", primary: "text-blue-200",
  }[tone];
  return (
    <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between text-white/70">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
          {icon}
          <span>{label}</span>
        </div>
      </div>
      <div className={`text-3xl font-extrabold tabular-nums mt-2 ${valueTone}`}>
        {value}
        {total != null && typeof value === "number" && <span className="text-white/50 text-lg font-medium"> / {total}</span>}
      </div>
    </div>
  );
}

function USPCard({ number, icon, title, body, tone }: {
  number: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: "danger" | "brand" | "primary";
}) {
  const theme = {
    danger:  { wrap: "from-dangerLight/70 to-surface",  text: "text-danger",  iconBg: "bg-danger text-white" },
    brand:   { wrap: "from-accentLight/70 to-surface",  text: "text-accent",  iconBg: "bg-accent text-white" },
    primary: { wrap: "from-primaryLight/70 to-surface", text: "text-primary", iconBg: "bg-primary text-white" },
  }[tone];
  return (
    <div className={`rounded-2xl border border-border bg-gradient-to-br ${theme.wrap} p-5 transition-all hover:shadow-pop hover:-translate-y-0.5`}>
      <div className="flex items-center gap-2">
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${theme.iconBg} shadow-card`}>
          {icon}
        </div>
        <span className={`text-[10px] font-extrabold tracking-[0.15em] uppercase ${theme.text}`}>#{number}</span>
      </div>
      <div className={`mt-4 font-extrabold text-base tracking-tight ${theme.text}`}>{title}</div>
      <div className="mt-1.5 text-[13px] text-inkMuted leading-relaxed">{body}</div>
    </div>
  );
}
