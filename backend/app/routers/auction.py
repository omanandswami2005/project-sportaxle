from fastapi import APIRouter, Depends
from sqlmodel import Session

from ..db import get_session
from ..models import Auction, Player
from ..schemas import AuctionOut, BidIn, NextIn
from ..security import Principal, require_admin, require_captain
from ..services import auction

router = APIRouter(prefix="/auction", tags=["auction"])


def _view(session: Session, state: Auction) -> AuctionOut:
    player = session.get(Player, state.player_id) if state.player_id else None
    last = session.get(Player, state.last_player_id) if state.last_player_id else None
    return AuctionOut(
        player=player,
        bid=state.bid,
        team_id=state.team_id,
        min_bid=auction.min_bid(state, player) if player else None,
        last=last,
    )


@router.get("", response_model=AuctionOut)
def get_auction(session: Session = Depends(get_session)):
    return _view(session, auction.get_state(session))


@router.post("/next", response_model=AuctionOut, dependencies=[Depends(require_admin)])
def next_player(body: NextIn | None = None, session: Session = Depends(get_session)):
    return _view(session, auction.start_next(session, body.player_id if body else None))


@router.post("/close", response_model=AuctionOut, dependencies=[Depends(require_admin)])
def close(session: Session = Depends(get_session)):
    return _view(session, auction.close(session))


@router.post("/bid", response_model=AuctionOut)
def bid(
    body: BidIn,
    principal: Principal = Depends(require_captain),
    session: Session = Depends(get_session),
):
    return _view(session, auction.place_bid(session, principal.team_id, body.amount))
