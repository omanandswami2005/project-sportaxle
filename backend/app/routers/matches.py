from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, select

from ..db import get_session
from ..models import Fixture, Match, Team
from ..schemas import FixtureIn, FixtureOut, FixtureResultIn, MatchIn, MatchOut, StandingOut
from ..security import require_admin
from ..services import auction, standings

router = APIRouter(tags=["matches"])


def _check_sides(session: Session, a: int, b: int, winner: int | None = None) -> None:
    if a == b or session.get(Team, a) is None or session.get(Team, b) is None:
        raise HTTPException(422, "Pick two different teams")
    if winner is not None and winner not in (a, b):
        raise HTTPException(422, "Winner must be one of the two teams")


def _check_squads(session: Session, *team_ids: int) -> None:
    """A result needs two real squads: the auction must have given each team a player."""
    for team_id in team_ids:
        if auction.squad_size(session, team_id) == 0:
            name = session.get(Team, team_id).name
            raise HTTPException(422, f"{name} has no players yet")


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
    _check_sides(session, body.team_a_id, body.team_b_id, body.winner_id)
    _check_squads(session, body.team_a_id, body.team_b_id)
    match = Match(**{**body.model_dump(), "sport": body.sport.strip()})
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
def get_standings(sport: str | None = None, session: Session = Depends(get_session)):
    """The overall table, or one sport's table with `?sport=Cricket` (case-insensitive)."""
    matches = select(Match)
    if sport:
        matches = matches.where(func.lower(Match.sport) == sport.strip().lower())
    return standings.compute(session.exec(select(Team)).all(), session.exec(matches).all())


@router.get("/fixtures", response_model=list[FixtureOut])
def list_fixtures(session: Session = Depends(get_session)):
    return session.exec(select(Fixture).order_by(Fixture.starts_at, Fixture.id)).all()


@router.post(
    "/fixtures",
    response_model=FixtureOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def add_fixture(body: FixtureIn, session: Session = Depends(get_session)):
    _check_sides(session, body.team_a_id, body.team_b_id)
    pair = {body.team_a_id, body.team_b_id}
    same_slot = session.exec(
        select(Fixture).where(
            func.lower(Fixture.sport) == body.sport.strip().lower(),
            Fixture.starts_at == body.starts_at,
        )
    ).all()
    if any({f.team_a_id, f.team_b_id} == pair for f in same_slot):
        raise HTTPException(status.HTTP_409_CONFLICT, "That match is already scheduled")
    fixture = Fixture(**{**body.model_dump(), "sport": body.sport.strip(), "venue": body.venue.strip()})
    session.add(fixture)
    session.commit()
    session.refresh(fixture)
    return fixture


@router.delete(
    "/fixtures/{fixture_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
def delete_fixture(fixture_id: int, session: Session = Depends(get_session)) -> None:
    fixture = session.get(Fixture, fixture_id)
    if fixture is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fixture not found")
    session.delete(fixture)
    session.commit()


@router.post(
    "/fixtures/{fixture_id}/result",
    response_model=MatchOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def record_fixture_result(
    fixture_id: int, body: FixtureResultIn, session: Session = Depends(get_session)
):
    """The match was played: store the result and take it off the schedule, in one commit."""
    fixture = session.get(Fixture, fixture_id)
    if fixture is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fixture not found")
    _check_sides(session, fixture.team_a_id, fixture.team_b_id, body.winner_id)
    _check_squads(session, fixture.team_a_id, fixture.team_b_id)
    match = Match(
        sport=fixture.sport,
        team_a_id=fixture.team_a_id,
        team_b_id=fixture.team_b_id,
        winner_id=body.winner_id,
    )
    session.add(match)
    session.delete(fixture)
    session.commit()
    session.refresh(match)
    return match
