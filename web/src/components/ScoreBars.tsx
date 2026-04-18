import type { QueueEntry } from "../lib/api";

/**
 * Visual breakdown: 4 horizontal segments representing the four score components.
 * Each bar's width is proportional to its max (40, 20, 20, 20).
 */
export function ScoreBars({ breakdown, compact }: { breakdown: QueueEntry["breakdown"]; compact?: boolean }) {
  const items = [
    { label: "urgency", value: breakdown.urgency, max: 40, color: "bg-danger" },
    { label: "wait", value: breakdown.wait, max: 20, color: "bg-warn" },
    { label: "vulnerability", value: breakdown.vulnerability, max: 20, color: "bg-accent" },
    { label: "rules", value: breakdown.rules, max: 20, color: "bg-brand" },
  ];
  return (
    <div className={compact ? "flex gap-1" : "space-y-1"}>
      {items.map(it => (
        <div key={it.label} className={compact ? "flex-1" : "flex items-center gap-2"}>
          {!compact && <div className="label w-24 shrink-0">{it.label}</div>}
          <div className="flex-1 bg-card2 rounded-full h-2 overflow-hidden border border-border">
            <div
              className={`${it.color} h-full rounded-full`}
              style={{ width: `${Math.min(100, (it.value / it.max) * 100)}%` }}
              title={`${it.label}: ${it.value.toFixed(1)} / ${it.max}`}
            />
          </div>
          {!compact && <div className="text-[11px] tabular-nums w-12 text-right text-muted">{it.value.toFixed(1)}</div>}
        </div>
      ))}
    </div>
  );
}
