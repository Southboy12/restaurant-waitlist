from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os

from app.routers import auth_router, parties_router
from app.store import get_store
from app.auth import _seed_users
from app.db.seed import init_db

app = FastAPI(
    title="Restaurant Waitlist API",
    version="1.0.0",
    description="Backend API for the Olive & Ember waitlist manager frontend.",
)

# Allow CORS for the frontend (during development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


# Serve frontend static files and handle SPA routing
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
index_path = os.path.join(static_dir, "index.html")


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """Serve the frontend static files and handle SPA routing."""
    # Check if the requested path is a static file
    file_path = os.path.join(static_dir, full_path)

    # If the file exists and is within the static directory, serve it
    if os.path.isfile(file_path) and file_path.startswith(os.path.abspath(static_dir)):
        return FileResponse(file_path)

    # Otherwise, serve index.html for client-side routing
    if os.path.exists(index_path):
        return FileResponse(index_path)

    return JSONResponse(status_code=404, content={"error": "Not found"})

