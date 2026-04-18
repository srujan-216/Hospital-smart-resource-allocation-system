import { useEffect, useState } from "react";
import type { ResourceRow, RequestRow } from "../lib/api";

export function ResourceGrid({
  resources, requests, flashedIds = new Set<string>(), onSelect,
}: {
  resources: ResourceRow[];
  requests: RequestRow[];
  flashedIds?: Set<string>;
  onSelect?: (r: ResourceRow) => void;
}) {
  // Group resources by a short label prefix (ICU-1 → ICU, Counter-1 → Counter, PED-1 → PED, etc.)
  const groups: Record<string, ResourceRow[]> = {};
  for (const r of resources) {
    const key = (r.metadata?.type as string) || r.location.city;
    (groups[key] ||= []).push(r);
  }
  const reqById: Record<string, RequestRow> = {};
  for (const q of requests) reqById[q._id] = q;

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([key, items]) => (
        <div key={key}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="label">{labelFor(key)} · {items.length}</div>
            <div className="text-[10px] text-muted">
              {items.filter(r => r.available).length} free
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
            {items.map(r => {
              const occupant = r.metadata?.current_request_id ? reqById[r.metadata.current_request_id] : null;
              const flashing = flashedIds.has(r._id);
              const base = r.available
                ? "bg-ok/10 border-ok/30 text-ok"
                : "bg-danger/10 border-danger/30 text-danger";
              return (
                <button
                  key={r._id}
                  onClick={() => onSelect?.(r)}
                  className={`relative text-left p-2 rounded-lg border text-xs transition-all hover:scale-[1.03] ${base} ${flashing ? "flash-in" : ""}`}
                >
                  <div className="text-[9px] uppercase opacity-70 tracking-wider">
                    {r.available ? "FREE" : "IN USE"}
                  </div>
                  <div className="font-bold text-[13px] text-ink mt-0.5 truncate">{r.name}</div>
                  {occupant ? (
                    <div className="text-[10px] text-ink/80 mt-0.5 truncate">
                      {occupant.requester_name}
                    </div>
                  ) : (
                    <div className="text-[10px] opacity-60 mt-0.5">ready</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function labelFor(k: string) {
  const pretty: Record<string, string> = {
    icu: "ICU Beds",
    general: "General Ward",
    oxygen_cylinder: "Oxygen Cylinders",
    counter: "Counters",
    officer: "Officers",
    computer_lab: "Computer Labs",
    project_room: "Project Rooms",
    equipment: "Equipment",
    als: "Advanced Life Support",
    bls: "Basic Life Support",
  };
  return pretty[k] || k;
}

// Helper hook: schedule which resources should flash based on recently-created allocations
export function useFlashedResources(allocationIds: string[], timing = 1000) {
  const [flashed, setFlashed] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (allocationIds.length === 0) return;
    setFlashed(new Set(allocationIds));
    const t = setTimeout(() => setFlashed(new Set()), timing);
    return () => clearTimeout(t);
  }, [allocationIds.join(","), timing]);
  return flashed;
}
