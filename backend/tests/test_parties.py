from __future__ import annotations

import pytest
from fastapi import status

from app.models import PartyFormData


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class TestLogin:
    def test_login_success_host(self, client: TestClient) -> None:
        resp = client.post("/api/auth/login", json={"username": "host", "password": "host123"})
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["token_type"] == "bearer"
        assert "access_token" in data
        assert len(data["access_token"]) > 10

    def test_login_success_manager(self, client: TestClient) -> None:
        resp = client.post("/api/auth/login", json={"username": "manager", "password": "manager123"})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["token_type"] == "bearer"

    def test_login_wrong_password(self, client: TestClient) -> None:
        resp = client.post("/api/auth/login", json={"username": "host", "password": "oops"})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_nonexistent_user(self, client: TestClient) -> None:
        resp = client.post("/api/auth/login", json={"username": "nobody", "password": "x"})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_missing_fields(self, client: TestClient) -> None:
        resp = client.post("/api/auth/login", json={"username": "host"})
        assert resp.status_code == 422  # pydantic validation


class TestAuthGuard:
    """Every /api/parties/* endpoint must reject unauthenticated requests."""

    endpoints = [
        ("GET", "/api/parties/active"),
        ("GET", "/api/parties/history"),
        ("POST", "/api/parties"),
        ("POST", "/api/parties/p1/notify"),
        ("POST", "/api/parties/p1/seat"),
        ("DELETE", "/api/parties/p1"),
    ]

    def test_all_endpoints_require_auth(self, client: TestClient) -> None:
        for method, path in self.endpoints:
            req = getattr(client, method.lower())
            if method == "POST":
                resp = req(path, json={})
            elif method == "DELETE":
                resp = req(path)
            else:
                resp = req(path)
            assert resp.status_code == status.HTTP_401_UNAUTHORIZED, \
                f"{method} {path} should return 401, got {resp.status_code}"

    def test_bad_token_returns_401(self, client: TestClient) -> None:
        resp = client.get("/api/parties/active", headers={"Authorization": "Bearer garbage"})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_missing_auth_header_returns_401(self, client: TestClient) -> None:
        resp = client.get("/api/parties/active")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# GET /api/parties/active
# ---------------------------------------------------------------------------

class TestGetActive:
    def test_returns_seeded_parties(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.get("/api/parties/active", headers=headers)
        assert resp.status_code == status.HTTP_200_OK
        parties = resp.json()
        assert len(parties) == 3
        ids = {p["id"] for p in parties}
        assert ids == {"p1", "p2", "p3"}

    def test_active_does_not_include_history(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.get("/api/parties/active", headers=headers)
        parties = resp.json()
        for p in parties:
            assert p["resolution"] is None

    def test_active_party_shape(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.get("/api/parties/active", headers=headers)
        p = resp.json()[0]
        assert set(p.keys()) == {
            "id", "name", "size", "phone", "addedAt",
            "notifiedAt", "expiresAt", "resolvedAt", "resolution",
        }
        assert isinstance(p["addedAt"], int)
        assert isinstance(p["size"], int)
        assert p["notifiedAt"] is None
        assert p["expiresAt"] is None
        assert p["resolvedAt"] is None
        assert p["resolution"] is None

    def test_active_excludes_expired(self, client: TestClient, headers: dict[str, str]) -> None:
        """If a party's expiresAt has passed, it should be moved to history as no-show."""
        # Add a fresh party, then expire it manually
        add_resp = client.post(
            "/api/parties", headers=headers,
            json={"name": "Expire Test", "size": "2", "phone": "+1 000 0000"},
        )
        party_id = add_resp.json()["id"]
        
        # Update the party's expires_at in the database to a past value
        from app.store.store import _store as _store_global
        from app.db.models import PartyModel
        
        # Use the store's session to update the database directly
        model = _store_global.session.query(PartyModel).filter(
            PartyModel.id == party_id,
            PartyModel.resolution.is_(None)
        ).first()
        assert model is not None
        model.expires_at = 1  # way in the past
        _store_global.session.commit()
        
        resp = client.get("/api/parties/active", headers=headers)
        parties = resp.json()
        active_ids = {p["id"] for p in parties}
        assert party_id not in active_ids
        # Party should now be in history as no-show
        hist = client.get("/api/parties/history", headers=headers).json()
        p_hist = [h for h in hist if h["id"] == party_id]
        assert len(p_hist) == 1
        assert p_hist[0]["resolution"] == "no-show"


# ---------------------------------------------------------------------------
# GET /api/parties/history
# ---------------------------------------------------------------------------

class TestGetHistory:
    def test_returns_seeded_history(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.get("/api/parties/history", headers=headers)
        assert resp.status_code == status.HTTP_200_OK
        parties = resp.json()
        assert len(parties) == 3
        ids = {p["id"] for p in parties}
        assert ids == {"h1", "h2", "h3"}

    def test_history_has_resolutions(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.get("/api/parties/history", headers=headers)
        for p in resp.json():
            assert p["resolution"] in ("seated", "no-show")
            assert p["resolvedAt"] is not None

    def test_history_reversed_chronological(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.get("/api/parties/history", headers=headers)
        parties = resp.json()
        assert len(parties) >= 2
        # Most recent first
        for i in range(len(parties) - 1):
            assert parties[i]["resolvedAt"] >= parties[i + 1]["resolvedAt"]


# ---------------------------------------------------------------------------
# POST /api/parties
# ---------------------------------------------------------------------------

class TestAddParty:
    def test_add_party(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.post(
            "/api/parties",
            headers=headers,
            json={"name": "New Guest", "size": "5", "phone": "+1 555 0001"},
        )
        assert resp.status_code == status.HTTP_201_CREATED
        p = resp.json()
        assert p["name"] == "New Guest"
        assert p["size"] == 5
        assert p["phone"] == "+1 555 0001"
        assert p["resolution"] is None
        assert p["notifiedAt"] is None
        assert p["expiresAt"] is None
        assert p["resolvedAt"] is None
        assert isinstance(p["id"], str) and len(p["id"]) > 0
        assert isinstance(p["addedAt"], int)

    def test_added_party_appears_in_active(self, client: TestClient, headers: dict[str, str]) -> None:
        client.post("/api/parties", headers=headers, json={"name": "X", "size": "1", "phone": "+1"})
        active = client.get("/api/parties/active", headers=headers).json()
        assert any(p["name"] == "X" for p in active)

    def test_add_party_invalid_size_zero(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.post(
            "/api/parties", headers=headers,
            json={"name": "X", "size": "0", "phone": "+1"},
        )
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_add_party_invalid_size_negative(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.post(
            "/api/parties", headers=headers,
            json={"name": "X", "size": "-1", "phone": "+1"},
        )
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_add_party_empty_name(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.post(
            "/api/parties", headers=headers,
            json={"name": "", "size": "2", "phone": "+1"},
        )
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_add_party_empty_phone(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.post(
            "/api/parties", headers=headers,
            json={"name": "X", "size": "2", "phone": ""},
        )
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_add_party_missing_fields(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.post("/api/parties", headers=headers, json={"name": "X"})
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_add_party_unauthenticated(self, client: TestClient) -> None:
        resp = client.post("/api/parties", json={"name": "X", "size": "2", "phone": "+1"})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# POST /api/parties/{id}/notify
# ---------------------------------------------------------------------------

class TestNotifyParty:
    def test_notify_set_timestamp(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.post("/api/parties/p1/notify", headers=headers)
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["party"]["id"] == "p1"
        assert data["party"]["notifiedAt"] is not None
        assert data["party"]["expiresAt"] is not None
        assert data["message"] == (
            "Your table is ready at Olive & Ember! Please come to the host stand as soon as possible."
        )

    def test_notify_updates_expires_at(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.post("/api/parties/p1/notify", headers=headers)
        data = resp.json()
        assert data["party"]["expiresAt"] > data["party"]["notifiedAt"]

    def test_notify_not_found(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.post("/api/parties/doesnotexist/notify", headers=headers)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_notify_already_notified(self, client: TestClient, headers: dict[str, str]) -> None:
        """Re-notifying should update the timestamp (just refresh)."""
        r1 = client.post("/api/parties/p2/notify", headers=headers).json()
        r2 = client.post("/api/parties/p2/notify", headers=headers).json()
        assert r2["party"]["notifiedAt"] >= r1["party"]["notifiedAt"]


# ---------------------------------------------------------------------------
# POST /api/parties/{id}/seat
# ---------------------------------------------------------------------------

class TestSeatParty:
    def test_seat_moves_to_history(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.post("/api/parties/p1/seat", headers=headers)
        assert resp.status_code == status.HTTP_200_OK
        p = resp.json()
        assert p["resolution"] == "seated"
        assert p["resolvedAt"] is not None

    def test_seated_party_no_longer_active(self, client: TestClient, headers: dict[str, str]) -> None:
        client.post("/api/parties/p1/seat", headers=headers)
        active = client.get("/api/parties/active", headers=headers).json()
        assert not any(p["id"] == "p1" for p in active)

    def test_seated_party_in_history(self, client: TestClient, headers: dict[str, str]) -> None:
        client.post("/api/parties/p1/seat", headers=headers)
        hist = client.get("/api/parties/history", headers=headers).json()
        assert any(p["id"] == "p1" and p["resolution"] == "seated" for p in hist)

    def test_seat_not_found(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.post("/api/parties/nonexistent/seat", headers=headers)
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# DELETE /api/parties/{id}
# ---------------------------------------------------------------------------

class TestRemoveParty:
    def test_remove_moves_to_history_as_no_show(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.delete("/api/parties/p2", headers=headers)
        assert resp.status_code == status.HTTP_204_NO_CONTENT

        # No longer active
        active = client.get("/api/parties/active", headers=headers).json()
        assert not any(p["id"] == "p2" for p in active)

        # In history as no-show
        hist = client.get("/api/parties/history", headers=headers).json()
        p2 = [h for h in hist if h["id"] == "p2"]
        assert len(p2) == 1
        assert p2[0]["resolution"] == "no-show"

    def test_remove_not_found(self, client: TestClient, headers: dict[str, str]) -> None:
        resp = client.delete("/api/parties/nonexistent", headers=headers)
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# End-to-end workflow
# ---------------------------------------------------------------------------

class TestWorkflow:
    def test_full_lifecycle(self, client: TestClient, headers: dict[str, str]) -> None:
        """Add -> notify -> seat."""
        # Add
        add_resp = client.post(
            "/api/parties", headers=headers,
            json={"name": "Workflow Guest", "size": "4", "phone": "+1 555 9999"},
        )
        party_id = add_resp.json()["id"]

        # Verify in active
        active = client.get("/api/parties/active", headers=headers).json()
        assert any(p["id"] == party_id for p in active)

        # Notify
        notify_resp = client.post(f"/api/parties/{party_id}/notify", headers=headers)
        assert notify_resp.status_code == status.HTTP_200_OK
        assert notify_resp.json()["party"]["notifiedAt"] is not None

        # Seat
        seat_resp = client.post(f"/api/parties/{party_id}/seat", headers=headers)
        assert seat_resp.status_code == status.HTTP_200_OK
        assert seat_resp.json()["resolution"] == "seated"

        # Not in active anymore
        active = client.get("/api/parties/active", headers=headers).json()
        assert not any(p["id"] == party_id for p in active)

        # In history as seated
        hist = client.get("/api/parties/history", headers=headers).json()
        assert any(p["id"] == party_id and p["resolution"] == "seated" for p in hist)
