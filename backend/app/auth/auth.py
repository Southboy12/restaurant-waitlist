from __future__ import annotations

import os
from typing import Annotated

from pydantic import BaseModel

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SECRET_KEY = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("TOKEN_EXPIRE_MIN", "60"))


# ---------------------------------------------------------------------------
# In-memory user store (seeded in app startup)
# ---------------------------------------------------------------------------

class StaffUser(BaseModel):
    username: str
    hashed_password: str


_users: dict[str, StaffUser] = {}


def _seed_users() -> None:
    """Create default staff accounts. Only runs once per process."""
    if _users:
        return
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    _users["host"] = StaffUser(
        username="host",
        hashed_password=pwd_context.hash("host123"),
    )
    _users["manager"] = StaffUser(
        username="manager",
        hashed_password=pwd_context.hash("manager123"),
    )


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def get_pwd_context() -> CryptContext:
    return CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return get_pwd_context().hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return get_pwd_context().verify(plain, hashed)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def create_access_token(username: str, expires_delta: int | None = None) -> str:
    import secrets
    import time

    ttl = expires_delta if expires_delta is not None else ACCESS_TOKEN_EXPIRE_MINUTES * 60
    expire = int(time.time()) + ttl
    payload = {"sub": username, "exp": expire, "jti": secrets.token_hex(8)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> str:
    """Return the username from a valid token, or raise HTTPException 401."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# ---------------------------------------------------------------------------
# FastAPI deps
# ---------------------------------------------------------------------------

security = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> str:
    """Return the authenticated username, or raise 401."""
    if creds is None or creds.credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid authentication token")
    return decode_token(creds.credentials)


def authenticate(username: str, password: str) -> str | None:
    """Validate credentials and return a fresh bearer token, or None."""
    _seed_users()
    user = _users.get(username)
    if user is None:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return create_access_token(username)
