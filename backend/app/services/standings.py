"""Points table, computed from match results on every read (never stored)."""

from ..models import Match, Team
from ..schemas import StandingOut

WIN_POINTS = 2
TIE_POINTS = 1


def compute(teams: list[Team], matches: list[Match]) -> list[StandingOut]:
    rows = {
        t.id: {"team_id": t.id, "team": t.name, "played": 0, "wins": 0, "losses": 0, "ties": 0}
        for t in teams
    }
    for m in matches:
        for team_id in (m.team_a_id, m.team_b_id):
            row = rows[team_id]
            row["played"] += 1
            if m.winner_id is None:
                row["ties"] += 1
            elif m.winner_id == team_id:
                row["wins"] += 1
            else:
                row["losses"] += 1

    def key(row: dict) -> tuple[int, int]:
        return (row["wins"] * WIN_POINTS + row["ties"] * TIE_POINTS, row["wins"])

    ordered = sorted(rows.values(), key=lambda r: (-key(r)[0], -key(r)[1], r["team"]))
    return [
        StandingOut(
            **row,
            points=key(row)[0],
            # Teams level on points and wins share a rank.
            rank=1 + sum(key(other) > key(row) for other in ordered),
        )
        for row in ordered
    ]
