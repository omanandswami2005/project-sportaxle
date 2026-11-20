"""Startup seeding (SEED_FILE): loads an empty database once, never overwrites live data."""

import json

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.models import Team
from app.security import verify_pin
from app.seed import seed_if_empty

DATA = {
    "teams": [
        {"name": "Team Sahil", "captain": "Sahil Mehta", "purse": 10000, "pin": "sahi-secret",
         "captain_photo_url": "/photos/captains/sahil-mehta.jpg"},
    ],
    "players": [{"name": "P1", "department": "Eng", "base_price": 300}],
}


def _session() -> Session:
    engine = create_engine("sqlite://", poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_loads_seed_file_into_empty_database(tmp_path):
    path = tmp_path / "seed.json"
    path.write_text(json.dumps(DATA))
    with _session() as session:
        assert seed_if_empty(session, path)
        team = session.exec(select(Team)).one()
        assert team.captain_photo_url == "/photos/captains/sahil-mehta.jpg"
        assert verify_pin("sahi-secret", team.pin_hash)


def test_leaves_existing_data_alone(tmp_path):
    path = tmp_path / "seed.json"
    path.write_text(json.dumps(DATA))
    with _session() as session:
        assert seed_if_empty(session, path)
        assert not seed_if_empty(session, path)
        assert len(session.exec(select(Team)).all()) == 1
