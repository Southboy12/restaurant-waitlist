# Restaurant Waitlist API

FastAPI backend for the Olive & Ember waitlist manager.

## Setup

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt   # or use pyproject.toml extras
.venv/bin/uvicorn app.main:app --reload --port 8000
```

## Run

```bash
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API is mounted at `/api/*`. The frontend should proxy `/api` to this backend.

## Authentication

All `/api/parties/*` endpoints require a Bearer token obtained from:

```http
POST /api/auth/login
Content-Type: application/json

{"username": "host", "password": "host123"}
```

Default users:

| username | password   |
|----------|------------|
| host     | host123    |
| manager  | manager123 |

Response:

```json
{"access_token": "<jwt>", "token_type": "bearer"}
```

Use the token in subsequent requests:

```
Authorization: Bearer <jwt>
```

## Seed data

On startup the store is populated with the same sample data the frontend's mock uses
(Adeyemi, Whitfield, Okonkwo active; Bassey, Larkin, Ifeanyi in history).

## Environment

| Variable       | Default                | Description                                      |
|----------------|------------------------|--------------------------------------------------|
| JWT_SECRET     | dev-secret…           | Signing key for JWTs                            |
| TOKEN_EXPIRE_MIN | 60                  | Token lifetime in minutes                        |
| DATABASE_URL   | sqlite:///./waitlist.db | Database connection URL (supports SQLite, PostgreSQL, etc.) |

For production, set `DATABASE_URL` to your PostgreSQL connection string:
```
postgresql://user:password@localhost:5432/waitlist_db
```
