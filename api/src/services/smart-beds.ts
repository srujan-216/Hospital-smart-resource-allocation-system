/**
 * Smart Bed Allocation — the service layer for the Beds dashboard.
 *
 * Business rules (from the product spec):
 *  - Every bed is either Priority or Regular, inside one of 4 blocks
 *    (ICU Wing, General Ward, Pediatric Wing, Isolation Ward).
 *  - When a high-risk patient arrives:
 *      1. Try to place them in a Priority bed in the preferred block.
 *      2. If no priority bed is free there, look across blocks.
 *      3. If still nothing, bump the LOWEST-risk current priority occupant
 *         down to a regular bed (same block first, else any block).
 *      4. If that's not possible either, enqueue the patient.
 *  - When a patient's risk drops, if they're in a priority bed we try to
 *    move them down to regular so the priority slot can free up.
 *  - When a regular-bed patient is upgraded to high risk, we try to move
 *    them up into a priority bed (same block preferred).
 *
 * All mutations go through `applyPlan()` which persists every move to the
 * store AND records a TransferEvent so the UI Queue/Transfers panel has a
 * timestamped audit of why the system did what it did.
 */
import { nanoid } from "nanoid";
import type { AppResource } from "../types.js";
import { listResources, upsertResource, addAudit } from "../store.js";

export type RiskLevel = "low" | "medium" | "high";
export type BedRow = "priority" | "regular";

export interface PatientInfo {
  patient_id: string;
  name: string;
  medical_condition: string;
  risk_level: RiskLevel;
  admitted_at: string;
}

export interface TransferEvent {
  _id: string;
  kind: "queue" | "bump_to_regular" | "upgrade_to_priority" | "block_transfer" | "discharge" | "admit" | "preempt_lab";
  patient_id?: string;
  patient_name?: string;
  from?: string;
  to?: string;
  reason: string;
  timestamp: string;
  /** Resource IDs (beds or labs) this transfer touched — used by the UI to flash them. */
  resource_ids?: string[];
}

const RISK_RANK: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3 };
const BLOCK_ORDER = ["icu", "general", "pediatric", "isolation"];

// ─────────────── helpers ───────────────

async function allBeds(): Promise<AppResource[]> {
  const rows = await listResources("hospital");
  return rows.filter(r => r.metadata?.kind === "bed");
}

function bedRow(b: AppResource): BedRow {
  return (b.metadata?.row as BedRow) || "regular";
}

function bedBlockId(b: AppResource): string {
  return (b.metadata?.block_id as string) || "general";
}

function bedPatient(b: AppResource): PatientInfo | null {
  return (b.metadata?.patient as PatientInfo) || null;
}

function bedNumber(b: AppResource): number {
  return Number(b.metadata?.number) || 0;
}

function setPatient(b: AppResource, p: PatientInfo | null) {
  b.metadata = { ...(b.metadata || {}), patient: p };
  b.available = !p;
}

// ─────────────── core placement logic ───────────────

export function findFreeBed(
  beds: AppResource[],
  row: BedRow,
  preferredBlock?: string,
): AppResource | null {
  const free = beds.filter(b => bedRow(b) === row && !bedPatient(b));
  // Prefer same block, then fall back to any block in canonical order
  if (preferredBlock) {
    const inBlock = free.find(b => bedBlockId(b) === preferredBlock);
    if (inBlock) return inBlock;
  }
  for (const block of BLOCK_ORDER) {
    const inBlock = free.find(b => bedBlockId(b) === block);
    if (inBlock) return inBlock;
  }
  return free[0] ?? null;
}

export function lowestRiskPriorityOccupant(
  beds: AppResource[],
  preferredBlock?: string,
): AppResource | null {
  const occupied = beds.filter(b => bedRow(b) === "priority" && bedPatient(b));
  if (occupied.length === 0) return null;
  const sorted = [...occupied].sort((a, b) => {
    const ra = RISK_RANK[bedPatient(a)!.risk_level];
    const rb = RISK_RANK[bedPatient(b)!.risk_level];
    if (ra !== rb) return ra - rb;
    // Tiebreak: prefer bumping someone out of the preferred block so we can
    // free a slot there for the incoming high-risk patient.
    if (preferredBlock) {
      const aMatch = bedBlockId(a) === preferredBlock ? 0 : 1;
      const bMatch = bedBlockId(b) === preferredBlock ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
    }
    return bedNumber(a) - bedNumber(b);
  });
  // Only bump if the lowest-risk occupant is strictly lower than "high".
  const candidate = sorted[0];
  const p = bedPatient(candidate)!;
  return p.risk_level === "high" ? null : candidate;
}

// ─────────────── public state + mutations ───────────────

export async function getState() {
  const beds = await allBeds();
  // Dashboard reads the transfer feed from memory (see below).
  return { beds: bedsToDto(beds), queue: getQueueDto(), transfers: getTransfersDto() };
}

function bedsToDto(beds: AppResource[]) {
  return beds
    .slice()
    .sort((a, b) => bedNumber(a) - bedNumber(b))
    .map(b => ({
      _id: b._id,
      block: (b.metadata?.block as string) || "",
      block_id: bedBlockId(b),
      row: bedRow(b),
      number: bedNumber(b),
      status: bedPatient(b) ? "occupied" : "available",
      patient: bedPatient(b),
    }));
}

// In-memory queue + transfer log for the session. Kept simple on purpose —
// forget-on-restart is fine for a demo; in real deployment these would move
// into the store with the rest of the state.
const queue: PatientInfo[] = [];
const transfers: TransferEvent[] = [];

function getQueueDto() { return queue.slice(0, 50); }
function getTransfersDto() { return transfers.slice(0, 30); }

function logTransfer(ev: Omit<TransferEvent, "_id" | "timestamp">) {
  transfers.unshift({
    _id: `tr_${nanoid(6)}`,
    timestamp: new Date().toISOString(),
    ...ev,
  });
  if (transfers.length > 200) transfers.pop();
}

async function persist(bed: AppResource) {
  await upsertResource(bed);
}

// ─────────────── actions ───────────────

export async function admitPatient(input: {
  name: string;
  medical_condition: string;
  risk_level: RiskLevel;
  preferred_block?: string;
}) {
  const beds = await allBeds();
  const patient: PatientInfo = {
    patient_id: `P-${String(Math.floor(Math.random() * 90000) + 10000)}`,
    name: input.name,
    medical_condition: input.medical_condition,
    risk_level: input.risk_level,
    admitted_at: new Date().toISOString(),
  };

  const prefBlock = input.preferred_block;

  // Non-high-risk admits: straight to regular if there's space, else queue.
  if (patient.risk_level !== "high") {
    const reg = findFreeBed(beds, "regular", prefBlock);
    if (reg) {
      setPatient(reg, patient);
      await persist(reg);
      logTransfer({ kind: "admit", patient_id: patient.patient_id, patient_name: patient.name, to: `Bed ${bedNumber(reg)} · ${reg.metadata?.block}`, reason: `Admitted (${patient.risk_level} risk) to regular bed.`, resource_ids: [reg._id] });
      await addAudit({ _id: `aud_${nanoid(8)}`, domain: "hospital", event: "bed:admit", actor: "system", payload: { bedId: reg._id, patient: patient.patient_id, risk: patient.risk_level }, timestamp: new Date().toISOString() });
      return getState();
    }
    queue.unshift(patient);
    logTransfer({ kind: "queue", patient_id: patient.patient_id, patient_name: patient.name, reason: "No regular bed free." });
    return getState();
  }

  // High-risk admits: priority first, then bump, then queue.
  const pri = findFreeBed(beds, "priority", prefBlock);
  if (pri) {
    setPatient(pri, patient);
    await persist(pri);
    logTransfer({ kind: "admit", patient_id: patient.patient_id, patient_name: patient.name, to: `Bed ${bedNumber(pri)} · ${pri.metadata?.block}`, reason: "Admitted (high risk) to priority bed.", resource_ids: [pri._id] });
    await addAudit({ _id: `aud_${nanoid(8)}`, domain: "hospital", event: "bed:admit", actor: "system", payload: { bedId: pri._id, patient: patient.patient_id, risk: "high" }, timestamp: new Date().toISOString() });
    return getState();
  }

  // Try to bump a lower-risk priority occupant to regular.
  const victim = lowestRiskPriorityOccupant(beds, prefBlock);
  if (victim) {
    const target = findFreeBed(beds, "regular", bedBlockId(victim)) ?? findFreeBed(beds, "regular");
    if (target) {
      const victimPatient = bedPatient(victim)!;
      setPatient(target, victimPatient);
      setPatient(victim, patient);
      await persist(target);
      await persist(victim);
      logTransfer({
        kind: "bump_to_regular",
        patient_id: victimPatient.patient_id,
        patient_name: victimPatient.name,
        from: `Bed ${bedNumber(victim)} · ${victim.metadata?.block}`,
        to: `Bed ${bedNumber(target)} · ${target.metadata?.block}`,
        reason: `Moved to regular to free priority bed for incoming high-risk patient (${patient.name}).`,
        resource_ids: [victim._id, target._id],
      });
      logTransfer({
        kind: "admit",
        patient_id: patient.patient_id,
        patient_name: patient.name,
        to: `Bed ${bedNumber(victim)} · ${victim.metadata?.block}`,
        reason: "High-risk admission · bumped lower-risk occupant.",
        resource_ids: [victim._id],
      });
      await addAudit({ _id: `aud_${nanoid(8)}`, domain: "hospital", event: "bed:bump", actor: "system", payload: { from: victim._id, to: target._id, high_risk_patient: patient.patient_id }, timestamp: new Date().toISOString() });
      return getState();
    }
  }

  // No bump possible — queue the high-risk patient and flag the wait.
  queue.unshift(patient);
  logTransfer({ kind: "queue", patient_id: patient.patient_id, patient_name: patient.name, reason: "No priority bed free · no bump candidate." });
  return getState();
}

export async function changeRisk(bedId: string, newRisk: RiskLevel) {
  const beds = await allBeds();
  const bed = beds.find(b => b._id === bedId);
  if (!bed) throw new Error("bed not found");
  const patient = bedPatient(bed);
  if (!patient) throw new Error("bed is empty");

  const oldRisk = patient.risk_level;
  patient.risk_level = newRisk;
  setPatient(bed, patient);
  await persist(bed);

  logTransfer({
    kind: oldRisk === newRisk ? "admit" : (RISK_RANK[newRisk] > RISK_RANK[oldRisk] ? "upgrade_to_priority" : "bump_to_regular"),
    patient_id: patient.patient_id,
    patient_name: patient.name,
    reason: `Risk level ${oldRisk} → ${newRisk}.`,
    resource_ids: [bed._id],
  });

  // Upgraded to high but sitting in a regular bed → try to promote.
  if (newRisk === "high" && bedRow(bed) === "regular") {
    const pri = findFreeBed(beds.filter(b => b._id !== bed._id), "priority", bedBlockId(bed));
    if (pri) {
      setPatient(pri, patient);
      setPatient(bed, null);
      await persist(pri);
      await persist(bed);
      logTransfer({ kind: "upgrade_to_priority", patient_id: patient.patient_id, patient_name: patient.name, from: `Bed ${bedNumber(bed)}`, to: `Bed ${bedNumber(pri)} · ${pri.metadata?.block}`, reason: "Auto-promoted to priority after risk escalation.", resource_ids: [bed._id, pri._id] });
    }
  }

  // Downgraded from high in a priority bed → try to free it.
  if (newRisk !== "high" && bedRow(bed) === "priority") {
    const reg = findFreeBed(beds.filter(b => b._id !== bed._id), "regular", bedBlockId(bed));
    if (reg) {
      setPatient(reg, patient);
      setPatient(bed, null);
      await persist(reg);
      await persist(bed);
      logTransfer({ kind: "bump_to_regular", patient_id: patient.patient_id, patient_name: patient.name, from: `Bed ${bedNumber(bed)}`, to: `Bed ${bedNumber(reg)} · ${reg.metadata?.block}`, reason: "Auto-demoted — priority no longer needed.", resource_ids: [bed._id, reg._id] });
    }
  }

  // If there's a high-risk patient stuck in the queue and we just freed a priority bed,
  // pull them in.
  const freshBeds = await allBeds();
  const freePri = findFreeBed(freshBeds, "priority");
  const queuedHighIdx = queue.findIndex(q => q.risk_level === "high");
  if (freePri && queuedHighIdx >= 0) {
    const incoming = queue.splice(queuedHighIdx, 1)[0];
    setPatient(freePri, incoming);
    await persist(freePri);
    logTransfer({ kind: "admit", patient_id: incoming.patient_id, patient_name: incoming.name, to: `Bed ${bedNumber(freePri)}`, reason: "Pulled from priority queue after slot freed.", resource_ids: [freePri._id] });
  }

  return getState();
}

export async function transferBed(bedId: string, targetRow: BedRow) {
  const beds = await allBeds();
  const bed = beds.find(b => b._id === bedId);
  if (!bed) throw new Error("bed not found");
  const patient = bedPatient(bed);
  if (!patient) throw new Error("bed is empty");
  if (bedRow(bed) === targetRow) return getState();

  const target = findFreeBed(beds.filter(b => b._id !== bed._id), targetRow, bedBlockId(bed));
  if (!target) throw new Error(`no free ${targetRow} bed available`);

  setPatient(target, patient);
  setPatient(bed, null);
  await persist(target);
  await persist(bed);
  logTransfer({
    kind: targetRow === "priority" ? "upgrade_to_priority" : "bump_to_regular",
    patient_id: patient.patient_id,
    patient_name: patient.name,
    from: `Bed ${bedNumber(bed)}`,
    to: `Bed ${bedNumber(target)} · ${target.metadata?.block}`,
    reason: "Manual transfer.",
    resource_ids: [bed._id, target._id],
  });
  return getState();
}

export async function discharge(bedId: string) {
  const beds = await allBeds();
  const bed = beds.find(b => b._id === bedId);
  if (!bed) throw new Error("bed not found");
  const patient = bedPatient(bed);
  if (!patient) return getState();
  setPatient(bed, null);
  await persist(bed);
  logTransfer({ kind: "discharge", patient_id: patient.patient_id, patient_name: patient.name, from: `Bed ${bedNumber(bed)}`, reason: "Discharged.", resource_ids: [bed._id] });

  // If someone is queued, pull them in.
  if (queue.length > 0) {
    const next = queue.shift()!;
    const target = next.risk_level === "high"
      ? findFreeBed(beds, "priority") ?? findFreeBed(beds, "regular")
      : findFreeBed(beds, "regular") ?? findFreeBed(beds, "priority");
    if (target) {
      setPatient(target, next);
      await persist(target);
      logTransfer({ kind: "admit", patient_id: next.patient_id, patient_name: next.name, to: `Bed ${bedNumber(target)}`, reason: "Pulled from queue after discharge.", resource_ids: [target._id] });
    } else {
      queue.unshift(next);
    }
  }
  return getState();
}
