"""Auction rules. All state changes go through here, serialised by one lock.

Two layers keep bids honest: a thread lock inside one process, and a row lock on the auction
row (`SELECT ... FOR UPDATE`, ignored by SQLite) for several processes or serverless instances.
"""

import math
import secrets
import threading
import time

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..config import settings
from ..models import Auction, EventSetting, Player, PlayerStatus, Team

_lock = threading.Lock()


def _now() -> float:
    return time.time()  # tests replace this to control the clock


class AuctionError(Exception):
    """A rule was broken; the message is safe to show to the user."""


def get_state(session: Session, lock: bool = True) -> Auction:
    """The auction row, re-read from the database. With `lock`, other transactions that try to
    lock it wait until this one commits or rolls back."""
    query = select(Auction).where(Auction.id == 1).execution_options(populate_existing=True)
    state = session.exec(query.with_for_update() if lock else query).first()
    if state is None:
        try:
            session.add(Auction(id=1))
            session.commit()
        except IntegrityError:  # another instance created it first
            session.rollback()
        state = session.exec(query.with_for_update() if lock else query).one()
    return state


def min_bid(state: Auction, player: Player) -> int:
    return player.base_price if state.bid is None else state.bid + settings.bid_increment


def ms_left(state: Auction) -> int | None:
    if state.paused_left is not None:
        return round(state.paused_left * 1000)
    if state.ends_at is None:
        return None
    return max(0, round((state.ends_at - _now()) * 1000))


def seconds_left(state: Auction) -> int | None:
    ms = ms_left(state)
    return None if ms is None else math.ceil(ms / 1000)


def spent(session: Session, team_id: int) -> int:
    total = session.exec(
        select(func.coalesce(func.sum(Player.sold_price), 0)).where(Player.team_id == team_id)
    ).one()
    return int(total)


def squad_limit(session: Session) -> int | None:
    row = session.get(EventSetting, 1)
    return row.squad_limit if row else None


def squad_size(session: Session, team_id: int) -> int:
    return session.exec(
        select(func.count()).select_from(Player).where(Player.team_id == team_id)
    ).one()


def set_squad_limit(session: Session, limit: int | None) -> int | None:
    """Admin-settable at any time. It may not drop below a squad that already exists, counting
    the player a team is currently leading the bid on."""
    with _lock:
        state = get_state(session)
        if limit is not None:
            for team in session.exec(select(Team)).all():
                size = squad_size(session, team.id)
                if state.player_id and state.team_id == team.id:
                    size += 1
                if size > limit:
                    raise AuctionError(f"{team.name} already has {size} players")
        row = session.get(EventSetting, 1) or EventSetting(id=1)
        row.squad_limit = limit
        session.add(row)
        session.commit()
        return limit


def _pick(pool: list[Player]) -> Player:
    """Random, so nobody can predict or game the running order. Tests replace this."""
    return secrets.choice(pool)


def _next_player(session: Session, player_id: int | None) -> Player | None:
    if player_id is not None:
        player = session.get(Player, player_id)
        return player if player and player.status != PlayerStatus.sold else None
    pool = session.exec(select(Player).where(Player.status == PlayerStatus.available)).all()
    return _pick(pool) if pool else None


def start_next(session: Session, player_id: int | None = None) -> Auction:
    with _lock:
        state = get_state(session)
        _settle_if_expired(session, state)
        if state.player_id is not None:
            raise AuctionError("Close the current player first")
        player = _next_player(session, player_id)
        if player is None:
            raise AuctionError(
                "No unseen players left. Pick an unsold player from the list to offer again."
                if player_id is None
                else "That player cannot go on the block"
            )
        _put_on_block(state, player)
        session.add(state)
        session.commit()
        return state


def place_bid(session: Session, team_id: int, amount: int) -> Auction:
    with _lock:
        state = get_state(session)
        if _settle_if_expired(session, state):
            raise AuctionError("Time is up: bidding has closed")
        player = session.get(Player, state.player_id) if state.player_id else None
        if player is None:
            raise AuctionError("No player is on the block")
        if state.paused_left is not None:
            raise AuctionError("Bidding is paused")
        if state.team_id == team_id:
            raise AuctionError("You already hold the highest bid")
        if amount < min_bid(state, player):
            raise AuctionError(f"Minimum bid is {min_bid(state, player)}")
        limit = squad_limit(session)
        if limit is not None and squad_size(session, team_id) >= limit:
            raise AuctionError(f"Your squad is full ({limit} players)")
        team = session.get(Team, team_id)
        if amount > team.purse - spent(session, team_id):
            raise AuctionError("Bid exceeds your remaining purse")
        state.bid, state.team_id = amount, team_id
        state.ends_at = _now() + settings.bid_seconds  # every bid restarts the countdown
        session.add(state)
        session.commit()
        return state


def _close(session: Session, state: Auction) -> None:
    """Sell to the top bidder, or mark unsold when nobody bid. Caller holds the lock."""
    player = session.get(Player, state.player_id) if state.player_id else None
    if player is None:
        raise AuctionError("No player is on the block")
    if state.team_id is None:
        player.status = PlayerStatus.unsold
    else:
        player.status = PlayerStatus.sold
        player.team_id, player.sold_price = state.team_id, state.bid
    state.last_player_id = player.id
    state.player_id, state.bid, state.team_id, state.ends_at = None, None, None, None
    state.paused_left = None
    session.add(player)
    session.add(state)
    session.commit()


def _put_on_block(state: Auction, player: Player) -> None:
    state.player_id, state.bid, state.team_id = player.id, None, None
    state.ends_at, state.paused_left = _now() + settings.bid_seconds, None


def _settle_if_expired(session: Session, state: Auction) -> bool:
    if state.player_id is None or state.ends_at is None or _now() < state.ends_at:
        return False
    _close(session, state)
    return True


def close(session: Session) -> Auction:
    """The auctioneer brings the hammer down early."""
    with _lock:
        state = get_state(session)
        if not _settle_if_expired(session, state):  # if time already ran out, that result stands
            _close(session, state)
        return state


def settle_if_expired(session: Session) -> Auction:
    """Close the player whose countdown has run out. Called on every auction read."""
    state = get_state(session, lock=False)  # the common poll: no lock, no write
    if state.player_id is None or state.ends_at is None or _now() < state.ends_at:
        return state
    with _lock:
        state = get_state(session)  # re-read under the lock: another request may have settled it
        _settle_if_expired(session, state)
        return state


def remove_player(session: Session, player_id: int) -> str | None:
    """Delete a player who has not been bought. Returns their photo URL, if any."""
    with _lock:
        state = get_state(session)
        player = session.get(Player, player_id)
        if player is None:
            raise AuctionError("Player not found")
        if player.status == PlayerStatus.sold or state.player_id == player.id:
            raise AuctionError("A sold or on-the-block player cannot be removed")
        if state.last_player_id == player.id:
            state.last_player_id = None
            session.add(state)
        session.delete(player)
        session.commit()
        return player.photo_url


def pause(session: Session) -> Auction:
    """Freeze the countdown, e.g. while a captain reconnects. Bids wait until resume."""
    with _lock:
        state = get_state(session)
        _settle_if_expired(session, state)
        if state.player_id is None:
            raise AuctionError("No player is on the block")
        if state.paused_left is not None:
            raise AuctionError("Bidding is already paused")
        state.paused_left, state.ends_at = state.ends_at - _now(), None
        session.add(state)
        session.commit()
        return state


def resume(session: Session) -> Auction:
    with _lock:
        state = get_state(session)
        if state.paused_left is None:
            raise AuctionError("Bidding is not paused")
        state.ends_at, state.paused_left = _now() + state.paused_left, None
        session.add(state)
        session.commit()
        return state


def undo_last(session: Session) -> Auction:
    """Reverse the last result (sold or unsold): the player goes back on the block with no
    bids, so a buyer's purse is refunded automatically (spending is computed from sales)."""
    with _lock:
        state = get_state(session)
        _settle_if_expired(session, state)
        if state.player_id is not None:
            raise AuctionError("Close the current player first")
        player = session.get(Player, state.last_player_id) if state.last_player_id else None
        if player is None:
            raise AuctionError("Nothing to undo")
        player.status, player.team_id, player.sold_price = PlayerStatus.available, None, None
        state.last_player_id = None
        _put_on_block(state, player)
        session.add(player)
        session.add(state)
        session.commit()
        return state


def update_team(session: Session, team_id: int, changes: dict) -> Team:
    """Edit a team. A new purse may not drop below what the team has already spent."""
    with _lock:
        state = get_state(session)
        team = session.get(Team, team_id)
        if team is None:
            raise AuctionError("Team not found")
        if "purse" in changes:
            leading = state.bid if state.player_id and state.team_id == team_id else 0
            if changes["purse"] < spent(session, team_id) + (leading or 0):
                raise AuctionError(
                    "Purse cannot be less than what the team has spent plus its leading bid"
                )
        for key, value in changes.items():
            setattr(team, key, value)
        session.add(team)
        session.commit()
        session.refresh(team)
        return team


def update_player(session: Session, player_id: int, changes: dict) -> Player:
    """Edit a player. The base price is fixed while they are on the block."""
    with _lock:
        state = get_state(session)
        player = session.get(Player, player_id)
        if player is None:
            raise AuctionError("Player not found")
        on_block = state.player_id == player_id
        if on_block and changes.get("base_price", player.base_price) != player.base_price:
            raise AuctionError("Change the base price before the player goes on the block")
        for key, value in changes.items():
            setattr(player, key, value)
        session.add(player)
        session.commit()
        session.refresh(player)
        return player


def set_base_price(session: Session, price: int) -> int:
    """Give every player who is not sold and not on the block the same base price. Returns how
    many players changed."""
    with _lock:
        state = get_state(session)
        players = session.exec(
            select(Player).where(Player.status != PlayerStatus.sold, Player.base_price != price)
        ).all()
        changed = [p for p in players if p.id != state.player_id]
        for player in changed:
            player.base_price = price
            session.add(player)
        session.commit()
        return len(changed)


def reset(session: Session) -> Auction:
    """Undo the whole auction, e.g. after a test run: every player is Available again with no
    team or price, and nothing is on the block, so every purse is full again (spending is
    computed from sales). Teams, players, photos, matches and settings stay."""
    with _lock:
        state = get_state(session)
        for player in session.exec(select(Player)).all():
            player.status, player.team_id, player.sold_price = PlayerStatus.available, None, None
            session.add(player)
        state.player_id, state.bid, state.team_id, state.last_player_id = None, None, None, None
        state.ends_at, state.paused_left = None, None
        session.add(state)
        session.commit()
        return state
