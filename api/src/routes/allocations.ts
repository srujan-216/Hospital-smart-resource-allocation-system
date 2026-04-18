import { Router } from "express";
import { DomainSchema } from "../types.js";
import { listAllocations } from "../store.js";
import { requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { performAutoAllocation, buildSmsPreview } from "../services/auto-allocate.js";

export const allocationsRouter = Router();

// GET /api/allocations?domain=X
allocationsRouter.get("/", async (req, res) => {
  const domain = req.query.domain ? DomainSchema.safeParse(req.query.domain) : null;
  if (req.query.domain && !domain?.success) return res.status(400).json({ error: "invalid domain" });
  const rows = await listAllocations({ domain: domain?.success ? domain.data : undefined });
  res.json(rows);
});

// POST /api/allocations/auto?domain=X   (admin)  — runs Hungarian over waiting × free.
// Kept for manual re-runs (e.g. after a resource comes back online); the normal
// code path triggers this implicitly when /api/requests accepts a new request.
allocationsRouter.post("/auto", requireAdmin, async (req: AuthedRequest, res) => {
  const domain = req.query.domain ? DomainSchema.safeParse(req.query.domain) : null;
  if (req.query.domain && !domain?.success) return res.status(400).json({ error: "invalid domain" });
  const d = domain?.success ? domain.data : undefined;

  const allocations = await performAutoAllocation(d, req.admin?.username || "admin", buildSmsPreview);
  res.json({ created: allocations.length, allocations, algorithm: "hungarian" });
});
