import { useState } from "react";
import type { LabUnit } from "../../lib/api";

export function LabDetailPanel({
  lab, onBack, onToggleEmergency, onToggleMaintenance, onAssign, onReset, busy, err,
}: {
  lab: LabUnit;
  onBack: () => void;
  onToggleEmergency: () => void;
  onToggleMaintenance: () => void;
  onAssign: (patient_name: string, request_type: string) => void;
  onReset: () => void;
  busy?: boolean;
  err?: string | null;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [pname, setPname] = useState("");
  const [rtype, setRtype] = useState("");

  const statusChip =
    lab.status === "maintenance" ? "chip-danger" :
    lab.status === "in_use"     ? "chip-success" : "chip-brand";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-muted hover:text-ink inline-flex items-center gap-1">
          ← Queue
        </button>
        <span className={`chip ${statusChip} text-[10px] uppercase`}>
          {lab.status.replace("_", " ")}
        </span>
      </div>

      <div className="card-flush p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-lg bg-accentLight text-accent flex items-center justify-center font-extrabold text-lg">
            {lab.number}
          </div>
          <div>
            <div className="font-bold text-sm">{lab.lab_id}</div>
            <div className="text-[11px] text-muted">{lab.block}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <div className="text-[10px] text-muted">Lab type</div>
            <div className="font-semibold text-ink">{lab.block}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted">Room</div>
            <div className="font-semibold font-mono">#{lab.room_no}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted">Assigned to</div>
            <div className="text-ink truncate">{lab.assigned_to || "—"}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted">Since</div>
            <div className="text-inkMuted">{lab.assigned_at ? new Date(lab.assigned_at).toLocaleTimeString() : "—"}</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="label">Controls</div>

        <button
          disabled={busy}
          onClick={onToggleEmergency}
          className={`w-full rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-colors ${
            lab.emergency
              ? "border-danger bg-dangerLight text-danger"
              : "border-border text-inkMuted hover:border-danger hover:text-danger"
          }`}
        >
          ⚠ Emergency handling: {lab.emergency ? "ON" : "OFF"}
        </button>

        <button
          disabled={busy}
          onClick={onToggleMaintenance}
          className={`w-full rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-colors ${
            lab.status === "maintenance"
              ? "border-warn bg-warnLight text-warn"
              : "border-border text-inkMuted hover:border-warn hover:text-warn"
          }`}
        >
          🛠 Maintenance: {lab.status === "maintenance" ? "ON" : "OFF"}
        </button>

        {!assignOpen ? (
          <button
            disabled={busy || lab.status === "maintenance"}
            onClick={() => setAssignOpen(true)}
            className="btn-primary w-full text-xs"
          >
            + Assign patient / test
          </button>
        ) : (
          <div className="card-flush p-3 space-y-2">
            <input className="input" placeholder="Patient name" value={pname} onChange={e => setPname(e.target.value)} />
            <input className="input" placeholder="Request type (e.g. CBC, MRI)" value={rtype} onChange={e => setRtype(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-outline text-xs flex-1" onClick={() => { setAssignOpen(false); setPname(""); setRtype(""); }}>Cancel</button>
              <button
                disabled={busy || !pname.trim() || !rtype.trim()}
                onClick={() => { onAssign(pname.trim(), rtype.trim()); setAssignOpen(false); setPname(""); setRtype(""); }}
                className="btn-primary text-xs flex-1"
              >Confirm</button>
            </div>
          </div>
        )}

        <button
          disabled={busy || lab.status === "available"}
          onClick={onReset}
          className="btn-ghost w-full text-xs border border-border"
        >
          Reset / clear assignment
        </button>
      </div>

      {err && <div className="rounded-md bg-dangerLight border border-danger/30 text-danger text-xs px-3 py-2">{err}</div>}
    </div>
  );
}
