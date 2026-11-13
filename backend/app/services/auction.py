"""Auction rules. All state changes go through here, serialised by one lock.

The lock is enough because the app runs as a single process (see docs/design.md).
"""

import threading

from sqlalchemy import func
from sqlmodel import Session, select

from ..config import settings
from ..models import Auction, Player, PlayerStatus, Team

_lock = threading.Lock()


class AuctionError(Exception):
    """A rule was broken; the message is safe to show to the user."""


def get_state(session: Session) -> Auction:
    state = session.get(Auction, 1)
    if state is None:
        state = Auction(id=1)
        session.add(state)
        session.commit()
    return state


def min_bid(state: Auction, player: Player) -> int:
    return player.base_price if state.bid is None else state.bid + settings.bid_increment


def spent(session: Session, team_id: int) -> int:
    total = session.exec(
        select(func.coalesce(func.sum(Player.sold_price), 0)).where(Player.team_id == team_id)
    ).one()
    return int(total)


def _next_player(session: Session, player_id: int | None) -> Player | None:
    if player_id is not None:
        player = session.get(Player, player_id)
        return player if player and player.status != PlayerStatus.sold else None
    for wanted in (PlayerStatus.available, PlayerStatus.unsold):
        player = session.exec(
            select(Player).where(Player.status == wanted).order_by(Player.id)
        ).first()
        if player:
            return player
    return None


def start_next(session: Session, player_id: int | None = None) -> Auction:
    with _lock:
        state = get_state(session)
        if state.player_id is not None:
            raise AuctionError("Close the current player first")
        player = _next_player(session, player_id)
        if player is None:
            raise AuctionError("No players left to auction")
        state.player_id, state.bid, state.team_id = player.id, None, None
        session.add(state)
        session.commit()
        return state


def place_bid(session: Session, team_id: int, amount: int) -> Auction:
    with _lock:
        state = get_state(session)
        player = session.get(Player, state.player_id) if state.player_id else None
        if player is None:
            raise AuctionError("No player is on the block")
        if state.team_id == team_id:
            raise AuctionError("You already hold the highest bid")
        if amount < min_bid(state, player):
            raise AuctionError(f"Minimum bid is {min_bid(state, player)}")
        team = session.get(Team, team_id)
        if amount > team.purse - spent(session, team_id):
            raise AuctionError("Bid exceeds your remaining purse")
        state.bid, state.team_id = amount, team_id
        session.add(state)
        session.commit()
        return state


def close(session: Session) -> Auction:
    """Sell to the top bidder, or mark unsold when nobody bid."""
    with _lock:
        state = get_state(session)
        player = session.get(Player, state.player_id) if state.player_id else None
        if player is None:
            raise AuctionError("No player is on the block")
        if state.team_id is None:
            player.status = PlayerStatus.unsold
        else:
            player.status = PlayerStatus.sold
            player.team_id, player.sold_price = state.team_id, state.bid
        state.last_player_id = player.id
        state.player_id, state.bid, state.team_id = None, None, None
        session.add(player)
        session.add(state)
        session.commit()
        return state
