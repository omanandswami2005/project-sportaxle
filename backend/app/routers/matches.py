from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..db import get_session
from ..models import Match, Team
from ..schemas import MatchIn, MatchOut, StandingOut
from ..security import require_admin
from ..services import standings

router = APIRouter(tags=["matches"])


@router.get("/matches", response_model=list[MatchOut])
def list_matches(session: Session = Depends(get_session)):
    return session.exec(select(Match).order_by(Match.id.desc())).all()


@router.post(
    "/matches",
    response_model=MatchOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def record_match(body: MatchIn, session: Session = Depends(get_session)):
    sides = {body.team_a_id, body.team_b_id}
    if len(sides) != 2 or any(session.get(Team, team_id) is None for team_id in sides):
        raise HTTPException(422, "Pick two different teams")
    if body.winner_id is not None and body.winner_id not in sides:
        raise HTTPException(422, "Winner must be one of the two teams")
    match = Match(**body.model_dump())
    session.add(match)
    session.commit()
    session.refresh(match)
    return match


@router.delete(
    "/matches/{match_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
def delete_match(match_id: int, session: Session = Depends(get_session)) -> None:
    match = session.get(Match, match_id)
    if match is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match not found")
    session.delete(match)
    session.commit()


@router.get("/standings", response_model=list[StandingOut])
def get_standings(session: Session = Depends(get_session)):
    return standings.compute(
        session.exec(select(Team)).all(), session.exec(select(Match)).all()
    )
