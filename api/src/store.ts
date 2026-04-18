/**
 * Storage adapter with two backends:
 *  - Mongoose (if MONGODB_URI is set and reachable)
 *  - In-memory JSON fallback (persisted to api/data/runtime.json)
 *
 * The adapter exposes a flat CRUD surface used by every route so business logic
 * never branches on which backend is active.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose, { Schema } from "mongoose";
import type { AppAllocation, AppRequest, AppResource, AuditEvent, Domain } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUNTIME_FILE = path.resolve(__dirname, "../data/runtime.json");

interface StoreState {
  resources: AppResource[];
  requests: AppRequest[];
  allocations: AppAllocation[];
  audit: AuditEvent[];
}

let memory: StoreState = { resources: [], requests: [], allocations: [], audit: [] };
let mongoReady = false;

// --- Mongoose schemas (loose — we own shape in types.ts) ---
const ResourceModel = mongoose.model("Resource", new Schema({ _id: String }, { strict: false, collection: "resources" }));
const RequestModel = mongoose.model("Request", new Schema({ _id: String }, { strict: false, collection: "requests" }));
const AllocationModel = mongoose.model("Allocation", new Schema({ _id: String }, { strict: false, collection: "allocations" }));
const AuditModel = mongoose.model("Audit", new Schema({ _id: String }, { strict: false, collection: "audit" }));

function persistMemory() {
  if (mongoReady) return;
  fs.mkdirSync(path.dirname(RUNTIME_FILE), { recursive: true });
  fs.writeFileSync(RUNTIME_FILE, JSON.stringify(memory, null, 2));
}

function loadMemory() {
  if (fs.existsSync(RUNTIME_FILE)) {
    try { memory = JSON.parse(fs.readFileSync(RUNTIME_FILE, "utf8")); }
    catch { memory = { resources: [], requests: [], allocations: [], audit: [] }; }
  }
}

export async function initStore(): Promise<"mongo" | "memory"> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    loadMemory();
    return "memory";
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3500 });
    mongoReady = true;
    console.log("[store] MongoDB connected.");
    return "mongo";
  } catch (e) {
    console.warn("[store] MongoDB connect failed, using in-memory store:", (e as Error).message);
    loadMemory();
    mongoReady = false;
    return "memory";
  }
}

export function isMongo() { return mongoReady; }

// --- Resources ---
export async function listResources(domain?: Domain): Promise<AppResource[]> {
  if (mongoReady) return (await ResourceModel.find(domain ? { domain } : {}).lean()) as any[];
  return memory.resources.filter(r => !domain || r.domain === domain);
}
export async function getResource(id: string): Promise<AppResource | null> {
  if (mongoReady) return (await ResourceModel.findById(id).lean()) as any;
  return memory.resources.find(r => r._id === id) || null;
}
export async function upsertResource(r: AppResource) {
  if (mongoReady) {
    await ResourceModel.replaceOne({ _id: r._id }, r, { upsert: true });
    return;
  }
  const i = memory.resources.findIndex(x => x._id === r._id);
  if (i >= 0) memory.resources[i] = r; else memory.resources.push(r);
  persistMemory();
}
export async function bulkUpsertResources(items: AppResource[]) {
  if (mongoReady) {
    await ResourceModel.bulkWrite(items.map(r => ({ replaceOne: { filter: { _id: r._id }, replacement: r, upsert: true } })));
    return;
  }
  for (const r of items) {
    const i = memory.resources.findIndex(x => x._id === r._id);
    if (i >= 0) memory.resources[i] = r; else memory.resources.push(r);
  }
  persistMemory();
}

// --- Requests ---
export async function listRequests(filter: { domain?: Domain; status?: string } = {}): Promise<AppRequest[]> {
  if (mongoReady) return (await RequestModel.find(filter).lean()) as any[];
  return memory.requests.filter(r =>
    (!filter.domain || r.domain === filter.domain) &&
    (!filter.status || r.status === filter.status)
  );
}
export async function getRequest(id: string): Promise<AppRequest | null> {
  if (mongoReady) return (await RequestModel.findById(id).lean()) as any;
  return memory.requests.find(r => r._id === id) || null;
}
export async function upsertRequest(r: AppRequest) {
  if (mongoReady) {
    await RequestModel.replaceOne({ _id: r._id }, r, { upsert: true });
    return;
  }
  const i = memory.requests.findIndex(x => x._id === r._id);
  if (i >= 0) memory.requests[i] = r; else memory.requests.push(r);
  persistMemory();
}
export async function bulkUpsertRequests(items: AppRequest[]) {
  if (mongoReady) {
    await RequestModel.bulkWrite(items.map(r => ({ replaceOne: { filter: { _id: r._id }, replacement: r, upsert: true } })));
    return;
  }
  for (const r of items) {
    const i = memory.requests.findIndex(x => x._id === r._id);
    if (i >= 0) memory.requests[i] = r; else memory.requests.push(r);
  }
  persistMemory();
}

// --- Allocations ---
export async function listAllocations(filter: { domain?: Domain } = {}): Promise<AppAllocation[]> {
  if (mongoReady) return (await AllocationModel.find(filter).sort({ allocated_at: -1 }).lean()) as any[];
  return memory.allocations.filter(a => !filter.domain || a.domain === filter.domain);
}
export async function addAllocation(a: AppAllocation) {
  if (mongoReady) { await AllocationModel.create(a); return; }
  memory.allocations.push(a);
  persistMemory();
}
export async function getAllocation(id: string): Promise<AppAllocation | null> {
  if (mongoReady) return (await AllocationModel.findById(id).lean()) as any;
  return memory.allocations.find(a => a._id === id) || null;
}

// --- Audit ---
export async function addAudit(e: AuditEvent) {
  if (mongoReady) { await AuditModel.create(e); return; }
  memory.audit.push(e);
  persistMemory();
}
export async function listAudit(domain?: Domain): Promise<AuditEvent[]> {
  const all = mongoReady
    ? ((await AuditModel.find(domain ? { domain } : {}).sort({ timestamp: -1 }).limit(100).lean()) as any[])
    : memory.audit.filter(e => !domain || e.domain === domain || e.domain === "system").slice(-100).reverse();
  return all;
}

// --- Reset (seed) ---
export async function resetAll(seed: StoreState, domainOnly?: Domain) {
  if (mongoReady) {
    if (domainOnly) {
      await Promise.all([
        ResourceModel.deleteMany({ domain: domainOnly }),
        RequestModel.deleteMany({ domain: domainOnly }),
        AllocationModel.deleteMany({ domain: domainOnly }),
        AuditModel.deleteMany({ domain: domainOnly }),
      ]);
    } else {
      await Promise.all([
        ResourceModel.deleteMany({}),
        RequestModel.deleteMany({}),
        AllocationModel.deleteMany({}),
        AuditModel.deleteMany({}),
      ]);
    }
    if (seed.resources.length) await ResourceModel.insertMany(seed.resources as any);
    if (seed.requests.length) await RequestModel.insertMany(seed.requests as any);
    if (seed.allocations.length) await AllocationModel.insertMany(seed.allocations as any);
    if (seed.audit.length) await AuditModel.insertMany(seed.audit as any);
    return;
  }
  if (domainOnly) {
    memory.resources = memory.resources.filter(r => r.domain !== domainOnly).concat(seed.resources);
    memory.requests = memory.requests.filter(r => r.domain !== domainOnly).concat(seed.requests);
    memory.allocations = memory.allocations.filter(a => a.domain !== domainOnly).concat(seed.allocations);
    memory.audit = memory.audit.filter(e => e.domain !== domainOnly).concat(seed.audit);
  } else {
    memory = seed;
  }
  persistMemory();
}

export async function counts(domain: Domain) {
  const [res, reqs] = await Promise.all([listResources(domain), listRequests({ domain })]);
  return {
    free: res.filter(r => r.available).length,
    total_resources: res.length,
    waiting: reqs.filter(r => r.status === "waiting").length,
    allocated_today: reqs.filter(r => r.status === "allocated").length,
  };
}
