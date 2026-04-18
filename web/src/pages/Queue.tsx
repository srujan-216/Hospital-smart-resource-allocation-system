import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type AllocationRow, type Domain, type DomainRow, type QueueEntry, type ResourceRow, type RequestRow } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { ScoreBars } from "../components/ScoreBars";
import { ResourceGrid } from "../components/ResourceGrid";
import { isAdmin } from "../lib/auth";

function minutesSince(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}
function maskName(name: string): string {
  if (!name || name.length < 3) return name;
  return name[0] + "*".repeat(Math.max(1, name.length - 2)) + name[name.length - 1];
}
function maskPhone(phone: string): string {
  if (!phone) return "";
  return phone.replace(/\d(?=\d{4})/g, "•");
}

export function QueuePage() {
  const { domain } = useParams<{ domain: Domain }>();
  const { t } = useI18n();
  const [meta, setMeta] = useState<DomainRow | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [allRequests, setAllRequests] = useState<RequestRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [flashedIds, setFlashedIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    if (!domain) return;
    Promise.all([
      api.queue(domain),
      api.resources(domain),
      api.allocations(domain),
      api.domains(),
      api.requests(domain),
    ])
      .then(([q, r, a, ds, reqs]) => {
        setQueue(q); setResources(r); setAllocations(a); setAllRequests(reqs);
        const found = ds.find(x => x.id === domain);
        if (found) setMeta(found);
        setErr(null);
      })
      .catch(e => setErr(String(e.message || e)));
  }, [domain]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  async function reset() {
    if (!domain) return;
    if (!confirm("Reset demo data for this domain?")) return;
    await api.reset(domain);
    load();
  }

  if (!meta) return <div className="text-sm text-muted py-8 text-center">Loading…</div>;

  const admin = isAdmin();
  const freeResources = resources.filter(r => r.available);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="card-glow flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-4xl">{meta.emoji}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-bold text-lg">{meta.label}</div>
              {admin ? (
                <span className="chip-primary text-[10px]">STAFF VIEW</span>
              ) : (
                <span className="chip-neutral text-[10px]">PUBLIC VIEW</span>
              )}
            </div>
            <div className="text-xs text-muted truncate">{meta.venue}</div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-center">
          <div>
            <div className="stat-num text-ok leading-none">{meta.stats.free}</div>
            <div className="stat-label">{t("free")}</div>
          </div>
          <div>
            <div className="stat-num text-warn leading-none">{meta.stats.waiting}</div>
            <div className="stat-label">{t("waiting")}</div>
          </div>
          <div>
            <div className="stat-num text-brand leading-none">{meta.stats.allocated_today}</div>
            <div className="stat-label">allocated</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Link to={`/d/${domain}/request`} className="btn-outline text-xs">+ {t("submit_request")}</Link>
          {admin && <Link to="/dashboard/beds" className="btn-accent text-xs">Staff dashboard →</Link>}
          {admin && <button onClick={reset} className="btn-ghost text-[11px]">reset demo</button>}
        </div>
      </div>

      {err && <div className="card text-sm text-danger">⚠️ {err}</div>}

      <div className="card-flush px-4 py-3 bg-accentLight/50 border-accent/30 flex items-center gap-3 text-sm">
        <div className="text-xl">⚡</div>
        <div className="flex-1">
          <div className="font-semibold text-accent">Hungarian runs automatically</div>
          <div className="text-[12px] text-inkMuted">Every new request triggers optimal bed matching in the background — no button needed.</div>
        </div>
      </div>

      {!admin && (
        <div className="card-flush px-4 py-3 bg-primaryLight border-primary/20 flex items-center gap-3 text-sm">
          <div className="text-xl">🔒</div>
          <div className="flex-1">
            <div className="font-semibold text-primary">Public view</div>
            <div className="text-[12px] text-inkMuted">Names are masked. Only staff can run the allocator.</div>
          </div>
          <Link to="/login" className="btn-outline text-xs">Staff login</Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
        {/* LEFT — Resource Grid */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="label">Resources</div>
              <div className="text-xs text-muted mt-0.5">Green = free · Grey = in use · flashes on new allocation</div>
            </div>
            <div className="text-[10px] text-muted">⟳ refresh 5s</div>
          </div>
          <ResourceGrid resources={resources} requests={allRequests} flashedIds={flashedIds} />
        </div>

        {/* RIGHT — Queue */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="label">Priority queue</div>
              <div className="text-xs text-muted mt-0.5">Score = urgency × 40 + wait × 20 + vulnerability × 20 + rules × 20</div>
            </div>
            {queue.length > 0 && <div className="chip-accent text-[10px]">{queue.length} waiting</div>}
          </div>

          <div className="space-y-2">
            {queue.length === 0 && (
              <div className="text-center py-10 text-sm text-muted italic border border-dashed border-border rounded-lg bg-surface2/40">
                {t("no_waiting")}
              </div>
            )}
            {queue.map((e, idx) => {
              const waited = minutesSince(e.request.wait_start_at);
              const tone = e.score >= 70 ? "danger" : e.score >= 50 ? "warn" : e.score >= 30 ? "brand" : "muted";
              const toneBorder = {
                danger: "border-danger/40 shadow-[0_0_15px_rgba(220,38,38,0.08)]",
                warn:   "border-warn/40",
                brand:  "border-accent/40",
                muted:  "border-border",
              }[tone];
              const toneText = {
                danger: "text-danger", warn: "text-warn", brand: "text-accent", muted: "text-muted",
              }[tone];
              const toneBg = {
                danger: "bg-dangerLight", warn: "bg-warnLight", brand: "bg-accentLight", muted: "bg-surface2",
              }[tone];
              return (
                <div key={e.request._id} className={`bg-surface2/60 rounded-xl border ${toneBorder} p-3 slide-up`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-14 shrink-0 text-center rounded-lg p-1.5 ${toneBg}`}>
                      <div className="text-[9px] uppercase opacity-70">#{idx + 1}</div>
                      <div className={`text-2xl font-bold tabular-nums ${toneText}`}>{e.score.toFixed(0)}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-semibold truncate">{admin ? e.request.requester_name : maskName(e.request.requester_name)}</div>
                        <div className="text-[10px] text-muted whitespace-nowrap">{waited} min</div>
                      </div>
                      <div className="text-[11px] text-muted truncate mt-0.5">
                        {admin ? e.request.phone : maskPhone(e.request.phone)} · {e.request.city}
                      </div>
                      <div className="text-[12px] text-ink/85 truncate mt-1">{e.request.description}</div>
                      <div className="text-[11px] mt-1.5 text-ink/80 leading-snug italic">{e.why}</div>
                      <div className="mt-2">
                        <ScoreBars breakdown={e.breakdown} compact />
                      </div>
                      {e.request.vulnerability_flags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {e.request.vulnerability_flags.map(f => (
                            <span key={f} className="chip-brand text-[10px]">{t(f as any)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent allocations */}
      {allocations.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <div className="label">Recent allocations</div>
            <div className="chip-neutral text-[10px]">via Hungarian</div>
          </div>
          <div className="space-y-1 max-h-[180px] overflow-auto">
            {allocations.slice(0, 12).map(a => {
              const res = resources.find(r => r._id === a.resource_id);
              return (
                <div key={a._id} className="text-[11px] border border-border rounded-lg bg-surface2 px-2.5 py-1.5 flex items-center gap-2">
                  <span className="chip-accent text-[10px] shrink-0">score {a.score.toFixed(0)}</span>
                  <span className="text-accent font-semibold shrink-0">{res?.name || a.resource_id}</span>
                  <span className="text-muted truncate">· {a.justification}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
