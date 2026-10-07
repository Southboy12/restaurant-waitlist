# Cloudflare Deployment — Free Tier Setup

This project deploys to **Cloudflare** using three products:

1. **Cloudflare Pages** — static React frontend
2. **Cloudflare Containers** — FastAPI backend (Docker image)
3. **Cloudflare D1** — SQLite-compatible database (free tier)

All three are on the free tier and require no credit card for the base tiers.

---

## Prerequisites

1. **Cloudflare account** — sign up at https://cloudflare.com
2. **Wrangler CLI** (Cloudflare's CLI tool):
   ```bash
   npm install -g wrangler
   wrangler --version
   ```
3. **GitHub repository** with the project cloned locally.

---

## Step 1 — Create the D1 database

```bash
# Log in to Cloudflare
wrangler login

# Create a D1 database
wrangler d1 create restaurant-waitlist-db
```

You'll see output like:

```
Created D1 database restaurant-waitlist-db
- account_id: abc123...
- database_name: restaurant-waitlist-db
- database_id: def456...
- connection_string: postgresql://cloudflare:...@ep-...-123456.us-east-2.aws.neon.tech:5432/restaurant-waitlist-db?sslmode=require
```

**Save the `database_id` and `connection_string`.**

---

## Step 2 — Set secrets (required for the backend)

You need two secrets. The `JWT_SECRET` is **required** — never use the dev default in production.

```bash
# Set the JWT secret (generate a strong one)
JWT_SECRET=$(openssl rand -hex 32)
wrangler secret put JWT_SECRET
# Paste the value when prompted

# Set the D1 connection string
wrangler secret put DATABASE_URL
# Paste the connection_string from step 1 when prompted
```

> **Note:** `DATABASE_URL` uses `postgres://` scheme; `backend/app/config.py` automatically
> normalizes it to `postgresql://` for SQLAlchemy.

---

## Step 3 — Update `wrangler.toml`

Open `wrangler.toml` and replace `PLACEHOLDER_D1_DATABASE_ID` with the `database_id` from Step 1:

```toml
[[d1_databases]]
binding = "DB"
database_name = "restaurant-waitlist-db"
database_id = "def456..."
```

---

## Step 4 — Deploy to Cloudflare

```bash
# Deploy the backend (Containers)
wrangler deploy --env production

# Deploy the frontend (Pages)
cd frontend && npm ci && npm run build
wrangler pages deploy dist --project-name=restaurant-waitlist
```

Your backend will be live at something like:

```
https://restaurant-waitlist.your-region.containers.app
```

Your frontend will be live at:

```
https://restaurant-waitlist.pages.dev
```

---

## Step 5 — Verify

```bash
# Health check
curl https://restaurant-waitlist.your-region.containers.app/api/health
# Expected: {"status":"ok"}

# Login
curl -X POST https://restaurant-waitlist.your-region.containers.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"host","password":"host123"}'

# Add a party (replace TOKEN with the JWT from login)
curl -X POST https://restaurant-waitlist.your-region.containers.app/api/parties \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Party","size":2,"phone":"+1 555 0100"}'

# View active parties
curl https://restaurant-waitlist.your-region.containers.app/api/parties/active \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Step 6 — Set up GitHub Actions CI/CD

Add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions):

| Secret | Description |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID (from `wrangler config` or dashboard) |
| `CLOUDFLARE_API_TOKEN` | API token with Containers, D1, and Pages permissions |
| `JWT_SECRET` | Production JWT signing secret (different from the local one) |

The workflow `.github/workflows/cloudflare-deploy.yml` will then run automatically on every push to `main`/`master`.

---

## Environment Variables

| Variable | Where it's set | Description |
|---|---|---|
| `DATABASE_URL` | `wrangler secret put DATABASE_URL` | D1 connection string. `config.py` normalizes `postgres://` → `postgresql://`. |
| `JWT_SECRET` | `wrangler secret put JWT_SECRET` | JWT signing secret. **Must be set** — never use the dev default. |
| `PORT` | Containers runtime | Port uvicorn listens on (8000). |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `wrangler: command not found` | Run `npm i -g wrangler` and ensure `~/.npm-global/bin` is on your `PATH` |
| `DATABASE_URL` fails to parse | Run `wrangler secret put DATABASE_URL` with the full connection string from `wrangler d1 create` |
| `401 Invalid token` after deploy | `JWT_SECRET` changed — log in again with the new secret |
| Blank page at `/` but `/api/health` is ok | Frontend static files missing from image — ensure `wrangler deploy` builds the frontend |
| D1 connection refused | Wait a few seconds after `wrangler d1 create` before connecting |

---

## Free tier limits

| Product | Free tier |
|---|---|
| Cloudflare Pages | Static sites, unlimited bandwidth, free custom domains |
| Cloudflare Containers | Shared CPU container, generous free allocation (may require upgrade for high traffic) |
| Cloudflare D1 | Free tier: ~100k reads, ~100k writes, ~100k transformations per day |

The free tiers are generous for a small staff app. Monitor usage in the Cloudflare dashboard and upgrade if needed.

---

## Setting Secrets

### JWT_SECRET (Workers entry point)

The `JWT_SECRET` is used by the Cloudflare Worker entry point (`worker/index.ts`) that routes requests. Set it via:

```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
npx wrangler secret put JWT_SECRET --name restaurant-waitlist
```

> **Note:** `wrangler secret put` is for Workers secrets. For Cloudflare Containers,
> the Worker entry point needs this secret to sign JWT tokens. If you prefer, you can
> also set it directly in `wrangler.toml` under `[vars]`. Remember to **never commit
> real secrets to source control**.

### DATABASE_URL (Container)

The `DATABASE_URL` is the D1 connection string, which is set via the **D1 API**
(see the `deploy` job in `cloudflare-deploy.yml`):

```bash
DATABASE_URL=$(wrangler d1 create restaurant-waitlist-db --account-id $CLOUDFLARE_ACCOUNT_ID)
# Then use the connection string in your application config
```

The `backend/app/config.py` automatically normalizes `postgres://` → `postgresql://`.

---

## Deployment Flow (GitHub Actions)

1. **Tests** — Backend + frontend unit tests run in parallel
2. **Compose tests** — Integration + e2e tests against the full stack
3. **Deploy to Cloudflare** (on `main`/`master` only):
   - Create the D1 database (if not exists)
   - Get the D1 connection string and ID
   - Update `wrangler.toml` with the D1 database ID
   - Build the Docker image: `wrangler containers build . -t restaurant-waitlist:latest`
   - Push to Cloudflare Registry: `wrangler containers push restaurant-waitlist:latest`
   - Deploy: `wrangler deploy`
   - Deploy frontend: `wrangler pages deploy dist --project-name=restaurant-waitlist`
4. **Verify** — Poll `/api/health` until `{"status":"ok"}`

---

## Manual Deployment

```bash
# 1. Install wrangler and log in
npm i -g wrangler
wrangler login

# 2. Create D1 database
wrangler d1 create restaurant-waitlist-db
# Save the database_id and connection_string

# 3. Set secrets
wrangler secret put JWT_SECRET --name restaurant-waitlist

# 4. Update wrangler.toml with the D1 database ID
sed -i 's/database_id = "PLACEHOLDER_D1_DATABASE_ID"/database_id = "YOUR_DATABASE_ID"/' wrangler.toml

# 5. Build and push the Docker image
npx wrangler containers build . -t restaurant-waitlist:latest
npx wrangler containers push restaurant-waitlist:latest

# 6. Deploy
npx wrangler deploy
```

---

## Environment Variables

| Variable | Where it's set | Description |
|---|---|---|
| `DATABASE_URL` | D1 API (set via `wrangler d1 create`) | D1 connection string. `config.py` normalizes `postgres://` → `postgresql://`. |
| `JWT_SECRET` | Worker secret or `[vars]` in `wrangler.toml` | JWT signing secret. **Must be set** — never use the dev default. |
| `PORT` | Containers runtime | Port uvicorn listens on (8000). |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `wrangler secret put: Required Worker name missing` | Use `--name restaurant-waitlist` flag |
| `Invalid format for Authorization header` | Ensure `CLOUDFLARE_API_TOKEN` is set correctly |
| `DATABASE_URL` fails to parse | Run `wrangler secret put DATABASE_URL` with the full connection string |
| `401 Invalid token` after deploy | `JWT_SECRET` changed — log in again with the new secret |
| Docker build fails with `unknown flag: --load` | Update Docker CLI or use a different build method |

---

## Free tier limits

| Product | Free tier |
|---|---|
| Cloudflare Pages | Static sites, unlimited bandwidth, free custom domains |
| Cloudflare Containers | Shared CPU container, generous free allocation |
| Cloudflare D1 | ~100k reads, ~100k writes, ~100k transformations per day |

The free tiers are generous for a small staff app. Monitor usage in the Cloudflare dashboard and upgrade if needed.
