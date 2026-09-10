from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.routers import auth_router, parties_router
from app.store import get_store
from app.auth import _seed_users
from app.db.seed import init_db

app = FastAPI(
    title="Restaurant Waitlist API",
    version="1.0.0",
    description="Backend API for the Olive & Ember waitlist manager frontend.",
)

# Mount routers under /api prefix to match the OpenAPI server URL.
app.include_router(auth_router, prefix="/api")
app.include_router(parties_router, prefix="/api")


@app.on_event("startup")
async def on_startup() -> None:
    """Initialize the database and seed data on startup."""
    # Initialize database tables
    init_db()
    # Seed the in-memory user store (for auth)
    _seed_users()
    # Seed the database with sample party data
    store = get_store()
    store.seed()


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.exception_handler(Exception)
async def generic_exception_handler(_request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc)})
