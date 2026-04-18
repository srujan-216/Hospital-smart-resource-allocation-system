import { Router } from "express";
import { z } from "zod";
import { DomainSchema } from "../types.js";
import { triage } from "../services/triage.js";

export const triageRouter = Router();

const Body = z.object({
  description: z.string().min(3).max(1000),
  domain: DomainSchema,
});

triageRouter.post("/", async (req, res) => {
  const p = Body.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "invalid payload" });
  const out = await triage(p.data.description, p.data.domain);
  res.json(out);
});
