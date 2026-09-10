from __future__ import annotations

from app.auth import authenticate, verify_password, hash_password, decode_token, create_access_token


class TestPasswordHelpers:
    def test_hash_and_verify(self) -> None:
        plain = "my-secret-password"
        hashed = hash_password(plain)
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
        assert verify_password(plain, hashed) is True
        assert verify_password("wrong", hashed) is False

    def test_different_hashes_same_password(self) -> None:
        """bcrypt uses random salt, so two hashes of the same password differ."""
        h1 = hash_password("pwd")
        h2 = hash_password("pwd")
        assert h1 != h2
        assert verify_password("pwd", h1) is True
        assert verify_password("pwd", h2) is True


class TestTokenHelpers:
    def test_create_and_decode(self) -> None:
        token = create_access_token("host")
        username = decode_token(token)
        assert username == "host"

    def test_token_with_custom_ttl(self) -> None:
        token = create_access_token("host", expires_delta=5)
        payload = decode_token(token)
        assert payload == "host"

    def test_invalid_token_raises(self) -> None:
        from fastapi import HTTPException
        try:
            decode_token("not.a.valid.jwt")
            assert False, "expected HTTPException"
        except HTTPException as e:
            assert e.status_code == 401

    def test_tampered_token_raises(self) -> None:
        from fastapi import HTTPException
        token = create_access_token("host")
        tampered = token[:-5] + "xxxxx"
        try:
            decode_token(tampered)
            assert False, "expected HTTPException"
        except HTTPException as e:
            assert e.status_code == 401


class TestAuthenticate:
    def test_valid_credentials(self) -> None:
        token = authenticate("host", "host123")
        assert token is not None
        assert decode_token(token) == "host"

    def test_wrong_password(self) -> None:
        assert authenticate("host", "wrongpassword") is None

    def test_nonexistent_user(self) -> None:
        assert authenticate("ghost", "anything") is None

    def test_token_unique_per_login(self) -> None:
        t1 = authenticate("host", "host123")
        t2 = authenticate("host", "host123")
        assert t1 != t2  # new token each time
