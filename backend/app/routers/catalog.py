"""Public team and player lists, plus the captain's private dashboard."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..db import get_session
from ..models import Player, Team
from ..schemas import DashboardOut, PlayerOut, TeamOut
from ..security import Principal, require_captain
from ..services import auction

router = APIRouter(tags=["catalog"])


@router.get("/teams", response_model=list[TeamOut])
def list_teams(session: Session = Depends(get_session)):
    return session.exec(select(Team).order_by(Team.id)).all()


@router.get("/players", response_model=list[PlayerOut])
def list_players(session: Session = Depends(get_session)):
    return session.exec(select(Player).order_by(Player.id)).all()


@router.get("/me/dashboard", response_model=DashboardOut)
def dashboard(
    principal: Principal = Depends(require_captain), session: Session = Depends(get_session)
):
    team = session.get(Team, principal.team_id)
    players = session.exec(
        select(Player).where(Player.team_id == team.id).order_by(Player.id)
    ).all()
    spent = auction.spent(session, team.id)
    return {
        "team": team,
        "purse": team.purse,
        "spent": spent,
        "remaining": team.purse - spent,
        "players": players,
    }
