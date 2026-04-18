import type { PatientInfo, TransferEvent } from "../../lib/api";

export function QueuePanel({
  title = "Priority queue",
  subtitle,
  queue,
  transfers,
  emptyHint = "No waiting patients.",
}: {
  title?: string;
  subtitle?: string;
  queue: (PatientInfo | { patient_id: string; patient_name: string; request_type?: string; queued_at?: string; risk_level?: string })[];
  transfers: TransferEvent[];
  emptyHint?: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="label">{title}</div>
            {subtitle && <div className="text-[11px] text-muted mt-0.5">{subtitle}</div>}
          </div>
          {queue.length > 0 && <span className="chip-danger text-[10px]">{queue.length} waiting</span>}
        </div>
        {queue.length === 0 ? (
          <div className="text-[12px] text-muted italic py-4 text-center border border-dashed border-border rounded-lg bg-surface2/40">
            {emptyHint}
          </div>
        ) : (
          <div className="space-y-1.5">
            {queue.map((q, i) => {
              const isHigh = ("risk_level" in q && q.risk_level === "high");
              return (
                <div
                  key={(q as any).patient_id + i}
                  className={`rounded-lg border ${isHigh ? "border-danger/40 bg-dangerLight/40" : "border-border bg-surface2/60"} p-2.5`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-[13px] truncate">{(q as any).patient_name || (q as any).name}</div>
                      <div className="text-[11px] text-muted truncate">
                        {("medical_condition" in q && (q as any).medical_condition) || (q as any).request_type || ""}
                      </div>
                    </div>
                    {isHigh && <span className="chip-danger text-[10px]">HIGH</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="label mb-2">Recent transfers</div>
        {transfers.length === 0 ? (
          <div className="text-[12px] text-muted italic">No transfers yet.</div>
        ) : (
          <div className="space-y-1">
            {transfers.slice(0, 12).map(t => (
              <div key={t._id} className="text-[11px] bg-surface2/80 rounded-md border border-border px-2 py-1.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`chip ${chipForKind(t.kind)} text-[9px]`}>{t.kind.replace(/_/g, " ")}</span>
                  <span className="text-muted tabular-nums text-[10px]">{new Date(t.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-inkMuted leading-snug">
                  {t.patient_name && <span className="font-semibold text-ink">{t.patient_name}</span>}
                  {t.patient_name && " · "}
                  {t.reason}
                </div>
                {(t.from || t.to) && (
                  <div className="text-[10px] text-muted mt-0.5">
                    {t.from && <span>{t.from}</span>}
                    {t.from && t.to && <span className="mx-1">→</span>}
                    {t.to && <span className="font-semibold text-accent">{t.to}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function chipForKind(kind: string) {
  if (kind === "queue") return "chip-danger";
  if (kind === "bump_to_regular") return "chip-warn";
  if (kind === "upgrade_to_priority") return "chip-primary";
  if (kind === "preempt_lab") return "chip-danger";
  if (kind === "discharge") return "chip-neutral";
  if (kind === "admit") return "chip-success";
  return "chip-info";
}
