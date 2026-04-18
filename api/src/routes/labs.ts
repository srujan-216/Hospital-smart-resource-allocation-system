import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import {
  getState, toggleEmergency, toggleMaintenance, assign, reset,
} from "../services/smart-labs.js";

export const labsRouter = Router();

labsRouter.get("/", async (_req, res) => {
  res.json(await getState());
});

labsRouter.post("/:id/emergency", requireAdmin, async (req, res) => {
  try { res.json(await toggleEmergency(req.params.id)); }
  catch (e: any) { res.status(400).json({ error: e.message || "failed" }); }
});

labsRouter.post("/:id/maintenance", requireAdmin, async (req, res) => {
  try { res.json(await toggleMaintenance(req.params.id)); }
  catch (e: any) { res.status(400).json({ error: e.message || "failed" }); }
});

labsRouter.post("/:id/assign", requireAdmin, async (req, res) => {
  const parse = z.object({
    patient_name: z.string().min(1).max(80),
    request_type: z.string().min(1).max(120),
  }).safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "invalid payload" });
  try { res.json(await assign(req.params.id, parse.data)); }
  catch (e: any) { res.status(400).json({ error: e.message || "failed" }); }
});

labsRouter.post("/:id/reset", requireAdmin, async (req, res) => {
  try { res.json(await reset(req.params.id)); }
  catch (e: any) { res.status(400).json({ error: e.message || "failed" }); }
});
