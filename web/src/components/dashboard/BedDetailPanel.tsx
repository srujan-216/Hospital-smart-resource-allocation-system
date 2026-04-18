import { useState } from "react";
import type { BedUnit, RiskLevel } from "../../lib/api";

const RISK_OPTIONS: { value: RiskLevel; label: string; tone: "ok" | "warn" | "danger" }[] = [
  { value: "low",    label: "Low",    tone: "ok" },
  { value: "medium", label: "Medium", tone: "warn" },
  { value: "high",   label: "High",   tone: "danger" },
];

export function BedDetailPanel({
  bed, onBack, onChangeRisk, onTransfer, onDischarge, busy, err,
}: {
  bed: BedUnit;
  onBack: () => void;
  onChangeRisk: (r: RiskLevel) => void;
  onTransfer: (target: "priority" | "regular") => void;
  onDischarge: () => void;
  busy?: boolean;
  err?: string | null;
}) {
  const [confirmDischarge, setConfirmDischarge] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-muted hover:text-ink inline-flex items-center gap-1">
          ← Queue
        </button>
        <span className={`chip ${bed.row === "priority" ? "chip-danger" : "chip-success"} text-[10px]`}>
          {bed.row === "priority" ? "PRIORITY" : "REGULAR"}
        </span>
      </div>

      <div className="card-flush p-4 border-accent/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-lg bg-accentLight text-accent flex items-center justify-center font-extrabold text-lg">
            {bed.number}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm">Bed {bed.number}</div>
            <div className="text-[11px] text-muted truncate">{bed.block}</div>
          </div>
        </div>

        {!bed.patient ? (
          <div className="text-sm text-muted italic py-4 text-center">
            Bed is available — no patient assigned.
          </div>
        ) : (
          <>
            <div className="text-[11px] text-muted">Patient</div>
            <div className="font-bold text-[15px]">{bed.patient.name}</div>
            <div className="text-xs text-muted font-mono">{bed.patient.patient_id}</div>

            <div className="mt-3">
              <div className="text-[11px] text-muted">Condition</div>
              <div className="text-[13px] text-ink mt-0.5">{bed.patient.medical_condition}</div>
            </div>

            <div className="mt-3">
              <div className="text-[11px] text-muted">Admitted</div>
              <div className="text-[12px] text-inkMuted mt-0.5">{new Date(bed.patient.admitted_at).toLocaleString()}</div>
            </div>
          </>
        )}
      </div>

      {bed.patient && (
        <>
          <div>
            <div className="label mb-2">Risk level</div>
            <div className="grid grid-cols-3 gap-1.5">
              {RISK_OPTIONS.map(opt => {
                const active = bed.patient!.risk_level === opt.value;
                const toneActive = {
                  ok: "bg-successLight border-success text-success",
                  warn: "bg-warnLight border-warn text-warn",
                  danger: "bg-dangerLight border-danger text-danger",
                }[opt.tone];
                return (
                  <button
                    key={opt.value}
                    disabled={busy || active}
                    onClick={() => onChangeRisk(opt.value)}
                    className={`px-2 py-2 rounded-lg border-2 text-xs font-bold transition-colors ${
                      active ? toneActive : "border-border text-muted hover:border-ink hover:text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-muted mt-1.5">
              Change triggers smart reallocation. High-risk patients in regular beds auto-promote if a priority bed is free.
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="label mb-2">Manual transfer</div>
            {bed.row === "priority" ? (
              <button
                disabled={busy}
                onClick={() => onTransfer("regular")}
                className="btn-outline w-full text-xs"
              >
                → Move to regular bed
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={() => onTransfer("priority")}
                className="btn-outline w-full text-xs"
              >
                → Upgrade to priority bed
              </button>
            )}
          </div>

          <div>
            {!confirmDischarge ? (
              <button
                disabled={busy}
                onClick={() => setConfirmDischarge(true)}
                className="btn-danger w-full text-xs"
              >
                Discharge patient
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setConfirmDischarge(false)} className="btn-outline text-xs flex-1">Cancel</button>
                <button
                  disabled={busy}
                  onClick={() => { setConfirmDischarge(false); onDischarge(); }}
                  className="btn-danger text-xs flex-1"
                >Confirm discharge</button>
              </div>
            )}
          </div>
        </>
      )}

      {err && <div className="rounded-md bg-dangerLight border border-danger/30 text-danger text-xs px-3 py-2">{err}</div>}
    </div>
  );
}
