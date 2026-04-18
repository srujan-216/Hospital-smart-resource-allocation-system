import { Router } from "express";
import { listResources } from "../store.js";
import { DomainSchema } from "../types.js";

export const resourcesRouter = Router();

// GET /api/resources?domain=X&kind=Y
// Default kind is "bed" so legacy consumers (Queue page) see only beds.
// Labs and other resource kinds are accessed via their dedicated routes.
resourcesRouter.get("/", async (req, res) => {
  const domain = req.query.domain ? DomainSchema.safeParse(req.query.domain) : null;
  if (req.query.domain && !domain?.success) return res.status(400).json({ error: "invalid domain" });
  const kind = typeof req.query.kind === "string" ? req.query.kind : "bed";
  const all = await listResources(domain?.success ? domain.data : undefined);
  const filtered = kind === "all" ? all : all.filter(r => (r.metadata?.kind || "bed") === kind);
  res.json(filtered);
});
