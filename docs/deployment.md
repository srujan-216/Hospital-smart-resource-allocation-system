# Deployment — 20 minutes to live URLs

Deploy the app to free-tier hosting: **Vercel** for the web frontend, **Render** for the API.

> ⚠️ **Before the day of a demo:** deploying late is risky. Render free tier has cold starts (~45s wake-up after 15 min of idle). If your demo window is <10 min, run locally instead. If you *must* deploy, do it the day before and keep a local fallback ready.

---

## 0. Prerequisites

- A GitHub account (repo pushed)
- A Vercel account (free: https://vercel.com/signup)
- A Render account (free: https://render.com/)

Push your code first:

```bash
cd D:/aethronix
git add -A
git commit -m "Deploy config: Render blueprint + Vercel config"
git push
```

---

## 1. Deploy the API to Render (10 min)

### Option A — Blueprint (uses `render.yaml`, one-click)

1. Go to https://dashboard.render.com/
2. Click **New → Blueprint**
3. Connect your GitHub repo, pick the repository
4. Render reads `render.yaml` and shows the service config. Click **Apply**.
5. It'll fail the first deploy because `ADMIN_PASSWORD` and `WEB_ORIGIN` are empty. That's expected.

### Option B — Manual (if Blueprint doesn't work)

1. Click **New → Web Service**
2. Connect repo
3. Fill:
   - **Root directory:** `api`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Plan:** Free
4. Under **Environment**, add:
   | Key | Value |
   |---|---|
   | `NODE_VERSION` | `20` |
   | `JWT_SECRET` | Click "Generate" |
   | `ADMIN_USERNAME` | `admin` |
   | `ADMIN_PASSWORD` | pick your own |
   | `WEB_ORIGIN` | *(leave blank for now — fill after Vercel)* |
5. Click **Create Web Service**

### After the first deploy

- Render gives you a URL like `https://smart-beds-api.onrender.com`.
- Test it: open `https://smart-beds-api.onrender.com/api/health` — should return JSON `{ "ok": true }`.
- Keep this URL — you'll need it for Vercel.

---

## 2. Deploy the web to Vercel (5 min)

1. Go to https://vercel.com/new
2. Import your GitHub repo
3. Configure:
   - **Framework preset:** Vite
   - **Root directory:** `web`
   - **Build command:** `npm run build` (auto-detected)
   - **Output directory:** `dist` (auto-detected)
4. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://smart-beds-api.onrender.com` *(your Render URL)* |
5. Click **Deploy**.

Vercel gives you a URL like `https://smart-beds.vercel.app`.

---

## 3. Close the loop — CORS

1. Back in Render, open your API service → **Environment**
2. Set `WEB_ORIGIN` to your Vercel URL (e.g. `https://smart-beds.vercel.app`)
   - You can add multiple comma-separated if you deploy preview URLs later
3. Click **Save Changes** — Render will redeploy automatically.

---

## 4. Verify the live app

1. Open `https://smart-beds.vercel.app/`
2. Click **Request a bed** → fill the form → submit
   - You should see a green *"Bed assigned"* card with a bed number
3. Go to `https://smart-beds.vercel.app/login` → sign in (`admin` / your password)
4. You land on `/dashboard/beds` — the live dashboard

If any of these fail, see troubleshooting below.

---

## 5. Running the e2e tests against production

```bash
cd api
API_URL=https://smart-beds-api.onrender.com npm run test:e2e
```

All 53 tests should still pass. The first run may be slow because of Render's cold start.

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Vercel build fails with "cannot find VITE_API_URL" | Env var not set | Add it in Vercel → Project Settings → Environment Variables, then redeploy |
| Dashboard shows "API unreachable" | Wrong `VITE_API_URL` or Render asleep | Hit `/api/health` directly to confirm; wait 30-60s for Render cold start |
| Login fails with CORS error | `WEB_ORIGIN` missing or wrong | Set it to your exact Vercel URL (no trailing slash), redeploy API |
| Request submits but dashboard is empty | In-memory store lost on restart | Expected — use Render's Free plan sparingly, or add `MONGODB_URI` |
| Beds state resets every 15 min | Render free-tier idle restart | Add MongoDB Atlas free tier and set `MONGODB_URI` |
| API returns 401 on staff endpoints | Token expired or `JWT_SECRET` changed | Sign out, sign back in |

---

## Optional: MongoDB Atlas (persistent storage)

Render's free tier spins down after 15 minutes of inactivity. When it wakes up, the in-memory store is **empty**. For a persistent demo:

1. Go to https://cloud.mongodb.com/ — sign up
2. Create a free **M0 cluster**
3. Under **Database Access**, create a user
4. Under **Network Access**, add `0.0.0.0/0` (allow from anywhere) for demo
5. **Connect** → **Drivers** → copy the URI
6. In Render, set `MONGODB_URI` to that connection string
7. Redeploy

You now have persistent state. The storage adapter handles the switch transparently.

---

## Custom domain (optional)

Vercel → Project Settings → Domains → add your domain. Update `WEB_ORIGIN` on Render to match.

---

## Rolling back

- **Vercel:** Deployments tab → click a previous deployment → **Promote to Production**
- **Render:** Dashboard → Events → **Rollback** on any prior deploy

---

## Cost

| Service | Plan | Limits |
|---|---|---|
| Vercel | Hobby | Unlimited static sites, 100GB bandwidth/mo |
| Render | Free | 750 hours/mo, spins down after 15 min idle |
| MongoDB Atlas | M0 | 512MB, shared cluster |

Total: **₹0 / $0 / free**.

---

## If you're demo'ing in < 2 hours — don't deploy

Run locally. Your setup already works. The slides are ready. The tests pass.

Deployment is for after the demo — for sharing the URL with people who couldn't attend.
