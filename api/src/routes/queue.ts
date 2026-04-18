import { Router } from "express";
import { listRequests } from "../store.js";
import { DomainSchema } from "../types.js";
import { buildQueue } from "../services/queue.js";

export const queueRouter = Router();

queueRouter.get("/", async (req, res) => {
  const domain = req.query.domain ? DomainSchema.safeParse(req.query.domain) : null;
  if (req.query.domain && !domain?.success) return res.status(400).json({ error: "invalid domain" });
  const all = await listRequests({ domain: domain?.success ? domain.data : undefined });
  const queue = buildQueue(all, domain?.success ? domain.data : undefined);
  res.json(queue);
});
