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
├── backend/            # FastAPI app (app/, tests/, pyproject.toml)
├── frontend/           # React + Vite app (src/, public/)
├── Dockerfile          # Multi-stage build used by Fly.io (and docker-compose)
├── fly.toml            # Fly.io app config (port 8000, /api/health check)
├── docker-compose.yaml # Local Postgres + app (mirrors production)
├── DEPLOYMENT.md       # Fly.io deployment guide
├── _docs/
│   ├── plan.md      # Project scope and workflow
│   └── specs.md     # Technical specification
├── .gitignore
└── README.md
```

## Core Features

1. **Add Party** – Name, party size, phone number
2. **Notify** – One-click SMS via pre-set template
3. **Timer** – Auto-removal on timeout (no-show)
4. **Seat** – Manual seat marking
5. **History** – Full log of all past parties

## Running Locally

```bash
# SQLite (zero setup)
cd backend && uv sync && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

# Postgres (mirrors production)
docker-compose up -d --build
```

The backend serves the frontend at http://localhost:8000 and the API under `/api/*`.
Health check: `curl http://localhost:8000/api/health` → `{"status":"ok"}`.

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
