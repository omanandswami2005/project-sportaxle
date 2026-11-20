import hmac
import os

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session

from ..config import settings
from ..db import get_session
from ..models import Team
from ..schemas import LoginIn, LoginOut
from ..security import Principal, admin_stamp, create_token, pin_stamp, verify_pin
from ..services import throttle

router = APIRouter(tags=["auth"])


def client_ip(request: Request) -> str:
    """Behind Vercel the real address is the first X-Forwarded-For entry (Vercel sets it); on a
    plain server that header is the client's own claim, so it is ignored."""
    if os.getenv("VERCEL") and request.headers.get("x-forwarded-for"):
        return request.headers["x-forwarded-for"].split(",")[0].strip()
    return request.client.host if request.client else ""


@router.post("/auth/login", response_model=LoginOut)
def login(
    body: LoginIn, request: Request, session: Session = Depends(get_session)
) -> LoginOut:
    ip = client_ip(request)
    team = None if body.team_id is None else session.get(Team, body.team_id)
    if body.team_id is not None and team is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong access code")
    target = "admin" if team is None else f"team:{team.id}"
    try:
        throttle.check(session, target, ip)
    except throttle.TooManyAttempts:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many wrong codes. Wait a few minutes."
        ) from None
    if team is None:
        ok = hmac.compare_digest(body.pin.encode(), settings.admin_pin.encode())
        principal = Principal(role="admin", stamp=admin_stamp())
    else:
        ok = verify_pin(body.pin, team.pin_hash)
        principal = Principal(role="captain", team_id=team.id, stamp=pin_stamp(team.pin_hash))
    if not ok:
        throttle.record_failure(session, target, ip)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong access code")
    return LoginOut(token=create_token(principal), role=principal.role, team_id=principal.team_id)
