import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, BedDouble, FlaskConical, Home as HomeIcon,
  ListChecks, RotateCcw,
} from "lucide-react";
import { api, type BedsState, type BedUnit, type LabsState, type LabUnit, type RiskLevel, type TransferEvent } from "../lib/api";
import { isAdmin } from "../lib/auth";
import { toast } from "../lib/toast";
import { ResourceBlock } from "../components/dashboard/ResourceBlock";
import { BedUnitTile, LabUnitTile } from "../components/dashboard/ResourceUnit";
import { QueuePanel } from "../components/dashboard/QueuePanel";
import { BedDetailPanel } from "../components/dashboard/BedDetailPanel";
import { LabDetailPanel } from "../components/dashboard/LabDetailPanel";
import { AdmitPatientModal } from "../components/dashboard/AdmitPatientModal";

type Tab = "beds" | "labs";

export function DashboardPage() {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: Tab }>();
  const active: Tab = tab === "labs" ? "labs" : "beds";

  if (!isAdmin()) return <Navigate to="/login" replace state={{ from: `/dashboard/${active}` }} />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-4 items-start">
      {/* Sidebar — top strip on mobile, left rail on lg+ */}
      <aside className="card-flush p-2 lg:p-3 flex lg:flex-col lg:space-y-1 gap-1 lg:gap-0 lg:sticky lg:top-[88px]">
        <div className="hidden lg:block label mb-2 px-2">Dashboard</div>
        <SideLink active={active === "beds"} onClick={() => navigate("/dashboard/beds")} icon={<BedDouble className="w-4 h-4" />} label="Beds" />
        <SideLink active={active === "labs"} onClick={() => navigate("/dashboard/labs")} icon={<FlaskConical className="w-4 h-4" />} label="Labs" />
        <div className="hidden lg:block border-t border-border my-3" />
        <Link to="/d/hospital/queue" className="hidden lg:flex items-center gap-2 px-2 py-1.5 text-[12px] text-muted hover:text-ink hover:bg-surface2 rounded-md transition-colors">
          <ListChecks className="w-4 h-4" /> Intake queue
        </Link>
        <Link to="/" className="hidden lg:flex items-center gap-2 px-2 py-1.5 text-[12px] text-muted hover:text-ink hover:bg-surface2 rounded-md transition-colors">
          <HomeIcon className="w-4 h-4" /> Public home
        </Link>
      </aside>
      {active === "beds" ? <BedsPane /> : <LabsPane />}
    </div>
  );
}

function SideLink({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors lg:w-full ${
        active ? "bg-accentLight text-accent font-semibold" : "text-inkMuted hover:text-ink hover:bg-surface2"
      }`}
    >
      <span className={active ? "text-accent" : ""}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// Hook: react to newly-appearing transfers by emitting toasts + flashing resources
function useTransferFeedback(
  transfers: TransferEvent[] | undefined,
  setFlashIds: (ids: Set<string>) => void,
  nameKind: "bed" | "lab",
) {
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    if (!transfers) return;
    if (!primed.current) {
      // First render — prime the "seen" set so we don't toast for historical events.
      for (const t of transfers) seen.current.add(t._id);
      primed.current = true;
      return;
    }
    const fresh = transfers.filter(t => !seen.current.has(t._id));
    if (fresh.length === 0) return;

    const flashing = new Set<string>();
    for (const t of fresh) {
      seen.current.add(t._id);
      for (const id of t.resource_ids ?? []) flashing.add(id);
      emitToastForTransfer(t, nameKind);
    }
    if (flashing.size > 0) {
      setFlashIds(flashing);
      setTimeout(() => setFlashIds(new Set()), 2400);
    }
  }, [transfers, setFlashIds, nameKind]);
}

function emitToastForTransfer(t: TransferEvent, kind: "bed" | "lab") {
  switch (t.kind) {
    case "bump_to_regular":
      toast("warn", "Priority bump", `${t.patient_name ?? "Patient"} moved to a regular bed to free a priority slot.`);
      break;
    case "upgrade_to_priority":
      toast("success", "Promoted to priority", `${t.patient_name ?? "Patient"} upgraded — ${t.reason}`);
      break;
    case "admit":
      toast("success", kind === "bed" ? "Patient admitted" : "Lab assigned", t.reason);
      break;
    case "discharge":
      toast("info", kind === "bed" ? "Discharged" : "Lab reset", t.reason);
      break;
    case "queue":
      toast("danger", "Added to queue", t.reason);
      break;
    case "preempt_lab":
      toast("danger", "Lab preempted", t.reason);
      break;
    default:
      toast("info", "Transfer", t.reason);
  }
}

// ─────────────────────────────── BEDS PANE ───────────────────────────────

function BedsPane() {
  const [state, setState] = useState<BedsState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "priority" | "regular" | "available" | "occupied">("all");
  const [search, setSearch] = useState("");
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [admitOpen, setAdmitOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.bedsState();
      setState(s);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e.message || "Failed to load beds");
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, [load]);

  useTransferFeedback(state?.transfers, setFlashIds, "bed");

  const selectedBed = state?.beds.find(b => b._id === selectedId) || null;

  const filtered = useMemo(() => {
    if (!state) return [];
    const q = search.trim().toLowerCase();
    return state.beds.filter(b => {
      if (filter === "priority" && b.row !== "priority") return false;
      if (filter === "regular"  && b.row !== "regular")  return false;
      if (filter === "available" && b.status !== "available") return false;
      if (filter === "occupied"  && b.status !== "occupied") return false;
      if (q) {
        const hay = [
          `bed ${b.number}`, b.block, b.patient?.name, b.patient?.patient_id, b.patient?.medical_condition,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [state, filter, search]);

  const blocks = useMemo(() => {
    const order = ["icu", "general", "pediatric", "isolation"];
    const map = new Map<string, BedUnit[]>();
    for (const b of filtered) {
      const arr = map.get(b.block_id) ?? [];
      arr.push(b);
      map.set(b.block_id, arr);
    }
    return order
      .map(id => ({ id, beds: map.get(id) ?? [] }))
      .filter(x => x.beds.length > 0);
  }, [filtered]);

  async function run<T>(p: Promise<T>) {
    setBusy(true); setErr(null);
    try { const out = await p; return out; }
    catch (e: any) { setErr(e?.response?.data?.error || e.message || "Action failed"); return null; }
    finally { setBusy(false); }
  }

  async function changeRisk(r: RiskLevel) {
    if (!selectedBed) return;
    const s = await run(api.changeRisk(selectedBed._id, r));
    if (s) setState(s);
  }
  async function transfer(target: "priority" | "regular") {
    if (!selectedBed) return;
    const s = await run(api.transferBed(selectedBed._id, target));
    if (s) setState(s);
  }
  async function discharge() {
    if (!selectedBed) return;
    const s = await run(api.dischargePatient(selectedBed._id));
    if (s) { setState(s); setSelectedId(null); }
  }

  async function resetDemo() {
    if (!confirm("Reset demo data? All admissions since boot will be cleared.")) return;
    const r = await run(api.reset("hospital"));
    if (r) {
      toast("info", "Demo reset", "Beds and labs restored to seed state.");
      load();
    }
  }

  const totals = useMemo(() => {
    if (!state) return { total: 0, occupied: 0, priorityFree: 0, regularFree: 0, queued: 0, highInQueue: 0 };
    const occupied = state.beds.filter(b => b.status === "occupied").length;
    const priorityFree = state.beds.filter(b => b.row === "priority" && b.status === "available").length;
    const regularFree = state.beds.filter(b => b.row === "regular" && b.status === "available").length;
    const highInQueue = state.queue.filter(p => p.risk_level === "high").length;
    return { total: state.beds.length, occupied, priorityFree, regularFree, queued: state.queue.length, highInQueue };
  }, [state]);

  const globalAlert = totals.highInQueue > 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
      {/* LEFT — blocks */}
      <div className="space-y-4">
        <HeaderBar
          title="Beds"
          stats={[
            { label: "total", value: totals.total },
            { label: "occupied", value: totals.occupied, tone: "warn" },
            { label: "priority free", value: totals.priorityFree, tone: "ok" },
            { label: "regular free", value: totals.regularFree, tone: "brand" },
            { label: "queued", value: totals.queued, tone: "danger" },
          ]}
          onAdmit={() => setAdmitOpen(true)}
          onReset={resetDemo}
          filter={filter}
          setFilter={(f) => setFilter(f as any)}
          filterOptions={[
            { v: "all", label: "All" },
            { v: "priority", label: "Priority" },
            { v: "regular", label: "Regular" },
            { v: "available", label: "Available" },
            { v: "occupied", label: "Occupied" },
          ]}
          search={search}
          setSearch={setSearch}
          searchPlaceholder="Patient / bed / ID…"
        />

        {globalAlert && (
          <div className="rounded-xl border border-danger/40 bg-gradient-to-br from-dangerLight to-surface px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-danger text-sm">{totals.highInQueue} high-risk patient{totals.highInQueue > 1 ? "s" : ""} waiting</div>
              <div className="text-[12px] text-inkMuted mt-0.5">
                No priority beds available to bump into. Discharge a lower-risk patient or wait for a slot to free up.
              </div>
            </div>
          </div>
        )}

        {err && <div className="card text-sm text-danger">⚠️ {err}</div>}

        {!state && <div className="card text-sm text-muted">Loading…</div>}

        {blocks.length === 0 && state && (
          <div className="card text-sm text-muted italic py-10 text-center">
            No beds match the current filter.
          </div>
        )}

        {blocks.map(({ id, beds }) => {
          const blockName = beds[0]?.block || id;
          const occupied = beds.filter(b => b.status === "occupied").length;
          const priorityCount = beds.filter(b => b.row === "priority").length;
          const priorityBeds = beds.filter(b => b.row === "priority");
          const regularBeds = beds.filter(b => b.row === "regular");
          const priorityFreeHere = priorityBeds.filter(b => b.status === "available").length;
          const isTight = priorityFreeHere === 0 && priorityCount > 0;
          const hasHighHere = priorityBeds.some(b => b.patient?.risk_level === "high");
          return (
            <ResourceBlock
              key={id}
              title={blockName}
              emoji="🛏"
              tone={isTight ? "danger" : "default"}
              stats={[
                { label: "total", value: beds.length },
                { label: "occupied", value: occupied, tone: "warn" },
                { label: "priority free", value: priorityFreeHere, tone: isTight ? "danger" : "ok" },
              ]}
            >
              {isTight && (
                <div className="mb-3 rounded-lg border border-warn/40 bg-warnLight/60 px-3 py-2 flex items-center gap-2 text-[12px]">
                  <AlertTriangle className="w-4 h-4 text-warn shrink-0" />
                  <span className="text-warn font-semibold">Priority row is full.</span>
                  <span className="text-inkMuted">
                    {hasHighHere
                      ? "Next high-risk admission must wait or bump someone."
                      : "Next high-risk admission will bump a lower-risk occupant."}
                  </span>
                </div>
              )}
              {priorityBeds.length > 0 && (
                <BedRowGroup
                  label="Priority row"
                  beds={priorityBeds}
                  selectedId={selectedId}
                  flashIds={flashIds}
                  onPick={b => setSelectedId(b._id)}
                />
              )}
              {regularBeds.length > 0 && (
                <BedRowGroup
                  label="Regular row"
                  beds={regularBeds}
                  selectedId={selectedId}
                  flashIds={flashIds}
                  onPick={b => setSelectedId(b._id)}
                  className="mt-3"
                />
              )}
            </ResourceBlock>
          );
        })}
      </div>

      {/* RIGHT — queue or detail */}
      <aside className="card xl:sticky xl:top-[88px] xl:self-start xl:max-h-[calc(100vh-110px)] xl:overflow-auto">
        {!selectedBed ? (
          <QueuePanel
            queue={state?.queue || []}
            transfers={state?.transfers || []}
            emptyHint="No patients waiting."
            subtitle="High-risk patients bumped or waiting for a priority bed."
          />
        ) : (
          <BedDetailPanel
            bed={selectedBed}
            busy={busy}
            err={err}
            onBack={() => setSelectedId(null)}
            onChangeRisk={changeRisk}
            onTransfer={transfer}
            onDischarge={discharge}
          />
        )}
      </aside>

      <AdmitPatientModal
        open={admitOpen}
        busy={busy}
        onClose={() => setAdmitOpen(false)}
        onSubmit={async (payload) => {
          const s = await run(api.admitPatient({
            name: payload.name,
            medical_condition: payload.medical_condition,
            risk_level: payload.risk_level,
            preferred_block: payload.preferred_block,
          }));
          if (s) setState(s);
        }}
      />
    </div>
  );
}

function BedRowGroup({
  label, beds, selectedId, flashIds, onPick, className,
}: {
  label: string;
  beds: BedUnit[];
  selectedId: string | null;
  flashIds: Set<string>;
  onPick: (b: BedUnit) => void;
  className?: string;
}) {
  const free = beds.filter(b => b.status === "available").length;
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">{label}</div>
        <div className="text-[10px] text-muted">{free} free · {beds.length - free} occupied</div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
        {beds.map(b => (
          <BedUnitTile
            key={b._id}
            bed={b}
            flashing={flashIds.has(b._id)}
            selected={selectedId === b._id}
            onClick={() => onPick(b)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────── LABS PANE ───────────────────────────────

function LabsPane() {
  const [state, setState] = useState<LabsState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "available" | "in_use" | "maintenance" | "emergency">("all");
  const [search, setSearch] = useState("");
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const s = await api.labsState();
      setState(s);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e.message || "Failed to load labs");
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, [load]);

  useTransferFeedback(state?.transfers, setFlashIds, "lab");

  const selectedLab = state?.labs.find(l => l._id === selectedId) || null;

  const filtered = useMemo(() => {
    if (!state) return [];
    const q = search.trim().toLowerCase();
    return state.labs.filter(l => {
      if (filter === "emergency" && !l.emergency) return false;
      if (filter !== "all" && filter !== "emergency" && l.status !== filter) return false;
      if (q) {
        const hay = [l.lab_id, l.block, l.room_no, l.assigned_to].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [state, filter, search]);

  const blocks = useMemo(() => {
    const order = ["pathology", "microbiology", "biochemistry", "immunology", "radiology", "toxicology"];
    const map = new Map<string, LabUnit[]>();
    for (const l of filtered) {
      const arr = map.get(l.block_id) ?? [];
      arr.push(l);
      map.set(l.block_id, arr);
    }
    return order.map(id => ({ id, labs: map.get(id) ?? [] })).filter(x => x.labs.length > 0);
  }, [filtered]);

  async function run<T>(p: Promise<T>) {
    setBusy(true); setErr(null);
    try { return await p; }
    catch (e: any) { setErr(e?.response?.data?.error || e.message || "Action failed"); return null; }
    finally { setBusy(false); }
  }

  async function resetDemo() {
    if (!confirm("Reset demo data? All admissions since boot will be cleared.")) return;
    const r = await run(api.reset("hospital"));
    if (r) {
      toast("info", "Demo reset", "Beds and labs restored to seed state.");
      load();
    }
  }

  const totals = useMemo(() => {
    if (!state) return { total: 0, available: 0, inUse: 0, maintenance: 0, emergency: 0, queued: 0 };
    return {
      total: state.labs.length,
      available: state.labs.filter(l => l.status === "available").length,
      inUse: state.labs.filter(l => l.status === "in_use").length,
      maintenance: state.labs.filter(l => l.status === "maintenance").length,
      emergency: state.labs.filter(l => l.emergency).length,
      queued: state.queue.length,
    };
  }, [state]);

  const allBusy = state && state.labs.every(l => l.status !== "available");

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
      <div className="space-y-4">
        <HeaderBar
          title="Labs"
          stats={[
            { label: "total", value: totals.total },
            { label: "available", value: totals.available, tone: "ok" },
            { label: "in use", value: totals.inUse, tone: "brand" },
            { label: "maintenance", value: totals.maintenance, tone: "warn" },
            { label: "emergency", value: totals.emergency, tone: "danger" },
          ]}
          filter={filter}
          setFilter={(f) => setFilter(f as any)}
          onReset={resetDemo}
          filterOptions={[
            { v: "all", label: "All" },
            { v: "available", label: "Available" },
            { v: "in_use", label: "In use" },
            { v: "maintenance", label: "Maintenance" },
            { v: "emergency", label: "Emergency" },
          ]}
          search={search}
          setSearch={setSearch}
          searchPlaceholder="Lab ID / room / block…"
        />

        {allBusy && (
          <div className="rounded-xl border border-danger/40 bg-gradient-to-br from-dangerLight to-surface px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-danger text-sm">No labs available</div>
              <div className="text-[12px] text-inkMuted mt-0.5">
                Every lab is in use or under maintenance. Enable emergency mode on a lab to preempt a test.
              </div>
            </div>
          </div>
        )}

        {err && <div className="card text-sm text-danger">⚠️ {err}</div>}

        {!state && <div className="card text-sm text-muted">Loading…</div>}

        {blocks.map(({ id, labs }) => {
          const block = labs[0]?.block || id;
          const free = labs.filter(l => l.status === "available").length;
          const busyCount = labs.filter(l => l.status === "in_use").length;
          const maint = labs.filter(l => l.status === "maintenance").length;
          const isTight = free === 0 && labs.length > 0;
          return (
            <ResourceBlock
              key={id}
              title={block}
              emoji="🧪"
              tone={isTight ? "danger" : "default"}
              stats={[
                { label: "total", value: labs.length },
                { label: "free", value: free, tone: isTight ? "danger" : "ok" },
                { label: "busy", value: busyCount, tone: "brand" },
                { label: "maint", value: maint, tone: "warn" },
              ]}
            >
              {isTight && (
                <div className="mb-3 rounded-lg border border-warn/40 bg-warnLight/60 px-3 py-2 flex items-center gap-2 text-[12px]">
                  <AlertTriangle className="w-4 h-4 text-warn shrink-0" />
                  <span className="text-warn font-semibold">No free lab in this block.</span>
                  <span className="text-inkMuted">Emergency mode will preempt the current test.</span>
                </div>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(62px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
                {labs.map(l => (
                  <LabUnitTile
                    key={l._id}
                    lab={l}
                    flashing={flashIds.has(l._id)}
                    selected={selectedId === l._id}
                    onClick={() => setSelectedId(l._id)}
                  />
                ))}
              </div>
            </ResourceBlock>
          );
        })}
      </div>

      <aside className="card xl:sticky xl:top-[88px] xl:self-start xl:max-h-[calc(100vh-110px)] xl:overflow-auto">
        {!selectedLab ? (
          <QueuePanel
            title="Lab queue"
            subtitle="Tests preempted or waiting for a free lab."
            queue={state?.queue || []}
            transfers={state?.transfers || []}
            emptyHint="No tests waiting."
          />
        ) : (
          <LabDetailPanel
            lab={selectedLab}
            busy={busy}
            err={err}
            onBack={() => setSelectedId(null)}
            onToggleEmergency={async () => { const s = await run(api.labToggleEmergency(selectedLab._id)); if (s) setState(s); }}
            onToggleMaintenance={async () => { const s = await run(api.labToggleMaintenance(selectedLab._id)); if (s) setState(s); }}
            onAssign={async (patient_name, request_type) => { const s = await run(api.labAssign(selectedLab._id, { patient_name, request_type })); if (s) setState(s); }}
            onReset={async () => { const s = await run(api.labReset(selectedLab._id)); if (s) setState(s); }}
          />
        )}
      </aside>
    </div>
  );
}

// ─────────────────────────────── shared header bar ───────────────────────────────

function HeaderBar({
  title, stats, filter, setFilter, filterOptions, search, setSearch, searchPlaceholder, onAdmit, onReset,
}: {
  title: string;
  stats: { label: string; value: string | number; tone?: "ok" | "warn" | "danger" | "brand" }[];
  filter: string;
  setFilter: (v: string) => void;
  filterOptions: { v: string; label: string }[];
  search: string;
  setSearch: (v: string) => void;
  searchPlaceholder?: string;
  onAdmit?: () => void;
  onReset?: () => void;
}) {
  const toneClass = (t?: string) =>
    t === "ok" ? "text-ok" : t === "warn" ? "text-warn" : t === "danger" ? "text-danger" : t === "brand" ? "text-accent" : "text-ink";
  return (
    <div className="card-glow flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-bold text-lg">{title}</div>
          <span className="chip-primary text-[10px]">STAFF</span>
          <span className="chip-brand text-[10px]">HUNGARIAN · implicit</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted mt-1 flex-wrap">
          {stats.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <span className={`tabular-nums font-bold ${toneClass(s.tone)}`}>{s.value}</span>
              <span>{s.label}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={searchPlaceholder || "Search…"}
          className="input text-xs max-w-[200px]"
        />
        <div className="flex flex-wrap gap-1">
          {filterOptions.map(opt => (
            <button
              key={opt.v}
              onClick={() => setFilter(opt.v)}
              className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                filter === opt.v
                  ? "bg-accentLight border-accent text-accent font-semibold"
                  : "bg-surface border-border text-muted hover:text-ink"
              }`}
            >{opt.label}</button>
          ))}
        </div>
        {onAdmit && <button onClick={onAdmit} className="btn-primary text-xs">+ Admit patient</button>}
        {onReset && (
          <button onClick={onReset} className="btn-ghost text-xs border border-border" title="Reset demo data">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>
    </div>
  );
}
