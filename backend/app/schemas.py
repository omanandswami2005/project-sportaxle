"""API shapes. Public schemas deliberately omit purse, PIN and sold price."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, NaiveDatetime, StringConstraints

from .models import PlayerStatus

MAX_RUPEES = 1_000_000_000  # keeps every amount inside a 32-bit database integer
Sport = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TeamOut(Out):
    id: int
    name: str
    captain: str
    color: str
    captain_photo_url: str | None


class PlayerOut(Out):
    id: int
    name: str
    department: str
    sports: str
    photo_url: str | None
    base_price: int
    status: PlayerStatus
    team_id: int | None


class PurchaseOut(PlayerOut):
    sold_price: int


class AuctionOut(Out):
    player: PlayerOut | None
    bid: int | None
    team_id: int | None
    min_bid: int | None
    seconds_left: int | None
    ms_left: int | None  # exact, so the browser can run the countdown locally between polls
    paused: bool
    squad_limit: int | None
    last: PlayerOut | None


class DashboardOut(Out):
    team: TeamOut
    purse: int
    spent: int
    remaining: int
    players: list[PurchaseOut]


class LoginIn(BaseModel):
    team_id: int | None = None  # None = admin
    pin: str = Field(max_length=128)


class LoginOut(BaseModel):
    token: str
    role: str
    team_id: int | None


class TeamIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    captain: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    color: str = Field("#00A0DC", pattern=r"^#[0-9a-fA-F]{6}$")
    purse: int = Field(gt=0, le=MAX_RUPEES)
    pin: Annotated[str, StringConstraints(strip_whitespace=True, min_length=6, max_length=64)]


class BidIn(BaseModel):
    amount: int = Field(gt=0, le=MAX_RUPEES)


class SquadLimitIn(BaseModel):
    limit: int | None = Field(None, gt=0, le=100)  # None = no limit


class BasePriceIn(BaseModel):
    price: int = Field(gt=0, le=MAX_RUPEES)


class NextIn(BaseModel):
    player_id: int | None = None


class MatchIn(BaseModel):
    sport: Sport
    team_a_id: int
    team_b_id: int
    winner_id: int | None = None


class FixtureIn(BaseModel):
    sport: Sport
    team_a_id: int
    team_b_id: int
    starts_at: NaiveDatetime
    venue: str = Field("", max_length=80)


class FixtureOut(Out):
    id: int
    sport: str
    team_a_id: int
    team_b_id: int
    starts_at: NaiveDatetime
    venue: str


class FixtureResultIn(BaseModel):
    winner_id: int | None = None  # None = tie


class MatchOut(Out):
    id: int
    sport: str
    team_a_id: int
    team_b_id: int
    winner_id: int | None


class StandingOut(Out):
    rank: int
    team_id: int
    team: str
    played: int
    wins: int
    losses: int
    ties: int
    points: int
