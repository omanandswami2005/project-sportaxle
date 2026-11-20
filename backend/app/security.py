"""PIN hashing, bearer tokens and role guards."""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from .config import settings
from .db import get_session
from .models import Team

_bearer = HTTPBearer(auto_error=False)
PIN_ITERATIONS = 100_000  # tests lower this; the count is not stored, so keep it fixed in production


def _digest(pin: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), salt.encode(), PIN_ITERATIONS).hex()


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
    stamp: str | None = None  # captain: salt of the access code the token was issued for


def pin_stamp(pin_hash: str) -> str:
    """Changes whenever the access code is reset, which signs the old tokens out."""
    return pin_hash.partition("$")[0]


def admin_stamp() -> str:
    """Keyed by the secret, so it is safe to put in a token. Changing ADMIN_PIN changes it,
    which signs out every admin token issued under the old code."""
    key, pin = settings.secret_key.encode(), settings.admin_pin.encode()
    return hmac.new(key, b"admin:" + pin, hashlib.sha256).hexdigest()[:16]


def create_token(principal: Principal) -> str:
    payload = {
        "role": principal.role,
        "team_id": principal.team_id,
        "stamp": principal.stamp,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.token_hours),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def current_principal(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Principal:
    try:
        data = jwt.decode(
            creds.credentials if creds else "",
            settings.secret_key,
            algorithms=["HS256"],
            options={"require": ["exp", "role"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in required") from None
    team_id = data.get("team_id")
    valid = data["role"] == "admin" or (data["role"] == "captain" and isinstance(team_id, int))
    if not valid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in required")
    return Principal(role=data["role"], team_id=team_id, stamp=data.get("stamp"))


def _require(role: str):
    def guard(principal: Principal = Depends(current_principal)) -> Principal:
        if principal.role != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"{role.title()} access only")
        return principal

    return guard


_admin = _require("admin")


def require_admin(principal: Principal = Depends(_admin)) -> Principal:
    if not hmac.compare_digest(principal.stamp or "", admin_stamp()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in required")
    return principal


_captain = _require("captain")


def require_captain(
    principal: Principal = Depends(_captain), session: Session = Depends(get_session)
) -> Principal:
    """A captain's token stops working the moment their access code is reset."""
    team = session.get(Team, principal.team_id)
    if team is None or pin_stamp(team.pin_hash) != principal.stamp:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in required")
    return principal
