"""
End-to-end smoke tests against the docker-compose stack.

Unlike test_integration.py (API-level), these tests exercise the full
serving path the same way a browser would:

1. GET / returns the built frontend (index.html with <div id="root">).
2. GET /api/health returns {"status": "ok"}.
3. Full user journey through the API: login -> add party -> notify ->
   seat -> history, verifying the frontend bundle stays servable throughout.
4. Static assets referenced by index.html resolve with 200.

Run with: docker-compose up -d --build && pytest tests/test_e2e.py -v
Override the base URL with API_BASE_URL (default http://localhost:8000).
"""
from __future__ import annotations

import os
import re
import time

import pytest
import requests

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
API_URL = f"{BASE_URL}/api"


def _wait_for_stack(timeout: int = 60) -> None:
    """Wait until both the frontend and the API are servable."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            front = requests.get(f"{BASE_URL}/", timeout=2)
            api = requests.get(f"{API_URL}/health", timeout=2)
            if front.status_code == 200 and api.status_code == 200:
                return
        except requests.ConnectionError:
            pass
        time.sleep(2)
    raise RuntimeError(f"Compose stack at {BASE_URL} did not become ready within {timeout}s")


@pytest.fixture(scope="session", autouse=True)
def wait_for_stack():
    _wait_for_stack()


@pytest.fixture
def auth_headers() -> dict[str, str]:
    resp = requests.post(
        f"{API_URL}/auth/login",
        json={"username": "host", "password": "host123"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


class TestFrontendServing:
    def test_root_serves_spa_shell(self) -> None:
        resp = requests.get(f"{BASE_URL}/")
        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("Content-Type", "")
        assert '<div id="root">' in resp.text

    def test_spa_fallback_for_client_routes(self) -> None:
        # Client-side routes must fall back to index.html, not 404.
        resp = requests.get(f"{BASE_URL}/history")
        assert resp.status_code == 200
        assert '<div id="root">' in resp.text

    def test_bundled_assets_resolve(self) -> None:
        html = requests.get(f"{BASE_URL}/").text
        assets = re.findall(r'src="(/assets/[^"]+)"|href="(/assets/[^"]+)"', html)
        flat = [a or b for a, b in assets]
        assert flat, "index.html references no /assets/* bundles"
        for asset in set(flat):
            r = requests.get(f"{BASE_URL}{asset}")
            assert r.status_code == 200, f"Asset {asset} returned {r.status_code}"

    def test_api_health(self) -> None:
        resp = requests.get(f"{API_URL}/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestEndToEndJourney:
    """Full staff journey: login -> add -> notify -> seat -> history."""

    def test_full_seat_journey(self, auth_headers: dict) -> None:
        # 1. Add a party
        add = requests.post(
            f"{API_URL}/parties",
            headers=auth_headers,
            json={"name": "E2E Seat", "size": "4", "phone": "+1 555 0100"},
        )
        assert add.status_code == 201
        party_id = add.json()["id"]

        # 2. Visible in active list
        active = requests.get(f"{API_URL}/parties/active", headers=auth_headers)
        assert any(p["id"] == party_id for p in active.json())

        # 3. Notify
        notify = requests.post(f"{API_URL}/parties/{party_id}/notify", headers=auth_headers)
        assert notify.status_code == 200
        assert notify.json()["party"]["notifiedAt"] is not None

        # 4. Seat
        seat = requests.post(f"{API_URL}/parties/{party_id}/seat", headers=auth_headers)
        assert seat.status_code == 200
        assert seat.json()["resolution"] == "seated"

        # 5. Lands in history
        history = requests.get(f"{API_URL}/parties/history", headers=auth_headers)
        match = [h for h in history.json() if h["id"] == party_id]
        assert len(match) == 1 and match[0]["resolution"] == "seated"

        # 6. Frontend still servable after the journey
        front = requests.get(f"{BASE_URL}/")
        assert front.status_code == 200 and '<div id="root">' in front.text

    def test_full_noshow_journey(self, auth_headers: dict) -> None:
        add = requests.post(
            f"{API_URL}/parties",
            headers=auth_headers,
            json={"name": "E2E NoShow", "size": "2", "phone": "+1 555 0101"},
        )
        assert add.status_code == 201
        party_id = add.json()["id"]

        remove = requests.delete(f"{API_URL}/parties/{party_id}", headers=auth_headers)
        assert remove.status_code == 204

        history = requests.get(f"{API_URL}/parties/history", headers=auth_headers)
        match = [h for h in history.json() if h["id"] == party_id]
        assert len(match) == 1 and match[0]["resolution"] == "no-show"
