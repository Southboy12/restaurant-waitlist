# Restaurant Waitlist Manager

A staff-only web application for managing a restaurant waitlist. Staff can add parties, send automated SMS notifications when tables are ready, track wait times with automatic timeout removal, and maintain a full history of all parties.

## Tech Stack

- **Backend:** FastAPI + SQLAlchemy (SQLite locally, PostgreSQL in production)
- **Frontend:** React + Vite + TypeScript (served as static files by the backend)
- **Deploy:** Fly.io (Docker, Fly Postgres)

See `_docs/specs.md` for the detailed specification and `DEPLOYMENT.md` for the Fly.io deployment guide.

## Project Structure

```
.
├── backend/            # FastAPI app (app/, tests/, pyproject.toml, Makefile)
├── frontend/           # React + Vite app (src/, public/)
├── Dockerfile          # Multi-stage build used by Fly.io (and docker-compose)
├── fly.toml            # Fly.io app config (port 8000, /api/health check)
├── docker-compose.yaml # Local Postgres + app (mirrors production)
├── DEPLOYMENT.md       # Fly.io deployment guide
├── _docs/
│   ├── plan.md      # Project scope and workflow
│   └── specs.md     # Technical specification
├── .github/
│   └── workflows/
│       └── fly-deploy.yml  # CI/CD: unit → compose → Fly.io deploy → verify
├── .gitignore
└── README.md
```

## Core Features

1. **Add Party** – Name, party size, phone number
2. **Notify** – One-click SMS via pre-set template
3. **Timer** – Auto-removal on timeout (no-show)
4. **Seat** – Manual seat marking
5. **History** – Full log of all past parties

## Prerequisites

| Tool | Version | Check | Install |
|------|---------|-------|---------|
| Python | ≥ 3.12 | `python3 --version` | https://python.org |
| [uv](https://docs.astral.sh/uv/) | any recent | `uv --version` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node.js | ≥ 20 | `node --version` | https://nodejs.org |
| npm | ≥ 10 (ships with Node) | `npm --version` | ships with Node |
| Docker + Compose | any recent | `docker --version && docker-compose version` | https://docs.docker.com/get-docker/ |

> Backend dependency management uses **uv** (per `AGENTS.md`). Never `pip install` directly — always `uv sync` / `uv add`.

## Running Locally

Pick **one** of the options below, ordered from simplest to most production-like.

### Option A — Full stack with Docker Compose (recommended, mirrors production)

Builds the frontend, starts Postgres 16 + the app, and serves everything on one port.

```bash
# From the repo root:
docker-compose up -d --build

# Wait until healthy (takes ~1 min on first build):
for i in $(seq 1 30); do
  curl -fsS http://localhost:8000/api/health && break
  sleep 5
done

# Open the app:
#   Frontend → http://localhost:8000
#   Health   → http://localhost:8000/api/health   (expect {"status":"ok"})

# Login credentials:
#   host / host123          (staff role)
#   manager / manager123    (manager role)

# View logs / stop:
docker-compose logs -f app
docker-compose down        # keep DB data
docker-compose down -v     # also wipe DB data (fresh start)
```

What this runs (see `docker-compose.yaml`):

| Service | Container | Host port | Notes |
|---------|-----------|-----------|-------|
| `db` | `waitlist-db` | `5433` → `5432` | Postgres 16, data in `waitlist-pgdata` volume |
| `app` | `restaurant-waitlist-app` | `8000` | `DATABASE_URL=postgresql://waitlist:waitlist123@db:5432/waitlist_db` |

> **Why port 5433?** The host side uses 5433 (not the usual 5432) so it doesn't clash with a system Postgres. Inside the compose network the app still talks to `db:5432`.

### Option B — Backend only with SQLite (fastest, zero setup)

Runs just the API with an on-disk SQLite file. No Docker, no Postgres.

```bash
cd backend
uv sync                 # install deps (creates .venv/ on first run)
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Then open http://localhost:8000/api/health → `{"status":"ok"}`.

> Note: without the built frontend, `/` returns 404 in this mode — only `/api/*` works. Use Option A for the UI, or Option C for frontend dev.

### Option C — Split dev: backend (SQLite) + Vite frontend with hot reload

Best when working on UI code. Two terminals:

```bash
# Terminal 1 — backend API on :8000
cd backend
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2 — frontend dev server on :5173 (proxies /api → :8000)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. API calls to `/api/*` are proxied to the backend (see `frontend/vite.config.ts`).

### Option D — Backend with local Postgres (backend-only, production-like DB)

Same as Option B but against Postgres instead of SQLite:

```bash
# Start only the DB from compose:
docker-compose up -d db

# Point the backend at it and run:
export DATABASE_URL=postgresql://waitlist:waitlist123@localhost:5433/waitlist_db
cd backend
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Verifying It Works

```bash
# 1. Health check
curl http://localhost:8000/api/health
# {"status":"ok"}

# 2. Login (returns a JWT)
curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"host","password":"host123"}'

# 3. Full round-trip: add → list → seat (TOKEN from step 2)
TOKEN=<access_token from step 2>
curl -s -X POST http://localhost:8000/api/parties \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Test Party","size":"2","phone":"+1 555 0100"}'
curl -s http://localhost:8000/api/parties/active -H "Authorization: Bearer $TOKEN"
```

Or in a browser (Options A or C): open the frontend, add a party named e.g. "Test Party", click **Notify**, then **Seat**, and check it appears under the **History** tab.

## Running Tests

```bash
# Backend unit tests (SQLite in-memory, no Docker needed)
cd backend
uv run pytest tests/ -q --ignore=tests/test_integration.py --ignore=tests/test_e2e.py

# Frontend tests
cd frontend
npm install
npm test                # one-shot (vitest run)
npm run test:watch      # watch mode
```

```bash
# Integration + end-to-end tests (require the compose stack from Option A)
docker-compose up -d --build
API_BASE_URL=http://localhost:8000 python3 -m pytest backend/tests/test_integration.py backend/tests/test_e2e.py -v
docker-compose down -v
```

```bash
# Lint
cd backend && uv run ruff check app/ tests/
cd frontend && npm run build   # typecheck (tsc) + production build
```

Test layout:

| Suite | Location | Needs | Covers |
|-------|----------|-------|--------|
| Backend unit | `backend/tests/test_auth.py`, `test_parties.py` | nothing (SQLite `:memory:`) | auth, party CRUD, validation |
| Frontend unit | `frontend/src/**/*.test.ts(x)` | `npm install` | helpers (`waitlist.ts`), API client (mocked `fetch`) |
| Integration | `backend/tests/test_integration.py` | compose stack | all `/api/*` endpoints over HTTP + Postgres |
| E2E | `backend/tests/test_e2e.py` | compose stack | SPA serving, static assets, full seat/no-show journeys |

> Note: `make test` in `backend/` runs the FULL suite including compose suites — only use it with the stack up. Use the `--ignore=` flags above (or `make test-quiet` won't help) for unit-only runs.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `docker-compose: command not found` | Install Compose, or use `docker compose` (v2 plugin) |
| Port `8000` already in use | Stop the other server (`docker-compose down`, or kill stray `uvicorn`) |
| Port `5433` already in use | Another Postgres is bound there; `docker ps`, stop it, or change `ports:` in `docker-compose.yaml` |
| Health check refused after `up` | First build takes a while; wait, retry, check `docker-compose logs app` |
| Login returns `401` | Wrong password, or `JWT_SECRET` changed; log in again with `host` / `host123` |
| `/` blank/404 on backend-only run | Expected; Option B serves API only. Use Option A or C for the UI |
| Stale DB state (old parties) | `docker-compose down -v` wipes the DB volume; for SQLite delete `backend/waitlist.db` |
| `uv: command not found` | Install uv (see Prerequisites), then re-open the shell |
| `npm install` fails | Ensure Node 20+; delete `frontend/node_modules` and retry |



## Deployment

Deploys to **Fly.io** — see [DEPLOYMENT.md](./DEPLOYMENT.md):

```bash
fly auth login
fly launch --config fly.toml --no-deploy
fly postgres create --name waitlist-db
fly postgres attach --app restaurant-waitlist waitlist-db
fly secrets set JWT_SECRET="$(openssl rand -hex 32)"
fly deploy
```

## License

Private repository.

### Cloudflare (Free Tier)

Cloudflare was chosen as an alternative deployment platform. The same codebase
deploys to **Cloudflare Pages** (frontend), **Cloudflare Containers** (backend),
and **Cloudflare D1** (database) — all on the free tier.

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [`_docs/cloudflare-deployment.md`](./_docs/cloudflare-deployment.md)
for the full Cloudflare deployment guide.

```bash
# 1. Install wrangler and log in
npm i -g wrangler
wrangler login

# 2. Create a D1 database
wrangler d1 create restaurant-waitlist-db

# 3. Set secrets
wrangler secret put JWT_SECRET
wrangler secret put DATABASE_URL

# 4. Deploy the backend (Containers)
wrangler deploy --env production

# 5. Deploy the frontend (Pages)
cd frontend && npm ci && npm run build
wrangler pages deploy dist --project-name=restaurant-waitlist
```

## License

Private repository.
