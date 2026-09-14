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

### Optional: auto-deploy on push to `master`

A GitHub Actions workflow exists at `.github/workflows/fly-deploy.yml`.
To enable it, add your Fly API token as a repo secret:

```bash
fly auth token
```

Then in GitHub: **Settings → Secrets → Actions → New secret**
`FLY_API_TOKEN = <token from above>`. Every push to `master`/`main`
will then run `flyctl deploy --remote-only` automatically.

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

