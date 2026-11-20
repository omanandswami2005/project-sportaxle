"""Fast fixtures: one in-memory SQLite database per test, no server, no files."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app import security
from app.config import settings
from app.db import get_session
from app.main import app
from app.seed import seed
from app.services import auction as auction_service

SEED = {
    "teams": [
        {"name": "Alpha", "captain": "Asha", "purse": 1000, "pin": "a-pin"},
        {"name": "Bravo", "captain": "Bala", "purse": 1000, "pin": "b-pin"},
    ],
    "players": [
        {"name": "P1", "department": "Eng", "base_price": 200},
        {"name": "P2", "department": "QA", "base_price": 300},
    ],
}


@pytest.fixture(autouse=True)
def fast_hashing(monkeypatch):
    """Slow PBKDF2 protects real access codes; tests only need hashing to round-trip."""
    monkeypatch.setattr(security, "PIN_ITERATIONS", 1)


@pytest.fixture(autouse=True)
def first_player(monkeypatch):
    """The draw is random in production; tests take the lowest id so they stay predictable."""
    monkeypatch.setattr(auction_service, "_pick", lambda pool: min(pool, key=lambda p: p.id))


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed(session, {key: [dict(row) for row in rows] for key, rows in SEED.items()})

    def override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


def _login(client: TestClient, team_id: int | None, pin: str) -> dict[str, str]:
    res = client.post("/api/auth/login", json={"team_id": team_id, "pin": pin})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


@pytest.fixture
def admin(client):
    return _login(client, None, settings.admin_pin)


@pytest.fixture
def alpha(client):
    return _login(client, 1, "a-pin")


@pytest.fixture
def bravo(client):
    return _login(client, 2, "b-pin")


@pytest.fixture
def squads(client, admin, alpha, bravo):
    """Alpha bought P1 and Bravo bought P2, so both teams have a squad."""
    for headers, amount in ((alpha, 200), (bravo, 300)):
        client.post("/api/auction/next", headers=admin)
        client.post("/api/auction/bid", json={"amount": amount}, headers=headers)
        client.post("/api/auction/close", headers=admin)
