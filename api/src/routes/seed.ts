import { Router } from "express";
import { nanoid } from "nanoid";
import { DomainSchema } from "../types.js";
import { addAudit, resetAll } from "../store.js";
import { seedAll, seedForDomain } from "../data/seed-data.js";

export const seedRouter = Router();

seedRouter.post("/", async (req, res) => {
  const domain = req.query.domain ? DomainSchema.safeParse(req.query.domain) : null;
  if (req.query.domain && !domain?.success) return res.status(400).json({ error: "invalid domain" });

  if (domain?.success) {
    const s = seedForDomain(domain.data);
    await resetAll({ resources: s.resources, requests: s.requests, allocations: [], audit: [] }, domain.data);
    await addAudit({ _id: `aud_${nanoid(8)}`, domain: domain.data, event: "seed:reset", actor: "system", payload: { scope: domain.data }, timestamp: new Date().toISOString() });
    return res.json({ ok: true, domain: domain.data, resources: s.resources.length, requests: s.requests.length });
  }
  const s = seedAll();
  await resetAll({ resources: s.resources, requests: s.requests, allocations: [], audit: [] });
  await addAudit({ _id: `aud_${nanoid(8)}`, domain: "system", event: "seed:reset", actor: "system", payload: { scope: "all" }, timestamp: new Date().toISOString() });
  res.json({ ok: true, domain: "all", resources: s.resources.length, requests: s.requests.length });
});
