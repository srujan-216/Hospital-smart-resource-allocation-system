import { Router } from "express";
import { counts } from "../store.js";
import { DOMAIN_META } from "../data/seed-data.js";
import type { Domain } from "../types.js";

export const domainsRouter = Router();

domainsRouter.get("/", async (_req, res) => {
  const domains: Domain[] = ["hospital"];
  const out = await Promise.all(
    domains.map(async d => ({
      id: d,
      ...DOMAIN_META[d],
      stats: await counts(d),
    }))
  );
  res.json(out);
});
