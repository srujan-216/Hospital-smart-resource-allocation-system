/**
 * Smart Lab Scheduler — service layer for the Labs dashboard.
 *
 * Each lab has one of three statuses:
 *   available | in_use | maintenance
 *
 * Business rules:
 *  - Maintenance labs cannot be assigned (hard block).
 *  - Toggling emergency=YES on an in-use lab is allowed but logged as preemption.
 *  - Assign picks a lab directly (admin action). If the selected lab is in use
 *    and not in emergency mode, we block; if it IS in emergency mode, we
 *    preempt (current request moved into a queue).
 *  - Reset clears the assignment and returns the lab to available.
 *
 * Kept intentionally in-memory for the queue/transfer log — mirrors the
 * pattern in smart-beds.ts.
 */
import { nanoid } from "nanoid";
import type { AppResource } from "../types.js";
import { listResources, upsertResource, addAudit } from "../store.js";
import type { TransferEvent } from "./smart-beds.js";

export type LabStatus = "available" | "in_use" | "maintenance";

export interface LabAssignment {
  patient_name: string;
  request_type: string;
  queued_at: string;
}

async function allLabs(): Promise<AppResource[]> {
  const rows = await listResources("hospital");
  return rows.filter(r => r.metadata?.kind === "lab");
}

function labStatus(l: AppResource): LabStatus {
  return (l.metadata?.status as LabStatus) || "available";
}

function labNumber(l: AppResource): number {
  return Number(l.metadata?.number) || 0;
}

const queue: LabAssignment[] = [];
const transfers: TransferEvent[] = [];

function logTransfer(ev: Omit<TransferEvent, "_id" | "timestamp">) {
  transfers.unshift({
    _id: `tr_${nanoid(6)}`,
    timestamp: new Date().toISOString(),
    ...ev,
  });
  if (transfers.length > 200) transfers.pop();
}

function labToDto(l: AppResource) {
  const m = l.metadata || {};
  return {
    _id: l._id,
    block: (m.block as string) || "",
    block_id: (m.block_id as string) || "",
    number: labNumber(l),
    lab_id: (m.lab_id as string) || l.name,
    room_no: (m.room_no as string) || "",
    status: labStatus(l),
    emergency: !!m.emergency,
    assigned_to: (m.assigned_to as string) || null,
    assigned_at: (m.assigned_at as string) || null,
  };
}

export async function getState() {
  const labs = await allLabs();
  return {
    labs: labs.slice().sort((a, b) => labNumber(a) - labNumber(b)).map(labToDto),
    queue: queue.slice(0, 50).map((q, i) => ({
      patient_id: `Q${i + 1}`,
      patient_name: q.patient_name,
      request_type: q.request_type,
      queued_at: q.queued_at,
    })),
    transfers: transfers.slice(0, 30),
  };
}

async function persist(lab: AppResource) {
  lab.available = labStatus(lab) === "available";
  await upsertResource(lab);
}

// ─────────────── actions ───────────────

export async function toggleEmergency(labId: string) {
  const labs = await allLabs();
  const lab = labs.find(l => l._id === labId);
  if (!lab) throw new Error("lab not found");
  const cur = !!lab.metadata?.emergency;
  lab.metadata = { ...(lab.metadata || {}), emergency: !cur };

  if (!cur && labStatus(lab) === "in_use") {
    // Turning emergency ON while in use — preempt current occupant into the queue.
    const preempted = (lab.metadata?.assigned_to as string) || "current test";
    queue.unshift({ patient_name: preempted, request_type: "preempted", queued_at: new Date().toISOString() });
    logTransfer({
      kind: "preempt_lab",
      reason: `Emergency mode ON · preempted ${preempted} on ${lab.metadata?.lab_id}. Queued for next available lab.`,
      resource_ids: [lab._id],
    });
    lab.metadata.assigned_to = "EMERGENCY · awaiting patient";
    lab.metadata.assigned_at = new Date().toISOString();
  }

  await persist(lab);
  await addAudit({ _id: `aud_${nanoid(8)}`, domain: "hospital", event: "lab:emergency_toggle", actor: "system", payload: { labId, on: !cur }, timestamp: new Date().toISOString() });
  return getState();
}

export async function toggleMaintenance(labId: string) {
  const labs = await allLabs();
  const lab = labs.find(l => l._id === labId);
  if (!lab) throw new Error("lab not found");
  const cur = labStatus(lab);
  const next = cur === "maintenance" ? "available" : "maintenance";
  lab.metadata = { ...(lab.metadata || {}), status: next };

  if (next === "maintenance" && cur === "in_use") {
    const preempted = (lab.metadata?.assigned_to as string) || "in-progress test";
    queue.unshift({ patient_name: preempted, request_type: "preempted-by-maintenance", queued_at: new Date().toISOString() });
    logTransfer({ kind: "preempt_lab", reason: `Lab ${lab.metadata?.lab_id} flagged for maintenance — ${preempted} moved to queue.`, resource_ids: [lab._id] });
    lab.metadata.assigned_to = null;
    lab.metadata.assigned_at = null;
    lab.metadata.emergency = false;
  }

  await persist(lab);
  await addAudit({ _id: `aud_${nanoid(8)}`, domain: "hospital", event: `lab:${next}`, actor: "system", payload: { labId }, timestamp: new Date().toISOString() });
  return getState();
}

export async function assign(labId: string, body: { patient_name: string; request_type: string }) {
  const labs = await allLabs();
  const lab = labs.find(l => l._id === labId);
  if (!lab) throw new Error("lab not found");
  const status = labStatus(lab);
  if (status === "maintenance") throw new Error("lab is under maintenance");
  if (status === "in_use" && !lab.metadata?.emergency) throw new Error("lab is in use (enable emergency mode to preempt)");

  if (status === "in_use" && lab.metadata?.emergency) {
    const previous = (lab.metadata?.assigned_to as string) || "previous test";
    queue.unshift({ patient_name: previous, request_type: "preempted", queued_at: new Date().toISOString() });
    logTransfer({ kind: "preempt_lab", reason: `${previous} preempted by emergency assignment on ${lab.metadata?.lab_id}.`, resource_ids: [lab._id] });
  }

  lab.metadata = {
    ...(lab.metadata || {}),
    status: "in_use",
    assigned_to: `${body.patient_name} · ${body.request_type}`,
    assigned_at: new Date().toISOString(),
  };
  await persist(lab);
  logTransfer({
    kind: "admit",
    patient_name: body.patient_name,
    to: lab.metadata?.lab_id as string,
    reason: `Assigned ${body.request_type} to ${lab.metadata?.lab_id}${lab.metadata?.emergency ? " (emergency)" : ""}.`,
    resource_ids: [lab._id],
  });
  await addAudit({ _id: `aud_${nanoid(8)}`, domain: "hospital", event: "lab:assign", actor: "system", payload: { labId, patient: body.patient_name }, timestamp: new Date().toISOString() });
  return getState();
}

export async function reset(labId: string) {
  const labs = await allLabs();
  const lab = labs.find(l => l._id === labId);
  if (!lab) throw new Error("lab not found");
  lab.metadata = {
    ...(lab.metadata || {}),
    status: "available",
    assigned_to: null,
    assigned_at: null,
    emergency: false,
  };
  await persist(lab);
  logTransfer({ kind: "discharge", reason: `Lab ${lab.metadata?.lab_id} reset to available.`, resource_ids: [lab._id] });
  await addAudit({ _id: `aud_${nanoid(8)}`, domain: "hospital", event: "lab:reset", actor: "system", payload: { labId }, timestamp: new Date().toISOString() });
  return getState();
}
