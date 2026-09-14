"""
Integration tests that run against the docker-compose setup.

These tests assume docker-compose is running with the app on port 8000
and PostgreSQL on port 5433.

Run with: docker-compose up -d && pytest tests/test_integration.py -v
"""
from __future__ import annotations

import os
import time

import pytest
import requests

# Base URL for the API
BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
API_URL = f"{BASE_URL}/api"


def _wait_for_api(timeout: int = 30) -> None:
    """Wait for the API to become available."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = requests.get(f"{API_URL}/health", timeout=2)
            if resp.status_code == 200:
                return
        except requests.ConnectionError:
            pass
        time.sleep(1)
    raise RuntimeError(f"API at {BASE_URL} did not become available within {timeout}s")


@pytest.fixture(scope="session", autouse=True)
def wait_for_services():
    """Ensure the API is running before executing tests."""
    _wait_for_api()


@pytest.fixture
def host_headers() -> dict[str, str]:
    """Login as host and return auth headers."""
    resp = requests.post(
        f"{API_URL}/auth/login",
        json={"username": "host", "password": "host123"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def manager_headers() -> dict[str, str]:
    """Login as manager and return auth headers."""
    resp = requests.post(
        f"{API_URL}/auth/login",
        json={"username": "manager", "password": "manager123"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------


class TestHealthCheck:
    def test_health_endpoint(self) -> None:
        resp = requests.get(f"{API_URL}/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


class TestAuthentication:
    def test_login_host_success(self) -> None:
        resp = requests.post(
            f"{API_URL}/auth/login",
            json={"username": "host", "password": "host123"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 10

    def test_login_manager_success(self) -> None:
        resp = requests.post(
            f"{API_URL}/auth/login",
            json={"username": "manager", "password": "manager123"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 10

    def test_login_wrong_password(self) -> None:
        resp = requests.post(
            f"{API_URL}/auth/login",
            json={"username": "host", "password": "wrongpassword"},
        )
        assert resp.status_code == 401

    def test_login_nonexistent_user(self) -> None:
        resp = requests.post(
            f"{API_URL}/auth/login",
            json={"username": "ghost", "password": "password"},
        )
        assert resp.status_code == 401

    def test_login_missing_password(self) -> None:
        resp = requests.post(
            f"{API_URL}/auth/login",
            json={"username": "host"},
        )
        assert resp.status_code == 422  # Validation error


# ---------------------------------------------------------------------------
# Auth Guard - Protected Endpoints
# ---------------------------------------------------------------------------


class TestAuthGuard:
    def test_active_parties_requires_auth(self) -> None:
        resp = requests.get(f"{API_URL}/parties/active")
        assert resp.status_code == 401

    def test_history_requires_auth(self) -> None:
        resp = requests.get(f"{API_URL}/parties/history")
        assert resp.status_code == 401

    def test_add_party_requires_auth(self) -> None:
        resp = requests.post(
            f"{API_URL}/parties",
            json={"name": "Test", "size": "2", "phone": "+1 555 0000"},
        )
        assert resp.status_code == 401

    def test_invalid_token_rejected(self) -> None:
        resp = requests.get(
            f"{API_URL}/parties/active",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Get Active Parties
# ---------------------------------------------------------------------------


class TestGetActiveParties:
    def test_get_active_parties(self, host_headers: dict) -> None:
        resp = requests.get(f"{API_URL}/parties/active", headers=host_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_active_parties_have_required_fields(self, host_headers: dict) -> None:
        resp = requests.get(f"{API_URL}/parties/active", headers=host_headers)
        assert resp.status_code == 200
        parties = resp.json()
        for party in parties:
            assert "id" in party
            assert "name" in party
            assert "size" in party
            assert "phone" in party
            assert "addedAt" in party


# ---------------------------------------------------------------------------
# Get History
# ---------------------------------------------------------------------------


class TestGetHistory:
    def test_get_history(self, host_headers: dict) -> None:
        resp = requests.get(f"{API_URL}/parties/history", headers=host_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_history_entries_have_resolution(self, host_headers: dict) -> None:
        resp = requests.get(f"{API_URL}/parties/history", headers=host_headers)
        assert resp.status_code == 200
        history = resp.json()
        for entry in history:
            assert "resolution" in entry
            assert entry["resolution"] in ("seated", "no-show")


# ---------------------------------------------------------------------------
# Add Party
# ---------------------------------------------------------------------------


class TestAddParty:
    def test_add_party_success(self, host_headers: dict) -> None:
        resp = requests.post(
            f"{API_URL}/parties",
            headers=host_headers,
            json={"name": "Integration Test Guest", "size": "4", "phone": "+1 555 1234"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Integration Test Guest"
        assert data["size"] in ("4", 4)  # Can be string or int depending on serialization
        assert data["phone"] == "+1 555 1234"
        assert "id" in data
        assert "addedAt" in data

    def test_add_party_missing_name(self, host_headers: dict) -> None:
        resp = requests.post(
            f"{API_URL}/parties",
            headers=host_headers,
            json={"size": "2", "phone": "+1 555 0000"},
        )
        assert resp.status_code == 422

    def test_add_party_missing_size(self, host_headers: dict) -> None:
        resp = requests.post(
            f"{API_URL}/parties",
            headers=host_headers,
            json={"name": "Test", "phone": "+1 555 0000"},
        )
        assert resp.status_code == 422

    def test_add_party_missing_phone(self, host_headers: dict) -> None:
        resp = requests.post(
            f"{API_URL}/parties",
            headers=host_headers,
            json={"name": "Test", "size": "2"},
        )
        assert resp.status_code == 422

    def test_add_party_appears_in_active(self, host_headers: dict) -> None:
        # Add a party
        add_resp = requests.post(
            f"{API_URL}/parties",
            headers=host_headers,
            json={"name": "Active Test", "size": "3", "phone": "+1 555 9999"},
        )
        assert add_resp.status_code == 201
        party_id = add_resp.json()["id"]

        # Verify it appears in active list
        active_resp = requests.get(f"{API_URL}/parties/active", headers=host_headers)
        assert active_resp.status_code == 200
        active_ids = [p["id"] for p in active_resp.json()]
        assert party_id in active_ids


# ---------------------------------------------------------------------------
# Notify Party
# ---------------------------------------------------------------------------


class TestNotifyParty:
    def test_notify_party_success(self, host_headers: dict) -> None:
        # Add a party first
        add_resp = requests.post(
            f"{API_URL}/parties",
            headers=host_headers,
            json={"name": "Notify Test", "size": "2", "phone": "+1 555 1111"},
        )
        assert add_resp.status_code == 201
        party_id = add_resp.json()["id"]

        # Notify the party
        notify_resp = requests.post(
            f"{API_URL}/parties/{party_id}/notify",
            headers=host_headers,
        )
        assert notify_resp.status_code == 200
        data = notify_resp.json()
        assert data["party"]["id"] == party_id
        assert data["party"]["notifiedAt"] is not None
        assert "message" in data

    def test_notify_nonexistent_party(self, host_headers: dict) -> None:
        resp = requests.post(
            f"{API_URL}/parties/nonexistent-id/notify",
            headers=host_headers,
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Seat Party
# ---------------------------------------------------------------------------


class TestSeatParty:
    def test_seat_party_success(self, host_headers: dict) -> None:
        # Add a party first
        add_resp = requests.post(
            f"{API_URL}/parties",
            headers=host_headers,
            json={"name": "Seat Test", "size": "2", "phone": "+1 555 2222"},
        )
        assert add_resp.status_code == 201
        party_id = add_resp.json()["id"]

        # Seat the party
        seat_resp = requests.post(
            f"{API_URL}/parties/{party_id}/seat",
            headers=host_headers,
        )
        assert seat_resp.status_code == 200
        data = seat_resp.json()
        assert data["id"] == party_id
        assert data["resolution"] == "seated"
        assert data["resolvedAt"] is not None

    def test_seated_party_not_in_active(self, host_headers: dict) -> None:
        # Add a party
        add_resp = requests.post(
            f"{API_URL}/parties",
            headers=host_headers,
            json={"name": "Seat Active Test", "size": "2", "phone": "+1 555 3333"},
        )
        assert add_resp.status_code == 201
        party_id = add_resp.json()["id"]

        # Seat the party
        requests.post(f"{API_URL}/parties/{party_id}/seat", headers=host_headers)

        # Verify not in active
        active_resp = requests.get(f"{API_URL}/parties/active", headers=host_headers)
        active_ids = [p["id"] for p in active_resp.json()]
        assert party_id not in active_ids

    def test_seated_party_in_history(self, host_headers: dict) -> None:
        # Add a party
        add_resp = requests.post(
            f"{API_URL}/parties",
            headers=host_headers,
            json={"name": "Seat History Test", "size": "2", "phone": "+1 555 4444"},
        )
        assert add_resp.status_code == 201
        party_id = add_resp.json()["id"]

        # Seat the party
        requests.post(f"{API_URL}/parties/{party_id}/seat", headers=host_headers)

        # Verify in history
        hist_resp = requests.get(f"{API_URL}/parties/history", headers=host_headers)
        history = hist_resp.json()
        seated = [h for h in history if h["id"] == party_id]
        assert len(seated) == 1
        assert seated[0]["resolution"] == "seated"

    def test_seat_nonexistent_party(self, host_headers: dict) -> None:
        resp = requests.post(
            f"{API_URL}/parties/nonexistent-id/seat",
            headers=host_headers,
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Remove Party
# ---------------------------------------------------------------------------


class TestRemoveParty:
    def test_remove_party_success(self, host_headers: dict) -> None:
        # Add a party first
        add_resp = requests.post(
            f"{API_URL}/parties",
            headers=host_headers,
            json={"name": "Remove Test", "size": "2", "phone": "+1 555 5555"},
        )
        assert add_resp.status_code == 201
        party_id = add_resp.json()["id"]

        # Remove the party
        remove_resp = requests.delete(
            f"{API_URL}/parties/{party_id}",
            headers=host_headers,
        )
        assert remove_resp.status_code == 204

    def test_removed_party_not_in_active(self, host_headers: dict) -> None:
        # Add a party
        add_resp = requests.post(
            f"{API_URL}/parties",
            headers=host_headers,
            json={"name": "Remove Active Test", "size": "2", "phone": "+1 555 6666"},
        )
        assert add_resp.status_code == 201
        party_id = add_resp.json()["id"]

        # Remove the party
        requests.delete(f"{API_URL}/parties/{party_id}", headers=host_headers)

        # Verify not in active
        active_resp = requests.get(f"{API_URL}/parties/active", headers=host_headers)
        active_ids = [p["id"] for p in active_resp.json()]
        assert party_id not in active_ids

    def test_removed_party_in_history_as_no_show(self, host_headers: dict) -> None:
        # Add a party
        add_resp = requests.post(
            f"{API_URL}/parties",
            headers=host_headers,
            json={"name": "Remove History Test", "size": "2", "phone": "+1 555 7777"},
        )
        assert add_resp.status_code == 201
        party_id = add_resp.json()["id"]

        # Remove the party
        requests.delete(f"{API_URL}/parties/{party_id}", headers=host_headers)

        # Verify in history as no-show
        hist_resp = requests.get(f"{API_URL}/parties/history", headers=host_headers)
        history = hist_resp.json()
        removed = [h for h in history if h["id"] == party_id]
        assert len(removed) == 1
        assert removed[0]["resolution"] == "no-show"

    def test_remove_nonexistent_party(self, host_headers: dict) -> None:
        resp = requests.delete(
            f"{API_URL}/parties/nonexistent-id",
            headers=host_headers,
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Full Workflow
# ---------------------------------------------------------------------------


class TestFullWorkflow:
    def test_add_notify_seat_workflow(self, host_headers: dict) -> None:
        """Test the complete lifecycle: add -> notify -> seat."""
        # Add a party
        add_resp = requests.post(
            f"{API_URL}/parties",
            headers=host_headers,
            json={"name": "Workflow Test", "size": "4", "phone": "+1 555 8888"},
        )
        assert add_resp.status_code == 201
        party_id = add_resp.json()["id"]

        # Verify in active
        active_resp = requests.get(f"{API_URL}/parties/active", headers=host_headers)
        assert any(p["id"] == party_id for p in active_resp.json())

        # Notify
        notify_resp = requests.post(
            f"{API_URL}/parties/{party_id}/notify",
            headers=host_headers,
        )
        assert notify_resp.status_code == 200
        assert notify_resp.json()["party"]["notifiedAt"] is not None

        # Seat
        seat_resp = requests.post(
            f"{API_URL}/parties/{party_id}/seat",
            headers=host_headers,
        )
        assert seat_resp.status_code == 200
        assert seat_resp.json()["resolution"] == "seated"

        # Verify not in active
        active_resp = requests.get(f"{API_URL}/parties/active", headers=host_headers)
        assert not any(p["id"] == party_id for p in active_resp.json())

        # Verify in history
        hist_resp = requests.get(f"{API_URL}/parties/history", headers=host_headers)
        assert any(
            h["id"] == party_id and h["resolution"] == "seated"
            for h in hist_resp.json()
        )

    def test_add_remove_workflow(self, host_headers: dict) -> None:
        """Test add -> remove (no-show) workflow."""
        # Add a party
        add_resp = requests.post(
            f"{API_URL}/parties",
            headers=host_headers,
            json={"name": "No-Show Test", "size": "2", "phone": "+1 555 0001"},
        )
        assert add_resp.status_code == 201
        party_id = add_resp.json()["id"]

        # Remove (mark as no-show)
        remove_resp = requests.delete(
            f"{API_URL}/parties/{party_id}",
            headers=host_headers,
        )
        assert remove_resp.status_code == 204

        # Verify in history as no-show
        hist_resp = requests.get(f"{API_URL}/parties/history", headers=host_headers)
        history = hist_resp.json()
        removed = [h for h in history if h["id"] == party_id]
        assert len(removed) == 1
        assert removed[0]["resolution"] == "no-show"


# ---------------------------------------------------------------------------
# Manager Role Access
# ---------------------------------------------------------------------------


class TestManagerAccess:
    def test_manager_can_view_active_parties(self, manager_headers: dict) -> None:
        resp = requests.get(f"{API_URL}/parties/active", headers=manager_headers)
        assert resp.status_code == 200

    def test_manager_can_add_party(self, manager_headers: dict) -> None:
        resp = requests.post(
            f"{API_URL}/parties",
            headers=manager_headers,
            json={"name": "Manager Added", "size": "3", "phone": "+1 555 0002"},
        )
        assert resp.status_code == 201

    def test_manager_can_seat_party(self, manager_headers: dict) -> None:
        # Add a party
        add_resp = requests.post(
            f"{API_URL}/parties",
            headers=manager_headers,
            json={"name": "Manager Seat Test", "size": "2", "phone": "+1 555 0003"},
        )
        assert add_resp.status_code == 201
        party_id = add_resp.json()["id"]

        # Seat the party
        seat_resp = requests.post(
            f"{API_URL}/parties/{party_id}/seat",
            headers=manager_headers,
        )
        assert seat_resp.status_code == 200
