import type { ReactNode } from "react";

export function ResourceBlock({
  title, emoji, stats, children, tone,
}: {
  title: string;
  emoji?: string;
  stats?: { label: string; value: number | string; tone?: "ok" | "warn" | "danger" | "brand" }[];
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <div className={`card-flush p-4 ${tone === "danger" ? "border-danger/30" : ""}`}>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          {emoji && <span className="text-lg">{emoji}</span>}
          <div className="font-bold text-[15px] tracking-tight">{title}</div>
        </div>
        {stats && (
          <div className="flex items-center gap-3 text-[11px] text-muted">
            {stats.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <span className={`tabular-nums font-bold ${toneToText(s.tone)}`}>{s.value}</span>
                <span>{s.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function toneToText(tone?: "ok" | "warn" | "danger" | "brand") {
  switch (tone) {
    case "ok": return "text-ok";
    case "warn": return "text-warn";
    case "danger": return "text-danger";
    case "brand": return "text-accent";
    default: return "text-ink";
  }
}
