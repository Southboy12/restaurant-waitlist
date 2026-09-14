from __future__ import annotations

import os


# Database configuration - database-agnostic via DATABASE_URL env var.
# Default to SQLite for local development.
# On Fly.io the value is provided automatically via `fly postgres attach`
# (or set manually with `fly secrets set DATABASE_URL=...`).
DATABASE_URL_RAW = os.environ.get("DATABASE_URL", "sqlite:///./waitlist.db")


def _normalize_database_url(url: str) -> str:
    """Normalize DATABASE_URL for SQLAlchemy.

    Fly.io Postgres `attach` provides a `postgres://...` URL, while
    SQLAlchemy expects `postgresql://...`. Also strips stray quotes.
    """
    url = url.strip().strip('"').strip("'")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    elif url.startswith("postgres+psycopg2://"):
        url = url.replace("postgres+psycopg2://", "postgresql+psycopg2://", 1)
    return url


DATABASE_URL = _normalize_database_url(DATABASE_URL_RAW)

# For SQLite, enable foreign keys (SQLAlchemy handles this via event listeners if needed)
# For other databases like PostgreSQL, use: postgresql://user:pass@localhost/dbname
