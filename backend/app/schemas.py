"""API shapes. Public schemas deliberately omit purse, PIN and sold price."""

from pydantic import BaseModel, ConfigDict, Field

from .models import PlayerStatus


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TeamOut(Out):
    id: int
    name: str
    captain: str
    color: str


class PlayerOut(Out):
    id: int
    name: str
    department: str
    details: str
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
    last: PlayerOut | None


class DashboardOut(Out):
    team: TeamOut
    purse: int
    spent: int
    remaining: int
    players: list[PurchaseOut]


class LoginIn(BaseModel):
    team_id: int | None = None  # None = admin
    pin: str


class LoginOut(BaseModel):
    token: str
    role: str
    team_id: int | None


class BidIn(BaseModel):
    amount: int = Field(gt=0)


class NextIn(BaseModel):
    player_id: int | None = None


class MatchIn(BaseModel):
    sport: str = Field(min_length=1, max_length=40)
    team_a_id: int
    team_b_id: int
    winner_id: int | None = None


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
