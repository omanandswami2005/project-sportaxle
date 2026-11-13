"""Database tables. Standings and spending are derived, never stored."""

from enum import Enum

from sqlmodel import Field, SQLModel


class PlayerStatus(str, Enum):
    available = "available"
    sold = "sold"
    unsold = "unsold"


class Team(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    captain: str
    color: str = "#00A0DC"
    purse: int  # private: starting auction budget
    pin_hash: str  # private


class Player(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    department: str
    details: str = ""
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


class Match(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    sport: str
    team_a_id: int = Field(foreign_key="team.id")
    team_b_id: int = Field(foreign_key="team.id")
    winner_id: int | None = Field(default=None, foreign_key="team.id")  # None = tie
