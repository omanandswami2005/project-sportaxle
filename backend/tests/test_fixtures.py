"""Fixtures (schedule) and per-sport points tables."""

FIXTURE = {
    "sport": "Cricket",
    "team_a_id": 1,
    "team_b_id": 2,
    "starts_at": "2026-11-25T10:00",
    "venue": "Ground A",
}


def test_admin_schedules_fixtures_everyone_sees_them_in_time_order(client, admin, alpha):
    assert client.post("/api/fixtures", json=FIXTURE).status_code == 401
    assert client.post("/api/fixtures", json=FIXTURE, headers=alpha).status_code == 403
    assert (
        client.post("/api/fixtures", json={**FIXTURE, "team_b_id": 1}, headers=admin).status_code
        == 422
    )

    client.post("/api/fixtures", json=FIXTURE, headers=admin)
    client.post(
        "/api/fixtures",
        json={**FIXTURE, "sport": "Chess", "starts_at": "2026-11-24T09:00"},
        headers=admin,
    )
    listed = client.get("/api/fixtures").json()
    assert [f["sport"] for f in listed] == ["Chess", "Cricket"]
    assert listed[1]["venue"] == "Ground A"

    assert client.delete(f"/api/fixtures/{listed[0]['id']}", headers=admin).status_code == 204
    assert len(client.get("/api/fixtures").json()) == 1


def test_recording_a_fixture_result_moves_it_to_results(client, admin, squads):
    fixture = client.post("/api/fixtures", json=FIXTURE, headers=admin).json()
    url = f"/api/fixtures/{fixture['id']}/result"
    assert client.post(url, json={"winner_id": 9}, headers=admin).status_code == 422

    match = client.post(url, json={"winner_id": 2}, headers=admin)
    assert match.status_code == 201 and match.json()["sport"] == "Cricket"
    assert client.get("/api/fixtures").json() == []
    assert client.get("/api/standings").json()[0]["team"] == "Bravo"
    assert client.post(url, json={"winner_id": 2}, headers=admin).status_code == 404


def test_points_table_per_sport(client, admin, squads):
    def result(sport, winner):
        client.post(
            "/api/matches",
            json={"sport": sport, "team_a_id": 1, "team_b_id": 2, "winner_id": winner},
            headers=admin,
        )

    result("Cricket", 1)
    result(" cricket ", 1)
    result("Chess", 2)
    cricket = client.get("/api/standings", params={"sport": "CRICKET"}).json()
    assert [(r["team"], r["points"]) for r in cricket] == [("Alpha", 4), ("Bravo", 0)]
    chess = client.get("/api/standings", params={"sport": "Chess"}).json()
    assert chess[0]["team"] == "Bravo" and chess[0]["played"] == 1
    overall = client.get("/api/standings").json()
    assert overall[0]["played"] == 3
