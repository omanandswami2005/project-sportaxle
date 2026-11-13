from app.models import Match, Team
from app.services.standings import compute


def team(id: int, name: str) -> Team:
    return Team(id=id, name=name, captain="c", purse=0, pin_hash="")


def test_points_ranking_and_shared_ranks():
    teams = [team(1, "Alpha"), team(2, "Bravo"), team(3, "Cobra"), team(4, "Delta")]
    matches = [
        Match(sport="Cricket", team_a_id=1, team_b_id=2, winner_id=1),
        Match(sport="Chess", team_a_id=1, team_b_id=3, winner_id=None),
        Match(sport="Carrom", team_a_id=2, team_b_id=3, winner_id=None),
    ]
    table = compute(teams, matches)

    assert [(r.rank, r.team, r.points) for r in table] == [
        (1, "Alpha", 3),
        (2, "Cobra", 2),
        (3, "Bravo", 1),
        (4, "Delta", 0),
    ]
    alpha = table[0]
    assert (alpha.played, alpha.wins, alpha.losses, alpha.ties) == (2, 1, 0, 1)

    level = compute(teams[:2], [])
    assert [r.rank for r in level] == [1, 1]


def test_recording_a_result_updates_the_table(client, admin, alpha):
    body = {"sport": "Cricket", "team_a_id": 1, "team_b_id": 2, "winner_id": 2}
    assert client.post("/api/matches", json=body).status_code == 401
    assert client.post("/api/matches", json=body, headers=alpha).status_code == 403
    assert client.post("/api/matches", json={**body, "team_b_id": 1}, headers=admin).status_code == 422
    assert client.post("/api/matches", json={**body, "winner_id": 9}, headers=admin).status_code == 422

    match = client.post("/api/matches", json=body, headers=admin)
    assert match.status_code == 201
    top = client.get("/api/standings").json()[0]
    assert (top["team"], top["points"], top["wins"]) == ("Bravo", 2, 1)

    assert client.delete(f"/api/matches/{match.json()['id']}", headers=admin).status_code == 204
    assert [r["points"] for r in client.get("/api/standings").json()] == [0, 0]
