/**
 * Implicit allocator — runs Hungarian over waiting requests × free resources.
 * Shared between the admin endpoint and the implicit post-request trigger,
 * so there is no code path where an allocation happens without Hungarian.
 */
import { nanoid } from "nanoid";
import type { AppAllocation, Domain } from "../types.js";
import {
  addAllocation, addAudit, getRequest, getResource,
  listRequests, listResources, upsertRequest, upsertResource,
} from "../store.js";
import { buildAllocation, runHungarian } from "./matching.js";

type SmsPreviewFn = (
  req: { requester_name: string; domain: string; city: string },
  resource: { name: string },
  why: string,
) => string;

export async function performAutoAllocation(
  domain: Domain | undefined,
  actor: string,
  smsPreviewFn: SmsPreviewFn,
): Promise<AppAllocation[]> {
  const [reqs, rawRess] = await Promise.all([
    listRequests({ domain, status: "waiting" }),
    listResources(domain),
  ]);
  // Bed-intake flow only matches against beds. Labs are scheduled separately.
  const ress = rawRess.filter(r => (r.metadata?.kind || "bed") === "bed");
  const matches = runHungarian(reqs, ress);
  if (matches.length === 0) return [];

  const out: AppAllocation[] = [];
  for (const m of matches) {
    const requestRow = await getRequest(m.request._id);
    const resource = await getResource(m.resource._id);
    if (!requestRow || !resource) continue;
    if (requestRow.status !== "waiting" || !resource.available) continue;

    const alloc = buildAllocation(m, actor, smsPreviewFn);
    requestRow.status = "allocated";
    resource.available = false;
    resource.metadata = { ...(resource.metadata || {}), current_request_id: requestRow._id };

    await Promise.all([
      upsertRequest(requestRow),
      upsertResource(resource),
      addAllocation(alloc),
      addAudit({
        _id: `aud_${nanoid(8)}`,
        domain: requestRow.domain,
        event: "allocation:auto",
        actor,
        payload: { requestId: requestRow._id, resourceId: resource._id, score: m.score, algo: "hungarian" },
        timestamp: new Date().toISOString(),
      }),
    ]);
    out.push(alloc);
  }
  return out;
}

export function buildSmsPreview(
  req: { requester_name: string; domain: string; city: string },
  resource: { name: string },
  why: string,
) {
  const shortWhy = why.length > 70 ? why.slice(0, 70) + "…" : why;
  switch (req.domain) {
    case "hospital":
      return `Hello ${req.requester_name}, bed ${resource.name} assigned. Reason: ${shortWhy}. Report at the main gate.`;
    default:
      return `${req.requester_name}: ${resource.name} assigned. ${shortWhy}.`;
  }
}
