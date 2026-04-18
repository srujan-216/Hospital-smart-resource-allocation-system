import { Router } from "express";
import { nanoid } from "nanoid";
import { DomainSchema, SubmitRequestBody } from "../types.js";
import type { AppRequest } from "../types.js";
import { listRequests, upsertRequest, addAudit } from "../store.js";
import { triage } from "../services/triage.js";
import { performAutoAllocation, buildSmsPreview } from "../services/auto-allocate.js";

export const requestsRouter = Router();

requestsRouter.get("/", async (req, res) => {
  const domain = req.query.domain ? DomainSchema.safeParse(req.query.domain) : null;
  if (req.query.domain && !domain?.success) return res.status(400).json({ error: "invalid domain" });
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const rows = await listRequests({ domain: domain?.success ? domain.data : undefined, status });
  res.json(rows);
});

requestsRouter.post("/", async (req, res) => {
  const parse = SubmitRequestBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "invalid payload", details: parse.error.flatten() });

  const body = parse.data;
  const ai = await triage(body.description, body.domain);
  const now = new Date().toISOString();
  const urgency = body.urgency ?? ai.urgency;
  const request: AppRequest = {
    _id: `req_${nanoid(8)}`,
    domain: body.domain,
    requester_name: body.requester_name,
    phone: body.phone,
    city: body.city,
    description: body.description,
    urgency,
    vulnerability_flags: body.vulnerability_flags,
    photo_url: body.photo_url ?? null,
    submitted_at: now,
    wait_start_at: now,
    status: "waiting",
    ai_extracted: { ...ai },
  };

  await upsertRequest(request);
  await addAudit({
    _id: `aud_${nanoid(8)}`,
    domain: body.domain,
    event: "request:created",
    actor: body.requester_name,
    payload: { requestId: request._id, urgency, acuity_hint: ai.acuity_hint },
    timestamp: now,
  });

  // Implicit Hungarian: allocate the new request (plus any backlog) immediately
  // so callers never need to click a "run allocator" button. If allocation
  // happens, the request's status flips to "allocated" in the response.
  const allocations = await performAutoAllocation(body.domain, "system", buildSmsPreview);
  const allocated = allocations.find(a => a.request_id === request._id);
  const final = allocated
    ? { ...request, status: "allocated" as const }
    : request;

  res.json({ ...final, auto_allocated: !!allocated, allocation: allocated ?? null });
});
