from __future__ import annotations

import os
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.store import reset_store
from app.auth import _seed_users
from app.auth.auth import _users as _users_global
from app.db.database import Base, engine, SessionLocal
from app.db.seed import init_db, seed_data

# Use SQLite in-memory database for tests
os.environ["DATABASE_URL"] = "sqlite:///:memory:"


@pytest.fixture(autouse=True)
def reset_state() -> None:
    """Reset the database and in-memory user table before each test."""
    # Create fresh tables for each test
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    # Seed the database
    seed_data()
    
    # Reset in-memory store and user table
    reset_store()
    _users_global.clear()
    _seed_users()


@pytest.fixture
def client() -> TestClient:
    """Provide a TestClient with freshly seeded data."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def host_token(client: TestClient) -> str:
    """Login as host and return a bearer token."""
    resp = client.post("/api/auth/login", json={"username": "host", "password": "host123"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture
def manager_token(client: TestClient) -> str:
    """Login as manager and return a bearer token."""
    resp = client.post("/api/auth/login", json={"username": "manager", "password": "manager123"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture
def headers(host_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {host_token}"}
