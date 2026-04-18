import "dotenv/config";
import express from "express";
import cors from "cors";
import { initStore, listRequests, listResources } from "./store.js";
import { seedAll } from "./data/seed-data.js";
import { resetAll } from "./store.js";
import { domainsRouter } from "./routes/domains.js";
import { resourcesRouter } from "./routes/resources.js";
import { requestsRouter } from "./routes/requests.js";
import { queueRouter } from "./routes/queue.js";
import { allocationsRouter } from "./routes/allocations.js";
import { auditRouter } from "./routes/audit.js";
import { triageRouter } from "./routes/triage.js";
import { seedRouter } from "./routes/seed.js";
import { authRouter } from "./routes/auth.js";
import { bedsRouter } from "./routes/beds.js";
import { labsRouter } from "./routes/labs.js";

const app = express();
app.use(cors({ origin: process.env.WEB_ORIGIN || true }));
app.use(express.json({ limit: "1mb" }));

app.use((req, _res, next) => {
  (req as any).requestStart = Date.now();
  next();
});

app.get("/api/health", async (_req, res) => {
  res.json({
    ok: true,
    storage: process.env.MONGODB_URI ? "mongo (if reachable)" : "in-memory",
    claude_key_present: !!process.env.ANTHROPIC_API_KEY,
    time: new Date().toISOString(),
  });
});

app.use("/api/domains", domainsRouter);
app.use("/api/resources", resourcesRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/queue", queueRouter);
app.use("/api/allocations", allocationsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/triage", triageRouter);
app.use("/api/seed", seedRouter);
app.use("/api/auth", authRouter);
app.use("/api/beds", bedsRouter);
app.use("/api/labs", labsRouter);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("[api] error:", err);
  res.status(500).json({ error: err?.message || "internal error" });
});

async function start() {
  const mode = await initStore();
  console.log(`[store] mode: ${mode}`);

  const [resources, requests] = await Promise.all([listResources(), listRequests()]);
  if (!resources.length && !requests.length) {
    const seed = seedAll();
    await resetAll({ resources: seed.resources, requests: seed.requests, allocations: [], audit: [] });
    console.log(`[seed] auto-seeded ${seed.resources.length} resources + ${seed.requests.length} requests`);
  }

  const port = Number(process.env.API_PORT || 4000);
  app.listen(port, () => console.log(`[api] listening on http://localhost:${port}`));
}

start().catch(e => { console.error(e); process.exit(1); });
