import { Router } from "express";
import { listAudit } from "../store.js";
import { DomainSchema } from "../types.js";

export const auditRouter = Router();

auditRouter.get("/", async (req, res) => {
  const domain = req.query.domain ? DomainSchema.safeParse(req.query.domain) : null;
  if (req.query.domain && !domain?.success) return res.status(400).json({ error: "invalid domain" });
  const rows = await listAudit(domain?.success ? domain.data : undefined);
  res.json(rows);
});
