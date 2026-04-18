import type { ResourceRow, RequestRow } from "../lib/api";

export function BedTile({
  resource, occupant, flashing, recommended, onClick,
}: {
  resource: ResourceRow;
  occupant: RequestRow | null;
  flashing?: boolean;
  recommended?: boolean;
  onClick?: () => void;
}) {
  const base = resource.available
    ? "bed-tile bed-free"
    : "bed-tile bed-occupied opacity-80";
  const ring = recommended && resource.available ? "ring-2 ring-accent" : "";
  return (
    <button
      onClick={onClick}
      className={`${base} ${ring} ${flashing ? "bed-flash" : ""}`}
      aria-label={`${resource.name} ${resource.available ? "available" : "in use"}`}
    >
      <div className="flex items-center justify-between">
        <div className="font-mono font-bold text-[13px] text-ink">{resource.name}</div>
        {resource.available
          ? <span className="w-2 h-2 rounded-full bg-success" />
          : <span className="w-2 h-2 rounded-full bg-muted" />}
      </div>
      <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">
        {resource.metadata?.type || "bed"}
      </div>
      <div className="text-[11px] mt-1 min-h-[15px] leading-tight">
        {resource.available
          ? <span className="text-success font-semibold">FREE</span>
          : occupant
            ? <span className="text-ink truncate block">{occupant.requester_name}</span>
            : <span className="text-muted">In use</span>}
      </div>
    </button>
  );
}
