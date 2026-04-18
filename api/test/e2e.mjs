#!/usr/bin/env node
/**
 * End-to-end test runner for the Smart Bed Allocation API.
 *
 * Exercises the full stack against a running API: auth, request intake,
 * implicit Hungarian allocation, smart bed moves (admit/bump/risk change/
 * discharge), lab lifecycle (emergency/maintenance/assign/reset).
 *
 * Run:    node api/test/e2e.mjs
 * Env:    API_URL (defaults to http://localhost:4100)
 *
 * Zero dependencies — uses the built-in fetch. Reset the store before
 * running if you want deterministic counts (POST /api/seed).
 */

const API_URL = process.env.API_URL || "http://localhost:4100";

let passed = 0;
let failed = 0;
const failures = [];

// ─────────────── helpers ───────────────

function log(kind, line) {
  const palette = { pass: "\x1b[32m✓\x1b[0m", fail: "\x1b[31m✗\x1b[0m", info: "\x1b[36m•\x1b[0m", group: "\x1b[1m" };
  const suffix = kind === "group" ? "\x1b[0m" : "";
  console.log(`${palette[kind] || ""} ${line}${suffix}`);
}

function assert(condition, message) {
  if (condition) { passed++; log("pass", message); return; }
  failed++;
  failures.push(message);
  log("fail", message);
}

async function http(method, path, { body, token } = {}) {
  const r = await fetch(API_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, data };
}

// ─────────────── tests ───────────────

async function testHealth() {
  log("group", "Health + seed");
  const h = await http("GET", "/api/health");
  assert(h.status === 200, "GET /api/health returns 200");
  assert(h.data?.ok === true, "health.ok is true");
}

async function testAuth() {
  log("group", "Auth");
  const bad = await http("POST", "/api/auth/login", { body: { username: "admin", password: "wrong" } });
  assert(bad.status >= 400, "wrong password is rejected");

  const good = await http("POST", "/api/auth/login", { body: { username: "admin", password: "hackathon2026" } });
  assert(good.status === 200, "correct password returns 200");
  assert(typeof good.data?.token === "string" && good.data.token.length > 10, "returns a JWT token");

  const protectedGet = await http("POST", "/api/beds/admit", {
    body: { name: "nope", medical_condition: "nope", risk_level: "low" },
  });
  assert(protectedGet.status === 401, "admit without token is 401");

  return good.data.token;
}

async function testSeedReset(token) {
  log("group", "Reset store");
  const r = await http("POST", "/api/seed", { token });
  assert(r.status === 200, "POST /api/seed works");
  assert(r.data?.ok === true, "seed returns ok");
  assert(r.data.resources >= 78, `seeded ${r.data.resources} resources (>=78 expected)`);
}

async function testDomainsHospitalOnly() {
  log("group", "Domain confinement");
  const d = await http("GET", "/api/domains");
  assert(d.status === 200, "GET /api/domains returns 200");
  assert(Array.isArray(d.data) && d.data.length === 1, "exactly one domain returned");
  assert(d.data[0].id === "hospital", "domain is hospital");
}

async function testImplicitHungarian() {
  log("group", "Implicit Hungarian on POST /api/requests");
  const body = {
    domain: "hospital",
    requester_name: "E2E Test User",
    phone: "+919876543210",
    city: "Lucknow",
    description: "chest pain, sweating, BP 160/100, suspected MI",
    vulnerability_flags: ["senior_citizen"],
  };
  const r = await http("POST", "/api/requests", { body });
  assert(r.status === 200, "POST /api/requests returns 200");
  assert(r.data?._id?.startsWith("req_"), "returns a request id");
  assert(r.data.auto_allocated === true, "auto_allocated flag is true");
  assert(r.data.allocation?.resource_id?.startsWith("bed_"), "allocated to a real bed resource");
  assert(typeof r.data.allocation?.score === "number" && r.data.allocation.score > 0, "score is computed");
  assert(r.data.allocation?.sms_preview?.length > 10, "SMS preview generated");
}

async function testManualEndpointGone() {
  log("group", "Manual allocation endpoint removed");
  const r = await http("POST", "/api/allocations", {
    body: { request_id: "x", resource_id: "y" },
    token: "fake",
  });
  assert(r.status === 404, "POST /api/allocations returns 404 (endpoint removed)");
}

async function testBedsStateShape() {
  log("group", "Beds state shape");
  const s = await http("GET", "/api/beds");
  assert(s.status === 200, "GET /api/beds returns 200");
  assert(Array.isArray(s.data.beds) && s.data.beds.length === 48, "48 beds (4 blocks)");
  const numbers = s.data.beds.map(b => b.number).sort((a, b) => a - b);
  const continuous = numbers.every((n, i) => n === i + 1);
  assert(continuous, "beds are continuously numbered 1..48");
  const blocks = new Set(s.data.beds.map(b => b.block_id));
  assert(blocks.size === 4, `4 distinct blocks (${[...blocks].join(", ")})`);
  const rows = new Set(s.data.beds.map(b => b.row));
  assert(rows.has("priority") && rows.has("regular"), "both priority and regular rows present");
}

async function fillAllPriority(token, block, existingState) {
  // Count priority free in a block. Admit enough high-risk patients to fill.
  let state = existingState;
  const blockBeds = state.beds.filter(b => b.block_id === block);
  let priorityFree = blockBeds.filter(b => b.row === "priority" && b.status === "available").length;
  for (let i = 0; i < priorityFree; i++) {
    const r = await http("POST", "/api/beds/admit", {
      body: { name: `Filler ${block} ${i}`, medical_condition: "seed fill", risk_level: "high", preferred_block: block },
      token,
    });
    if (r.status !== 200) throw new Error(`filler admit failed: ${JSON.stringify(r.data)}`);
    state = r.data;
  }
  return state;
}

async function testSmartBedAllocation(token) {
  log("group", "Smart bed allocation logic");

  // Fresh state via reset
  await http("POST", "/api/seed", { token });
  let state = (await http("GET", "/api/beds")).data;

  // 1. Normal medium-risk admit goes to regular
  const med = await http("POST", "/api/beds/admit", {
    body: { name: "Medium Patient", medical_condition: "observation", risk_level: "medium", preferred_block: "general" },
    token,
  });
  assert(med.status === 200, "medium-risk admit returns 200");
  state = med.data;
  const medPatient = state.beds.find(b => b.patient?.name === "Medium Patient");
  assert(!!medPatient, "medium patient found");
  assert(medPatient?.row === "regular", "medium risk → regular row");

  // 2. High-risk admit goes to priority
  const high = await http("POST", "/api/beds/admit", {
    body: { name: "High Risk Patient", medical_condition: "cardiac arrest", risk_level: "high", preferred_block: "icu" },
    token,
  });
  state = high.data;
  const highPatient = state.beds.find(b => b.patient?.name === "High Risk Patient");
  assert(highPatient?.row === "priority", "high risk → priority row");
  assert(highPatient?.block_id === "icu", "high-risk patient placed in preferred ICU block");

  // 3. Fill all ICU priority beds, then admit another high-risk → BUMP
  state = await fillAllPriority(token, "icu", state);
  const icuFreePriorityBefore = state.beds.filter(b => b.block_id === "icu" && b.row === "priority" && b.status === "available").length;
  assert(icuFreePriorityBefore === 0, "ICU priority row is full before bump test");

  // Find a lower-risk patient in ICU priority to confirm they get bumped.
  // (Our fillers are all high — but ICU seed also has some high patients.
  //  To force a bump, first change one of the ICU priority patients' risk
  //  to medium so they become the bump candidate.)
  const victim = state.beds.find(b => b.block_id === "icu" && b.row === "priority" && b.patient);
  const victimId = victim._id;
  const demoted = await http("POST", `/api/beds/${victimId}/risk`, {
    body: { risk_level: "medium" },
    token,
  });
  assert(demoted.status === 200, "risk change to medium succeeds");
  state = demoted.data;
  // The system may have auto-moved the demoted patient to regular already;
  // re-check what's in the bed.
  const bedAfterDemote = state.beds.find(b => b._id === victimId);
  const icuPriorityFreeNow = state.beds.filter(b => b.block_id === "icu" && b.row === "priority" && b.status === "available").length;

  // If a priority bed freed automatically, admit another high-risk ICU patient to refill.
  if (icuPriorityFreeNow > 0) {
    const fill = await http("POST", "/api/beds/admit", {
      body: { name: "Refill High", medical_condition: "trauma", risk_level: "high", preferred_block: "icu" },
      token,
    });
    state = fill.data;
  }

  // Now ICU priority is full again. Admit a new high-risk → should bump.
  const bumpCandidate = await http("POST", "/api/beds/admit", {
    body: { name: "Bumper", medical_condition: "stroke", risk_level: "high", preferred_block: "icu" },
    token,
  });
  assert(bumpCandidate.status === 200, "high-risk admit into full ICU returns 200");
  state = bumpCandidate.data;
  const bumper = state.beds.find(b => b.patient?.name === "Bumper");
  const bumpEvent = state.transfers.find(t => t.kind === "bump_to_regular");
  if (bumper?.row === "priority") {
    assert(true, "Bumper got a priority bed (by bump or freed slot)");
  } else {
    assert(false, "Bumper did not land in a priority bed — expected bump");
  }
  assert(!!bumpEvent, "a bump_to_regular transfer was logged");

  // 4. Risk upgrade test — patient in regular, escalate to high
  const anyRegular = state.beds.find(b => b.row === "regular" && b.status === "occupied" && b.patient?.risk_level !== "high");
  if (anyRegular) {
    const escalated = await http("POST", `/api/beds/${anyRegular._id}/risk`, {
      body: { risk_level: "high" },
      token,
    });
    assert(escalated.status === 200, "risk escalation returns 200");
    const patient = anyRegular.patient;
    state = escalated.data;
    const wherePatient = state.beds.find(b => b.patient?.patient_id === patient.patient_id);
    // Either still in regular (if no priority free) or promoted — both are valid outcomes.
    assert(wherePatient?.patient?.risk_level === "high", "patient risk is now high after escalation");
  }

  // 5. Discharge
  const occupied = state.beds.find(b => b.status === "occupied");
  const disch = await http("POST", `/api/beds/${occupied._id}/discharge`, { token });
  assert(disch.status === 200, "discharge returns 200");
  state = disch.data;
  assert(state.beds.find(b => b._id === occupied._id)?.status === "available", "discharged bed is now available");
}

async function testSmartLabs(token) {
  log("group", "Smart lab scheduling");
  await http("POST", "/api/seed", { token });
  let state = (await http("GET", "/api/labs")).data;
  assert(state.labs.length === 30, "30 labs (6 blocks × 5)");

  const firstAvailable = state.labs.find(l => l.status === "available");

  // Assign → should succeed and move to in_use
  const a = await http("POST", `/api/labs/${firstAvailable._id}/assign`, {
    body: { patient_name: "Test Patient", request_type: "CBC" },
    token,
  });
  assert(a.status === 200, "assign returns 200");
  state = a.data;
  const afterAssign = state.labs.find(l => l._id === firstAvailable._id);
  assert(afterAssign?.status === "in_use", "lab is now in_use");
  assert(afterAssign?.assigned_to?.includes("Test Patient"), "assigned_to records the patient");

  // Assigning again without emergency → should fail
  const aa = await http("POST", `/api/labs/${firstAvailable._id}/assign`, {
    body: { patient_name: "Another", request_type: "MRI" },
    token,
  });
  assert(aa.status >= 400, "second assign without emergency is rejected");

  // Toggle emergency → then assign new patient → preempt
  const em = await http("POST", `/api/labs/${firstAvailable._id}/emergency`, { token });
  assert(em.status === 200, "emergency toggle returns 200");
  state = em.data;
  assert(state.labs.find(l => l._id === firstAvailable._id)?.emergency === true, "emergency flag is true");

  const aa2 = await http("POST", `/api/labs/${firstAvailable._id}/assign`, {
    body: { patient_name: "Urgent STAT", request_type: "troponin" },
    token,
  });
  assert(aa2.status === 200, "assign during emergency succeeds (preemption)");
  state = aa2.data;
  assert(state.queue.length >= 1, "preempted test landed in queue");

  // Maintenance — cannot assign
  const maint = state.labs.find(l => l.status === "maintenance");
  if (maint) {
    const rej = await http("POST", `/api/labs/${maint._id}/assign`, {
      body: { patient_name: "Nope", request_type: "x-ray" },
      token,
    });
    assert(rej.status >= 400, "assigning to maintenance lab is rejected");
  }

  // Reset
  const rst = await http("POST", `/api/labs/${firstAvailable._id}/reset`, { token });
  assert(rst.status === 200, "reset returns 200");
  state = rst.data;
  assert(state.labs.find(l => l._id === firstAvailable._id)?.status === "available", "lab is available after reset");
  assert(state.labs.find(l => l._id === firstAvailable._id)?.emergency === false, "emergency flag cleared after reset");
}

async function testPhoneValidationAtApi() {
  log("group", "API input validation");
  const bad = await http("POST", "/api/requests", {
    body: {
      domain: "hospital",
      requester_name: "X",   // too short
      phone: "abc",           // non-digit
      city: "Lucknow",
      description: "test",
    },
  });
  assert(bad.status === 400, "invalid payload is rejected at API (400)");
}

async function testForecastRemoved() {
  log("group", "Forecast feature removed");
  const r = await http("GET", "/api/forecast");
  assert(r.status === 404, "GET /api/forecast is 404");
}

async function run() {
  console.log(`\nRunning e2e tests against ${API_URL}\n`);
  await testHealth();
  const token = await testAuth();
  await testSeedReset(token);
  await testDomainsHospitalOnly();
  await testImplicitHungarian();
  await testManualEndpointGone();
  await testForecastRemoved();
  await testBedsStateShape();
  await testSmartBedAllocation(token);
  await testSmartLabs(token);
  await testPhoneValidationAtApi();

  console.log(`\n\x1b[1mResult:\x1b[0m ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\n\x1b[31mFailures:\x1b[0m");
    for (const f of failures) console.log("  - " + f);
    process.exit(1);
  }
  process.exit(0);
}

run().catch(e => {
  console.error("\x1b[31mTest runner crashed:\x1b[0m", e);
  process.exit(2);
});
