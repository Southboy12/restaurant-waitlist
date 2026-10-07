# Deployment — Fly.io

This project deploys to **[Fly.io](https://fly.io)** (free tier: 3 shared-cpu VMs).

Live URL pattern: `https://<app-name>.fly.dev` (e.g. `https://restaurant-waitlist.fly.dev`)

---

## Prerequisites

1. **Fly.io account** — sign up at https://fly.io
2. **Fly CLI** installed and logged in:
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```
3. This repo cloned locally with `fly.toml` at the project root.

---

## Files Used for Fly.io Deployment

| File | Purpose |
|------|---------|
| `fly.toml` | Fly app config (app name, region, port 8000, `/api/health` check, VM size) |
| `Dockerfile` | Multi-stage build: Node builds the React frontend → Python image serves backend + static frontend via uvicorn. Respects `$PORT`, defaults to `8000`. |
| `backend/app/config.py` | Reads `DATABASE_URL` from env (set by `fly postgres attach`). Normalizes Fly's `postgres://` scheme to `postgresql://` for SQLAlchemy. Falls back to SQLite locally. |
| `backend/app/auth/auth.py` | Reads `JWT_SECRET` from env (set via `fly secrets set`). Uses a dev default — **always set a real secret in production**. |

---

## Deploy — First Time (step by step)

Run these from the project root (`/home/southboy/Documents/Restaurant_Waitlist`):

```bash
# 1. Log in
fly auth login

# 2. Create the app (uses fly.toml; --no-deploy so we add the DB first)
fly launch --config fly.toml --no-deploy

# 3. Create a Fly Postgres database (free within the 3-VM allowance)
fly postgres create --name waitlist-db

# 4. Attach it to the app — this automatically sets the DATABASE_URL secret
fly postgres attach --app restaurant-waitlist waitlist-db

# 5. Set the JWT signing secret (required — do NOT use the dev default)
fly secrets set JWT_SECRET="$(openssl rand -hex 32)"

# 6. Deploy
fly deploy

# 7. Verify
curl https://restaurant-waitlist.fly.dev/api/health
# Expected: {"status":"ok"}
```

Open `https://restaurant-waitlist.fly.dev` in a browser — the frontend is served by the same app.

---

## Deploy — Updates (after code changes)

```bash
fly deploy
```

That's it. Fly rebuilds the Docker image and rolls it out.

### Optional: CI/CD pipeline (`.github/workflows/fly-deploy.yml`)

Every push/PR runs this pipeline automatically:

| Job | What it does |
|-----|--------------|
| `backend-tests` + `frontend-tests` | **Run in parallel.** Backend runs `pytest` (unit suites only); frontend runs `npm ci`, `npm run build` (typecheck+build), then `npm test` (Vitest). |
| `compose-tests` | Builds the full `docker-compose.yaml` stack (`docker compose up -d --build`), waits for `/api/health`, then runs `test_integration.py` (API-level) and `test_e2e.py` (frontend serving + full user journeys) against it. Tears the stack down afterwards. |
| `deploy` | On pushes to `main`/`master` only (not PRs): `flyctl deploy --remote-only`. Needs the `FLY_API_TOKEN` secret (see below). |
| `verify-deploy` | Polls `https://restaurant-waitlist.fly.dev/api/health` until it returns `{"status":"ok"}` (up to ~5 min), then checks `/` serves the frontend shell (`<div id="root">`). Fails the run if the deploy isn't healthy. |

To enable deploys, add your Fly API token as a repo secret
(`fly auth token`, then GitHub **Settings → Secrets → Actions → New secret**
`FLY_API_TOKEN = <token>`). Unit + compose tests run on every PR without any
secrets.

To run the same checks locally:

```bash
# Backend unit tests (SQLite, no compose needed)
cd backend && uv run pytest tests/ -q --ignore=tests/test_integration.py --ignore=tests/test_e2e.py

# Frontend tests
cd frontend && npm ci && npm test

# Compose integration + e2e tests
docker-compose up -d --build
API_BASE_URL=http://localhost:8000 pytest backend/tests/test_integration.py backend/tests/test_e2e.py -v
docker-compose down -v
```

---

## Useful Commands

```bash
# View app status
fly status

# Stream logs
fly logs

# List secrets (values are hidden)
fly secrets list

# Set / rotate a secret (triggers a new deployment)
fly secrets set JWT_SECRET="$(openssl rand -hex 32)"

# Open a shell in the running machine
fly ssh console

# Check Postgres connection
fly postgres connect -a waitlist-db

# Scale (stays in free tier with 1 shared-cpu VM)
fly scale show
```

---

## Environment Variables (on Fly.io)

| Variable | How it's set | Description |
|----------|--------------|-------------|
| `DATABASE_URL` | Auto-set by `fly postgres attach` | Postgres connection string. `config.py` normalizes `postgres://` → `postgresql://`. |
| `JWT_SECRET` | `fly secrets set JWT_SECRET=...` | Secret key for signing JWT tokens. **Must be set** — never ship the dev default. |
| `TOKEN_EXPIRE_MIN` | Optional secret, defaults to `60` | JWT lifetime in minutes. |
| `PORT` | Set to `8000` in `fly.toml` `[env]` | Port uvicorn listens on. `Dockerfile` CMD uses `${PORT:-8000}`. |

Check what's set (names only):
```bash
fly secrets list
```

---

## Health Check

Fly checks `GET /api/health` every 30s (see `fly.toml`):

```bash
curl https://restaurant-waitlist.fly.dev/api/health
# {"status": "ok"}
```

---

## Local Development (unchanged)

```bash
# SQLite (default, no env needed)
docker-compose up -d --build
# or
cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

# Postgres locally (matches production)
export DATABASE_URL=postgresql://waitlist:waitlist123@localhost:5433/waitlist_db
cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

See `docker-compose.yaml` for the local Postgres + app setup.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|-------------------|
| App crashes on boot with `Could not parse SQLAlchemy URL` | `DATABASE_URL` uses `postgres://` scheme — `backend/app/config.py` normalizes this automatically. If you pinned an old image, redeploy with `fly deploy`. |
| `401 Invalid token` after deploy | `JWT_SECRET` changed (tokens signed with old secret are invalid) — log in again. |
| Health check failing / app never becomes healthy | Check `fly logs` — usually DB unreachable. Verify attachment: `fly secrets list` should show `DATABASE_URL`. Re-attach if missing. |
| Blank page at `/` but `/api/health` is ok | Frontend static files missing from image — ensure `fly deploy` builds from repo root so the frontend stage runs. Check `fly logs` for uvicorn startup errors. |
| Out of memory (OOM) | Bump VM memory in `fly.toml` (`memory_mb = 512` is already set) or `fly scale memory 512`. |


---

## Deployment — Cloudflare (Free Tier)

This project can also deploy to **Cloudflare** using three free-tier products:

1. **Cloudflare Pages** — static React frontend
2. **Cloudflare Containers** — FastAPI backend (Docker image)
3. **Cloudflare D1** — SQLite-compatible database (free tier)

See `_docs/cloudflare-deployment.md` for the full step-by-step guide.

### Quick reference

```bash
# 1. Install wrangler and log in
npm i -g wrangler
wrangler login

# 2. Create a D1 database
wrangler d1 create restaurant-waitlist-db
#   → save the database_id and connection_string

# 3. Set secrets (required for production)
wrangler secret put JWT_SECRET
wrangler secret put DATABASE_URL

# 4. Deploy the backend (Containers)
wrangler deploy --env production

# 5. Deploy the frontend (Pages)
cd frontend && npm ci && npm run build
wrangler pages deploy dist --project-name=restaurant-waitlist
```

### Environment variables (on Cloudflare)

| Variable | How it's set | Description |
|---|---|---|
| `DATABASE_URL` | `wrangler secret put DATABASE_URL` | D1 connection string. `config.py` normalizes `postgres://` → `postgresql://`. |
| `JWT_SECRET` | `wrangler secret put JWT_SECRET` | JWT signing secret. **Must be set** — never use the dev default. |
| `PORT` | Containers runtime | Port uvicorn listens on (8000). |

### GitHub Actions CI/CD

Set these secrets in your repository (Settings → Secrets and variables → Actions):

| Secret | Description |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | API token with Containers, D1, and Pages permissions |
| `JWT_SECRET` | Production JWT signing secret |

The workflow `.github/workflows/cloudflare-deploy.yml` runs on every push to `main`/`master`.

### Free tier limits

| Product | Free tier |
|---|---|
| Cloudflare Pages | Static sites, unlimited bandwidth, free custom domains |
| Cloudflare Containers | Shared CPU container, generous free allocation |
| Cloudflare D1 | ~100k reads, ~100k writes, ~100k transformations per day |
