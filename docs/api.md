# API Reference

Complete REST endpoint reference for the Smart Bed Allocation backend.

- **Base URL (dev):** `http://localhost:4000`. Vite proxies `/api/*` from `http://localhost:5173` to the API in development.
- **Base URL (prod):** whatever you configure as `VITE_API_URL` in the Vercel/Netlify deploy.
- **Content type:** JSON in, JSON out. All bodies are validated with Zod — invalid shapes return `400` with `details`.
- **Auth:** staff routes require `Authorization: Bearer <jwt>`. Public routes are marked `(public)`.
- **CORS:** permissive in development. Set `WEB_ORIGIN` in production to the deployed web URL.

The full endpoint list sits behind [`docs/architecture.md`](architecture.md) (system) and [`docs/flowcharts.md`](flowcharts.md) (per-path flow diagrams).

---

## Table of contents

1. [Health](#health)
2. [Auth](#auth)
3. [Domains](#domains)
4. [Resources](#resources)
5. [Requests](#requests) (implicit Hungarian)
6. [Queue](#queue)
7. [Allocations](#allocations)
8. [Audit](#audit)
9. [Triage](#triage)
10. [Seed / reset](#seed)
11. [Beds dashboard](#beds)
12. [Labs dashboard](#labs)

---

## Health

### `GET /api/health`

```json
{
  "ok": true,
  "storage": "in-memory",
  "claude_key_present": false,
  "time": "2026-04-18T03:12:45.123Z"
}
```

---

## Auth

### `POST /api/auth/login`  (public)

Request:
```json
{ "username": "admin", "password": "hackathon2026" }
```

Response (200):
```json
{ "token": "eyJhbGci...", "username": "admin" }
```

Response (401): `{ "error": "invalid credentials" }`

Token is valid for 12 hours. Include in subsequent requests as `Authorization: Bearer <token>`.

---

## Domains

### `GET /api/domains`  (public)

Returns metadata for every wired domain. Currently only `hospital`.

```json
[
  {
    "id": "hospital",
    "label": "Hospital Beds",
    "emoji": "🏥",
    "venue": "Lucknow Civil Hospital",
    "submit_cta": "Request a bed",
    "stats": { "free": 38, "total_resources": 48, "waiting": 0, "allocated_today": 10 }
  }
]
```

---

## Resources

### `GET /api/resources?domain=hospital&kind=bed`  (public)

Query params:
- `domain` — required for hospital-scoped results.
- `kind` — `bed` (default) · `lab` · `all`.

Returns `ResourceRow[]`. Beds and labs share the same shape; differences are in `metadata.kind`.

---

## Requests

### `GET /api/requests?domain=hospital&status=waiting`  (public)

Returns `RequestRow[]`.

### `POST /api/requests`  (public — **triggers implicit Hungarian**)

Request body:
```json
{
  "domain": "hospital",
  "requester_name": "Ramesh Yadav",
  "phone": "+919876543210",
  "city": "Lucknow",
  "description": "chest pain, BP 160/100, sweating",
  "vulnerability_flags": ["senior_citizen"]
}
```

Response (200):
```json
{
  "_id": "req_abc123",
  "domain": "hospital",
  "requester_name": "Ramesh Yadav",
  "urgency": 8,
  "status": "allocated",
  "ai_extracted": { "source": "rule", "acuity_hint": "critical", ... },
  "auto_allocated": true,
  "allocation": {
    "_id": "alloc_xyz",
    "resource_id": "bed_abc",
    "score": 78,
    "breakdown": { "urgency": 32, "wait": 0, "vulnerability": 20, "rules": 20, "total": 78 },
    "justification": "Ramesh Yadav → Bed 3. urgency 8 · senior_citizen · matched \"chest pain\". Score 78.",
    "sms_preview": "Hello Ramesh Yadav, bed Bed 3 assigned..."
  }
}
```

If no bed is free: `auto_allocated: false`, `allocation: null`, `status: "waiting"`.

---

## Queue

### `GET /api/queue?domain=hospital`  (public)

Returns the live priority queue (waiting requests, sorted by score):

```json
[
  {
    "request": { ... RequestRow ... },
    "score": 78,
    "breakdown": { "urgency": 32, "wait": 0, "vulnerability": 20, "rules": 20, "total": 78 },
    "matchedRules": ["chest pain"],
    "why": "urgency 8 · senior_citizen · matched \"chest pain\""
  }
]
```

---

## Allocations

### `GET /api/allocations?domain=hospital`  (public)

Returns `AllocationRow[]`, newest first.

### `POST /api/allocations/auto?domain=hospital`  (staff)

Manual trigger for Hungarian. Rarely needed — the `/api/requests` endpoint already runs Hungarian on every new submission. Kept as an escape hatch.

Response:
```json
{ "created": 3, "allocations": [...], "algorithm": "hungarian" }
```

> `POST /api/allocations` (manual single-allocation) was **removed**. Returns 404.

---

## Audit

### `GET /api/audit?domain=hospital`  (public)

Last 100 audit events:
```json
[
  {
    "_id": "aud_abc",
    "domain": "hospital",
    "event": "allocation:auto",
    "actor": "system",
    "payload": { "requestId": "req_...", "resourceId": "bed_...", "score": 78, "algo": "hungarian" },
    "timestamp": "2026-04-18T03:12:45.123Z"
  }
]
```

Event kinds:
- `request:created`
- `allocation:auto` (Hungarian match)
- `bed:admit`, `bed:bump`
- `lab:assign`, `lab:emergency_toggle`, `lab:maintenance`, `lab:available`, `lab:reset`
- `seed:reset`

---

## Triage

### `POST /api/triage`  (public)

Takes a description, returns an urgency guess:

```json
{ "description": "chest pain, BP 160", "domain": "hospital" }
```

Response:
```json
{
  "urgency": 8,
  "acuity_hint": "critical",
  "domain_keywords": ["chest pain"],
  "source": "rule"
}
```

`source` is `"claude"` if `ANTHROPIC_API_KEY` is set, else `"rule"`.

---

## Seed

### `POST /api/seed?domain=hospital`  (public in demo)

Resets the hospital resources, requests, allocations, and audit log to the default seed. Used by the e2e tests and the "Reset demo" flow.

Response:
```json
{ "ok": true, "domain": "hospital", "resources": 78, "requests": 5 }
```

---

## Beds

All bed routes go through `services/smart-beds.ts`. Mutations are **staff-only** (JWT required).

### `GET /api/beds`  (public)

```json
{
  "beds": [
    {
      "_id": "bed_abc",
      "block": "ICU Wing",
      "block_id": "icu",
      "row": "priority",
      "number": 1,
      "status": "occupied",
      "patient": {
        "patient_id": "P-48123",
        "name": "Ramesh Yadav",
        "medical_condition": "Cardiac arrest · post-CPR",
        "risk_level": "high",
        "admitted_at": "2026-04-18T00:12:00.000Z"
      }
    }
  ],
  "queue": [ ... PatientInfo ... ],
  "transfers": [ ... TransferEvent ... ]
}
```

### `POST /api/beds/admit`  (staff)

```json
{
  "name": "Sunita Kumar",
  "medical_condition": "acute asthma",
  "risk_level": "high",
  "preferred_block": "icu"
}
```

Logic:
- High-risk → tries priority row in preferred block → falls back to any priority → else bumps lowest-risk priority occupant to regular.
- Low/medium → tries regular row → else queues.

Returns new `BedsState`.

### `POST /api/beds/{id}/risk`  (staff)

```json
{ "risk_level": "high" }
```

Triggers smart promotion/demotion and queue pull-in. Returns new `BedsState`.

### `POST /api/beds/{id}/transfer`  (staff)

```json
{ "target": "priority" }
```

Manually moves the patient to a bed in the target row (same block preferred).

### `POST /api/beds/{id}/discharge`  (staff)

Clears the bed. If anyone is queued, pulls them in automatically.

---

## Labs

All lab routes go through `services/smart-labs.ts`.

### `GET /api/labs`  (public)

```json
{
  "labs": [
    {
      "_id": "lab_abc",
      "block": "Pathology",
      "block_id": "pathology",
      "number": 1,
      "lab_id": "LAB-01",
      "room_no": "101",
      "status": "available",
      "emergency": false,
      "assigned_to": null,
      "assigned_at": null
    }
  ],
  "queue": [...],
  "transfers": [...]
}
```

### `POST /api/labs/{id}/emergency`  (staff)

Toggles `emergency` flag. If turning ON while `in_use`, the current test is preempted into the queue.

### `POST /api/labs/{id}/maintenance`  (staff)

Toggles between `maintenance` and `available`. If turning ON while `in_use`, the current test is preempted.

### `POST /api/labs/{id}/assign`  (staff)

```json
{ "patient_name": "Sunita", "request_type": "CBC" }
```

Rejects if lab is in maintenance. Rejects if lab is in use and emergency is OFF. Succeeds (with preemption) if emergency is ON.

### `POST /api/labs/{id}/reset`  (staff)

Clears assignment, sets status to `available`, clears emergency flag.

---

## Error format

All 4xx/5xx responses:
```json
{ "error": "short human-readable message" }
```

Validation failures (`400`) may include `details` with Zod field errors.

---

## CORS

- Development: permissive if `WEB_ORIGIN` is not set.
- Production: **set `WEB_ORIGIN`** to the deployed web URL. See the audit section of the README.
