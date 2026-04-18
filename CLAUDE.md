# CLAUDE.md

Guidance for Claude Code (and other AI assistants) when working in this repository.

---

## What this project is

**Smart Bed Allocation** — a hospital admission engine for a single hospital. Takes citizen-submitted requests, scores them transparently, and uses the Hungarian algorithm to match patients to beds automatically. Staff manage bed and lab resources through a dashboard with priority/regular rows and real-time smart reallocation.

**One domain only:** `hospital`. The codebase still contains dormant branches for `lab`/`govt`/`ambulance` domains in `matching.ts` and the `Domain` type — those are not wired into the UI or seed data. Leave them alone unless the user explicitly asks to re-enable them.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Node 20 · Express · TypeScript · tsx watch · Zod |
| Storage | MongoDB (optional) OR in-memory JSON file |
| Auth | JWT (demo creds: `admin` / `hackathon2026`) |
| Frontend | React 18 · Vite · TypeScript · Tailwind · Lucide icons · react-router v6 |
| AI | Anthropic SDK (optional) · rule-based fallback always works |

---

## Critical invariants (do not break)

1. **Hungarian is implicit.** There is NO "Run Hungarian" button. `POST /api/requests` calls `performAutoAllocation()` inline. If you find yourself adding a button to trigger allocation, stop.
2. **Beds have `kind: "bed"` metadata; labs have `kind: "lab"`.** The `/api/resources` endpoint filters to `kind=bed` by default. `auto-allocate.ts` filters the same way, so new lab resources never show up as bed match candidates.
3. **Continuous numbering** across all bed blocks (1..48) and all lab blocks (1..30). If you add a block, renumber everything in `dashboard-seed.ts`.
4. **Hospital-only in the UI.** Home.tsx hardcodes `find(x => x.id === "hospital")`. The Domain type still has 4 values; that's intentional for future re-expansion.
5. **Forecast was deleted.** No `/api/forecast`, no `pages/Forecast.tsx`, no `seed-history.ts`. Do not reintroduce unless asked.
6. **Hindi i18n was removed.** `i18n.ts` is English-only; `useI18n()` is a vestigial helper kept so existing `t("key")` calls compile. Don't re-add a language toggle.

---

## File-by-file cheat sheet

### Backend — `api/src/`

| Path | Role |
|---|---|
| `server.ts` | Express wiring; mounts all routers; auto-seeds on first boot |
| `store.ts` | Storage adapter — same interface over Mongo and in-memory JSON |
| `types.ts` | Zod schemas + TS types for requests/resources/allocations |
| `middleware/auth.ts` | JWT middleware. Staff routes use `requireAdmin` |
| `data/seed-data.ts` | Hospital seed (invokes `buildBedResources` + `buildLabResources`, pre-occupies beds) |
| `data/dashboard-seed.ts` | Block definitions (ICU/General/Pediatric/Isolation + 6 lab blocks). This is the source of truth for block structure |
| `services/scoring.ts` | Priority formula (urgency×40 + wait×20 + vuln×20 + rules×20) |
| `services/triage.ts` | Rule-based + optional Claude triage; extracts urgency 1-10 |
| `services/matching.ts` | Cost matrix + `runHungarian()` |
| `services/hungarian.ts` | Jonker–Volgenant O(n³). Pure function, no state |
| `services/queue.ts` | Builds the live waitlist DTO |
| `services/auto-allocate.ts` | `performAutoAllocation()` — shared by `POST /api/requests` and `POST /api/allocations/auto` |
| `services/smart-beds.ts` | All bed admission logic. `admitPatient` / `changeRisk` / `transferBed` / `discharge`. Queue + transfer log are in-memory module state |
| `services/smart-labs.ts` | Lab lifecycle. `toggleEmergency` / `toggleMaintenance` / `assign` / `reset`. Same queue+transfer pattern |
| `routes/beds.ts` | Thin HTTP wrapper over `smart-beds.ts` |
| `routes/labs.ts` | Thin HTTP wrapper over `smart-labs.ts` |
| `routes/requests.ts` | `POST` triggers implicit Hungarian via `performAutoAllocation` |
| `routes/allocations.ts` | `GET /api/allocations` + kept-for-emergencies `POST /api/allocations/auto` |
| `test/e2e.mjs` | Self-contained integration test (53 tests) — run with `npm run test:e2e` |

### Frontend — `web/src/`

| Path | Role |
|---|---|
| `App.tsx` | Router — public routes `/`, `/login`, `/d/hospital/{request,queue}`, staff routes `/dashboard/{beds,labs}` |
| `main.tsx` | BrowserRouter with `v7_*` future flags enabled |
| `pages/Home.tsx` | Hero + live stats + 3 USP cards |
| `pages/Login.tsx` | Staff login with gradient promo panel |
| `pages/Request.tsx` | Public intake form with phone/date/name validation |
| `pages/Queue.tsx` | Public live queue with score bars |
| `pages/Dashboard.tsx` | Staff dashboard with sidebar + Beds/Labs tabs. Long file — search for `BedsPane` and `LabsPane` |
| `components/Layout.tsx` | Header (logo + nav + login/logout) + footer |
| `components/Toaster.tsx` | Global toast notifications (driven by `lib/toast.ts`) |
| `components/VulnerabilityChips.tsx` | Tap-to-toggle pregnancy/disabled/senior/etc. flags |
| `components/ScoreBars.tsx` | 4-colour breakdown bars |
| `components/Modal.tsx` | Reusable modal with esc-to-close |
| `components/dashboard/ResourceBlock.tsx` | Block header + stats strip |
| `components/dashboard/ResourceUnit.tsx` | `BedUnitTile` and `LabUnitTile` — the visual atoms |
| `components/dashboard/QueuePanel.tsx` | Right-side panel: patient queue + transfer log |
| `components/dashboard/BedDetailPanel.tsx` | Click-bed → profile + risk toggle + transfer + discharge |
| `components/dashboard/LabDetailPanel.tsx` | Click-lab → emergency + maintenance + assign + reset |
| `components/dashboard/AdmitPatientModal.tsx` | Staff admit form with vulnerabilities + validation |
| `components/dashboard/blockChoices.ts` | 4 bed block choices with emoji for the admit modal |
| `lib/api.ts` | Typed API client. All backend interactions go through here |
| `lib/auth.ts` | `isAdmin()`, `setAdminToken()`, etc. Reads from localStorage |
| `lib/i18n.ts` | English-only strings. Kept because many components still call `useI18n().t(...)` |
| `lib/validators.ts` | `validatePhone` (Indian 10-digit starting with 6-9), `validateDate`, `validateName`, etc. |
| `lib/toast.ts` | Tiny pub-sub for the Toaster |

---

## Common tasks

### Adding a new bed block
1. Edit `api/src/data/dashboard-seed.ts` → `BED_BLOCKS`.
2. Edit `web/src/components/dashboard/blockChoices.ts` to add the admit-modal choice.
3. Edit `web/src/pages/Dashboard.tsx` → the `order` array in `useMemo(() => { const order = [...] })`.
4. Reset runtime: delete `api/data/runtime.json` and restart the API.

### Adding a new lab block
Same pattern as beds but edit `LAB_BLOCKS` and the `order` array in `LabsPane` inside `Dashboard.tsx`.

### Changing priority weights
Edit `api/src/services/scoring.ts`. Update `docs/scoring.md` too.

### Adding a new API endpoint
Create a router in `api/src/routes/`, mount it in `server.ts`. Add the typed client call in `web/src/lib/api.ts`. Update `docs/api.md`.

### Adding a new smart-bed rule
Edit `api/src/services/smart-beds.ts`. All rules live there. Remember to:
- Log a `TransferEvent` via `logTransfer({ resource_ids: [...] })` so the UI flashes the affected beds.
- Add to `addAudit` for the persistent audit log.
- Add an e2e test in `api/test/e2e.mjs`.

---

## Gotchas / non-obvious things

- **`web/src/lib/i18n.ts`** is a vestigial shim. `useI18n()` returns `{ t, lang: "en" }`. Don't rip it out — it's called in many places.
- **`api/src/services/matching.ts`** still has domain-specific preference adjustments (haversine for ambulance, ICU preference for hospital). Hospital is the only wired domain; the ambulance/lab/govt branches are dead code.
- **The `/api/resources` endpoint defaults to `kind=bed`**. If you hit it expecting to see labs, pass `?kind=lab` or `?kind=all`. Lab units should go through `/api/labs` instead.
- **Queue + transfer log in smart-beds.ts / smart-labs.ts are in-memory arrays.** They reset on API restart. That's intentional for demo stability.
- **The `toast(...)` function is event-based** — pushing a toast doesn't mount anything; the `<Toaster />` component listens and renders. If toasts stop appearing, check that `<Toaster />` is mounted in `App.tsx`.

---

## Running the app

```bash
# In api/
npm run dev         # http://localhost:4000 (default) or API_PORT env
npm run test:e2e    # runs 53 tests against live API

# In web/
npm run dev         # http://localhost:5173
```

For a second instance on different ports:
```bash
cd api && API_PORT=4100 WEB_ORIGIN=http://localhost:5273 npm run dev
cd web && WEB_PORT=5273 API_URL=http://localhost:4100 npm run dev
```

---

## Style preferences (from project memory)

- Plain English, no jargon. Glanceable visuals.
- Terse responses when the user is stressed or debugging.
- No emojis in code unless asked.
- Don't add backwards-compat shims or dead-code comments.
- Don't create new docs without asking.
- **CRITICAL:** The word "Aethronix" refers to the hackathon, not the product.
