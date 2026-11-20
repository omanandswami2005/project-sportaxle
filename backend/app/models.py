"""Database tables. Standings and spending are derived, never stored."""

from enum import Enum

from pydantic import NaiveDatetime
from sqlalchemy import LargeBinary
from sqlmodel import Column, Field, SQLModel


class PlayerStatus(str, Enum):
    available = "available"
    sold = "sold"
    unsold = "unsold"


class Team(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    captain: str
    color: str = "#00A0DC"
    captain_photo_url: str | None = None
    purse: int  # private: starting auction budget
    pin_hash: str  # private


class Player(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    department: str
    sports: str = ""  # the sports they signed up for, e.g. "Cricket, Chess"
    photo_url: str | None = None
    base_price: int
    status: PlayerStatus = PlayerStatus.available
    team_id: int | None = Field(default=None, foreign_key="team.id")
    sold_price: int | None = None  # private to the buying captain


class Auction(SQLModel, table=True):
    """Single row (id=1): the player currently on the block and the top bid."""

    id: int = Field(default=1, primary_key=True)
    player_id: int | None = Field(default=None, foreign_key="player.id")
    bid: int | None = None
    team_id: int | None = Field(default=None, foreign_key="team.id")
    last_player_id: int | None = Field(default=None, foreign_key="player.id")
    ends_at: float | None = None  # epoch seconds; bidding closes automatically then
    paused_left: float | None = None  # seconds left when the auctioneer paused; None = running


class Fixture(SQLModel, table=True):
    """A scheduled match. Recording its result turns it into a Match."""

    id: int | None = Field(default=None, primary_key=True)
    sport: str
    team_a_id: int = Field(foreign_key="team.id")
    team_b_id: int = Field(foreign_key="team.id")
    starts_at: NaiveDatetime  # event-local wall-clock time
    venue: str = ""


class Match(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    sport: str
    team_a_id: int = Field(foreign_key="team.id")
    team_b_id: int = Field(foreign_key="team.id")
    winner_id: int | None = Field(default=None, foreign_key="team.id")  # None = tie


class LoginFailure(SQLModel, table=True):
    """One wrong access code, kept briefly so guessing can be slowed down (see services/throttle)."""

    id: int | None = Field(default=None, primary_key=True)
    target: str = Field(index=True)  # "admin" or "team:<id>"
    ip: str = ""
    at: float


class Photo(SQLModel, table=True):
    """An uploaded photo, kept in the database so it works where the disk is read-only."""

    key: str = Field(primary_key=True)  # the path after /photos/
    data: bytes = Field(sa_column=Column(LargeBinary, nullable=False))


class EventSetting(SQLModel, table=True):
    """Single row (id=1): organiser settings that are not auction state."""

    id: int = Field(default=1, primary_key=True)
    squad_limit: int | None = None  # most players a team may buy; None = no limit
