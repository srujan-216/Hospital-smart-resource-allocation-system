import { Link, useLocation, useNavigate } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { isAdmin, clearAdmin, adminUser } from "../lib/auth";

export function Layout({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const loggedIn = isAdmin();

  function logout() { clearAdmin(); navigate("/"); }

  const navItems: { to: string; label: string; match?: RegExp }[] = [
    { to: "/", label: "Home", match: /^\/$/ },
  ];
  if (loggedIn) {
    navItems.push({ to: "/dashboard/beds", label: "Beds", match: /^\/dashboard\/beds/ });
    navItems.push({ to: "/dashboard/labs", label: "Labs", match: /^\/dashboard\/labs/ });
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Primary header */}
      <header className="bg-surface border-b border-border sticky top-0 z-30 backdrop-blur-sm">
        <div className={`${wide ? "max-w-[1400px]" : "max-w-6xl"} mx-auto px-4 py-3 flex items-center justify-between gap-3`}>
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primaryDark text-white flex items-center justify-center shadow-card">
              <HeartPulse className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-[15px]">Smart Allocation</div>
              <div className="text-[11px] text-muted">Priority · Real-time · Auditable</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(n => {
              const active = n.match ? n.match.test(location.pathname) : location.pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active ? "bg-accentLight text-accent" : "text-inkMuted hover:text-ink hover:bg-surface2"
                  }`}
                >{n.label}</Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {loggedIn ? (
              <>
                <div className="hidden md:flex items-center gap-2 text-xs px-2.5 py-1.5 bg-successLight border border-success/30 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-success pulse-dot" />
                  <span className="font-semibold text-success">{adminUser()}</span>
                  <span className="text-success/70">· Staff</span>
                </div>
                <button onClick={logout} className="btn-ghost text-xs">Sign out</button>
              </>
            ) : (
              <Link to="/login" className="btn-outline text-xs">Staff login</Link>
            )}
          </div>
        </div>

        {/* mobile nav */}
        <nav className="md:hidden border-t border-border bg-surface2/60">
          <div className={`${wide ? "max-w-[1400px]" : "max-w-6xl"} mx-auto px-2 py-1 flex items-center gap-1 overflow-x-auto`}>
            {navItems.map(n => {
              const active = n.match ? n.match.test(location.pathname) : location.pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    active ? "bg-accentLight text-accent" : "text-inkMuted"
                  }`}
                >{n.label}</Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className={`${wide ? "max-w-[1400px]" : "max-w-6xl"} mx-auto px-4 py-6 w-full flex-1`}>
        {children}
      </main>

      <footer className="border-t border-border bg-surface mt-8">
        <div className={`${wide ? "max-w-[1400px]" : "max-w-6xl"} mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap text-[11px] text-muted`}>
          <div>
            <div className="font-semibold text-inkMuted">Allocation is purely algorithmic — Jonker-Volgenant / Hungarian (O(n³)).</div>
            <div className="font-mono mt-1 text-inkMuted">score = urgency × 40 + wait × 20 + vulnerability × 20 + rules × 20</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-inkMuted">FAIR · FAST · AUDITABLE</div>
            <div className="mt-1">{t("no_black_box") as any}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
