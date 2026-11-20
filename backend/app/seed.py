"""Reset the database from a JSON file.

    uv run python -m app.seed [seed.json]

WARNING: drops every table first. Defaults to seed.example.json (demo data).
"""

import json
import sys
from pathlib import Path

from sqlmodel import Session, SQLModel, select

from .db import engine
from .models import Player, Team
from .security import hash_pin

DEFAULT = Path(__file__).resolve().parents[1] / "seed.example.json"


def seed(session: Session, data: dict) -> None:
    for team in data["teams"]:
        pin = team.pop("pin")
        session.add(Team(**team, pin_hash=hash_pin(pin)))
    for player in data["players"]:
        session.add(Player(**player))
    session.commit()


def seed_if_empty(session: Session, path: Path) -> bool:
    """Load `path` only when there are no teams yet, so a restart never touches live data."""
    if session.exec(select(Team)).first() is not None:
        return False
    seed(session, json.loads(path.read_text()))
    return True


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed(session, json.loads(path.read_text()))
    print(f"Seeded from {path.name}")


if __name__ == "__main__":
    main()
