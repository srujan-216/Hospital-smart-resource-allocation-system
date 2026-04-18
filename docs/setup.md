# Setup

Install, run locally, and deploy the Smart Bed Allocation app. Designed to go from `git clone` to a working demo in under two minutes, with zero infrastructure.

---

## Prerequisites

- **Node.js 20+** (`node --version`)
- A browser
- **Nothing else.** No Docker, no Postgres, no Redis. The API falls back to an in-memory JSON store if MongoDB isn't configured.

---

## Install + run

```bash
# From the repo root
git clone <repo-url> smart-bed-allocation
cd smart-bed-allocation

# 1. API
cd api
npm install
cp ../.env.example ../.env     # optional — defaults are fine
npm run dev                    # → http://localhost:4000

# 2. Web (in a new terminal)
cd web
npm install
npm run dev                    # → http://localhost:5173
```

Open **http://localhost:5173/**.

---

## First-boot behaviour

On API startup, if the store is empty, `server.ts` seeds:
- 48 beds (ICU · General · Pediatric · Isolation)
- 30 labs (6 blocks × 5)
- 5 sample pending requests
- 10 beds pre-occupied with demo patients (mixed risk levels)
- 2 labs in maintenance, 2 in use (one with emergency mode)

You'll see:
```
[store] mode: memory
[seed] auto-seeded 78 resources + 5 requests
[api] listening on http://localhost:4000
```

---

## Staff login

```
Username: admin
Password: hackathon2026
```

After signing in at `/login`, you're redirected to `/dashboard/beds`.

Override the demo credentials in `.env`:
```
ADMIN_USERNAME=your-name
ADMIN_PASSWORD=your-password
JWT_SECRET=long-random-string
```

---

## Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `API_PORT` | `4000` | API listen port |
| `WEB_ORIGIN` | (permissive in dev) | CORS origin — set to the web URL in prod |
| `JWT_SECRET` | `change-me-in-production` | Rotate this for real deployments |
| `ADMIN_USERNAME` | `admin` | Staff login |
| `ADMIN_PASSWORD` | `hackathon2026` | Staff login |
| `MONGODB_URI` | empty | If blank, uses in-memory store |
| `ANTHROPIC_API_KEY` | empty | If blank, triage uses rule-based fallback |

---

## Running on different ports

Useful if port 4000 or 5173 is in use:

```bash
# API on 4100
cd api
API_PORT=4100 WEB_ORIGIN=http://localhost:5273 npm run dev

# Web on 5273, proxying to API on 4100
cd web
WEB_PORT=5273 API_URL=http://localhost:4100 npm run dev
```

---

## Reset demo state

Three ways:

1. **Via the API** (no auth needed):
   ```bash
   curl -X POST http://localhost:4000/api/seed
   ```
2. **Delete the runtime file** and restart:
   ```bash
   rm api/data/runtime.json
   ```
3. **Built-in** — the seed auto-runs any time the store is empty.

---

## Running the tests

```bash
cd api
npm run test:e2e
```

**53 tests**, all passing. The tests hit the live API (so it must be running on `http://localhost:4000`, or set `API_URL` in the env).

---

## Deployment

### Web — Vercel
```
Root:    web/
Build:   npm run build
Output:  dist/
```
Set `VITE_API_URL` in Vercel env to your deployed API URL, or configure a rewrite rule at `/api/*`.

### API — Render / Railway / Fly
```
Build:   cd api && npm install
Start:   cd api && npm start
Env:
  WEB_ORIGIN=https://your-web.vercel.app
  JWT_SECRET=...
  ADMIN_USERNAME=...
  ADMIN_PASSWORD=...
  MONGODB_URI=mongodb+srv://...      # optional
  ANTHROPIC_API_KEY=...              # optional
```

### Database — MongoDB Atlas (optional)
Free tier. Paste the connection string into `MONGODB_URI`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE: :::4000` | Kill the existing process: `netstat -ano \| grep :4000`, `taskkill //F //PID <pid>` |
| API starts but web shows "API unreachable" | Vite proxy points at `http://localhost:4000`. Check the API port and update `web/vite.config.ts` if different. |
| Staff login fails | Check `.env` — `ADMIN_USERNAME` / `ADMIN_PASSWORD` |
| Dashboard shows stale state after re-seed | Hard refresh (Ctrl+Shift+R) to clear the 8s poll cache |
| Tests fail on a fresh clone | Make sure the API is running before `npm run test:e2e` |
