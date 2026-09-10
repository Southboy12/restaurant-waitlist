from __future__ import annotations

import os


# Database configuration - database-agnostic via DATABASE_URL env var
# Default to SQLite for local development
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./waitlist.db")

# For SQLite, enable foreign keys (SQLAlchemy handles this via event listeners if needed)
# For other databases like PostgreSQL, use: postgresql://user:pass@localhost/dbname
