import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import {
  getState, admitPatient, changeRisk, transferBed, discharge,
} from "../services/smart-beds.js";

export const bedsRouter = Router();

const RiskSchema = z.enum(["low", "medium", "high"]);
const RowSchema = z.enum(["priority", "regular"]);

bedsRouter.get("/", async (_req, res) => {
  res.json(await getState());
});

bedsRouter.post("/admit", requireAdmin, async (req, res) => {
  const parse = z.object({
    name: z.string().min(1).max(80),
    medical_condition: z.string().min(1).max(300),
    risk_level: RiskSchema,
    preferred_block: z.string().optional(),
  }).safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "invalid payload" });
  const state = await admitPatient(parse.data);
  res.json(state);
});

bedsRouter.post("/:id/risk", requireAdmin, async (req, res) => {
  const parse = z.object({ risk_level: RiskSchema }).safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "invalid payload" });
  try {
    const state = await changeRisk(req.params.id, parse.data.risk_level);
    res.json(state);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "failed" });
  }
});

bedsRouter.post("/:id/transfer", requireAdmin, async (req, res) => {
  const parse = z.object({ target: RowSchema }).safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "invalid payload" });
  try {
    const state = await transferBed(req.params.id, parse.data.target);
    res.json(state);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "failed" });
  }
});

bedsRouter.post("/:id/discharge", requireAdmin, async (req, res) => {
  try {
    const state = await discharge(req.params.id);
    res.json(state);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "failed" });
  }
});
