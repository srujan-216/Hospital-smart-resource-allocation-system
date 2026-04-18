import { AlertTriangle, Shield, User, Wrench, Zap } from "lucide-react";
import type { BedUnit, LabUnit } from "../../lib/api";

/**
 * Visual spec:
 *   BEDS
 *     Priority row + occupied   → solid red fill, white number, patient chip
 *     Priority row + free       → white fill, red border, teal text, subtle shield icon
 *     Regular row + occupied    → solid emerald fill, white number
 *     Regular row + free        → pale teal fill, teal border, teal number
 *     High-risk patient         → pulsing red corner dot
 *
 *   LABS
 *     Maintenance               → amber-ish red fill + wrench icon, disabled look
 *     In use                    → solid emerald, patient chip, clock-feel
 *     In use + emergency        → red fill + pulsing dot + Zap icon
 *     Available                 → pale teal, teal number, room number caption
 */

export function BedUnitTile({
  bed, selected, flashing, onClick,
}: {
  bed: BedUnit;
  selected: boolean;
  flashing?: boolean;
  onClick: () => void;
}) {
  const occupied = bed.status === "occupied";
  const isPriority = bed.row === "priority";
  const isHigh = !!bed.patient && bed.patient.risk_level === "high";

  let theme: string;
  let headerText: string;
  let numberTone: string;
  if (isPriority && occupied) {
    // Priority occupied — loud red
    theme = "bg-gradient-to-br from-danger to-[#b91c1c] border-danger text-white shadow-[0_6px_20px_-8px_rgba(220,38,38,0.55)]";
    headerText = "text-white/80";
    numberTone = "text-white";
  } else if (isPriority && !occupied) {
    theme = "bg-white border-2 border-dashed border-danger/70 text-danger";
    headerText = "text-danger/80";
    numberTone = "text-danger";
  } else if (!isPriority && occupied) {
    theme = "bg-gradient-to-br from-success to-[#047857] border-success text-white shadow-[0_6px_20px_-8px_rgba(5,150,105,0.5)]";
    headerText = "text-white/80";
    numberTone = "text-white";
  } else {
    theme = "bg-accentLight/40 border-2 border-accent/30 text-accent";
    headerText = "text-accent/80";
    numberTone = "text-accent";
  }

  return (
    <button
      onClick={onClick}
      className={`relative w-full aspect-square rounded-xl ${theme} transition-all hover:-translate-y-0.5 hover:shadow-pop active:translate-y-0 ${selected ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""} ${flashing ? "flash-ring" : ""}`}
      title={bed.patient ? `Bed ${bed.number} · ${bed.patient.name} · ${bed.patient.risk_level} risk` : `Bed ${bed.number} · ${bed.row} · available`}
    >
      {/* Row badge */}
      <div className={`absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 text-[9px] uppercase tracking-widest font-extrabold ${headerText}`}>
        {isPriority ? <Shield className="w-2.5 h-2.5" strokeWidth={3} /> : null}
        <span>{isPriority ? "PRI" : "REG"}</span>
      </div>

      {/* High-risk pulse */}
      {isHigh && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-white ring-2 ring-white/40 pulse-dot" title="High risk" />
      )}

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1">
        <div className={`text-[22px] font-black tabular-nums leading-none ${numberTone}`}>{bed.number}</div>
        {occupied && bed.patient ? (
          <div className="inline-flex items-center gap-1 max-w-full">
            <User className="w-3 h-3 shrink-0 opacity-90" />
            <div className="text-[10px] font-semibold truncate opacity-95">
              {bed.patient.name.split(" ")[0]}
            </div>
          </div>
        ) : (
          <div className="text-[9px] font-semibold tracking-widest uppercase opacity-70">
            {isPriority ? "priority" : "available"}
          </div>
        )}
      </div>
    </button>
  );
}

export function LabUnitTile({
  lab, selected, flashing, onClick,
}: {
  lab: LabUnit;
  selected: boolean;
  flashing?: boolean;
  onClick: () => void;
}) {
  let theme: string;
  let headerText: string;
  let numberTone: string;
  let icon: React.ReactNode | null = null;

  if (lab.status === "maintenance") {
    theme = "bg-gradient-to-br from-warnLight to-warnLight/60 border-warn/70 text-warn shadow-[0_2px_8px_-4px_rgba(217,119,6,0.35)]";
    headerText = "text-warn/80";
    numberTone = "text-warn";
    icon = <Wrench className="w-3 h-3" />;
  } else if (lab.status === "in_use" && lab.emergency) {
    theme = "bg-gradient-to-br from-danger to-[#b91c1c] border-danger text-white shadow-[0_6px_20px_-8px_rgba(220,38,38,0.55)]";
    headerText = "text-white/80";
    numberTone = "text-white";
    icon = <Zap className="w-3 h-3" strokeWidth={2.5} />;
  } else if (lab.status === "in_use") {
    theme = "bg-gradient-to-br from-success to-[#047857] border-success text-white shadow-[0_6px_20px_-8px_rgba(5,150,105,0.5)]";
    headerText = "text-white/80";
    numberTone = "text-white";
  } else {
    theme = "bg-accentLight/40 border-2 border-accent/30 text-accent";
    headerText = "text-accent/80";
    numberTone = "text-accent";
  }

  const statusLabel =
    lab.status === "maintenance" ? "MAINT" :
    lab.status === "in_use"       ? (lab.emergency ? "EMERG" : "BUSY") :
    "FREE";

  return (
    <button
      onClick={onClick}
      className={`relative w-full aspect-square rounded-xl border ${theme} transition-all hover:-translate-y-0.5 hover:shadow-pop ${selected ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""}`}
      title={`${lab.lab_id} · ${lab.status}${lab.emergency ? " · EMERGENCY" : ""}${lab.assigned_to ? ` · ${lab.assigned_to}` : ""}`}
    >
      <div className={`absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 text-[9px] uppercase tracking-widest font-extrabold ${headerText}`}>
        {icon}
        <span>{statusLabel}</span>
      </div>

      {lab.emergency && lab.status === "in_use" && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-white ring-2 ring-white/40 pulse-dot" title="Emergency mode" />
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1">
        <div className={`text-[22px] font-black tabular-nums leading-none ${numberTone}`}>{lab.number}</div>
        <div className={`text-[9px] font-mono font-semibold opacity-80 ${numberTone}`}>#{lab.room_no}</div>
      </div>

      {lab.status === "maintenance" && (
        <AlertTriangle className="absolute bottom-1.5 right-1.5 w-3 h-3 opacity-70" />
      )}
    </button>
  );
}
