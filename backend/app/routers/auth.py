import hmac

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from ..config import settings
from ..db import get_session
from ..models import Team
from ..schemas import LoginIn, LoginOut
from ..security import Principal, create_token, verify_pin

router = APIRouter(tags=["auth"])


@router.post("/auth/login", response_model=LoginOut)
def login(body: LoginIn, session: Session = Depends(get_session)) -> LoginOut:
    if body.team_id is None:
        ok = hmac.compare_digest(body.pin.encode(), settings.admin_pin.encode())
        principal = Principal(role="admin")
    else:
        team = session.get(Team, body.team_id)
        ok = team is not None and verify_pin(body.pin, team.pin_hash)
        principal = Principal(role="captain", team_id=body.team_id)
    if not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong access code")
    return LoginOut(token=create_token(principal), role=principal.role, team_id=principal.team_id)
