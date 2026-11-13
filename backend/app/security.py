"""PIN hashing, bearer tokens and role guards."""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

_bearer = HTTPBearer(auto_error=False)


def _digest(pin: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), salt.encode(), 100_000).hex()


def hash_pin(pin: str) -> str:
    salt = secrets.token_hex(8)
    return f"{salt}${_digest(pin, salt)}"


def verify_pin(pin: str, hashed: str) -> bool:
    salt, _, digest = hashed.partition("$")
    return hmac.compare_digest(_digest(pin, salt), digest)


@dataclass(frozen=True)
class Principal:
    role: str  # "admin" | "captain"
    team_id: int | None = None


def create_token(principal: Principal) -> str:
    payload = {
        "role": principal.role,
        "team_id": principal.team_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.token_hours),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def current_principal(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Principal:
    try:
        data = jwt.decode(creds.credentials if creds else "", settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in required") from None
    return Principal(role=data["role"], team_id=data["team_id"])


def _require(role: str):
    def guard(principal: Principal = Depends(current_principal)) -> Principal:
        if principal.role != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"{role.title()} access only")
        return principal

    return guard


require_admin = _require("admin")
require_captain = _require("captain")
