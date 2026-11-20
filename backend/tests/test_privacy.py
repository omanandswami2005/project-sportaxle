"""SRS FR-3.5: a captain's purse and prices are visible to that captain only."""

PRIVATE_KEYS = {"purse", "pin_hash", "sold_price", "spent", "remaining"}


def keys(payload) -> set[str]:
    if isinstance(payload, dict):
        return set(payload) | {k for value in payload.values() for k in keys(value)}
    if isinstance(payload, list):
        return {k for item in payload for k in keys(item)}
    return set()


def test_public_endpoints_never_expose_money(client, admin, alpha):
    client.post("/api/auction/next", headers=admin)
    client.post("/api/auction/bid", json={"amount": 200}, headers=alpha)
    client.post("/api/auction/close", headers=admin)

    client.post("/api/fixtures", json={"sport": "Chess", "team_a_id": 1, "team_b_id": 2, "starts_at": "2026-11-25T10:00"}, headers=admin)
    public = ("/api/teams", "/api/players", "/api/auction", "/api/standings", "/api/standings?sport=Chess", "/api/matches", "/api/fixtures")
    for path in public:
        res = client.get(path)
        assert res.status_code == 200
        assert not keys(res.json()) & PRIVATE_KEYS, path


def test_dashboard_shows_only_the_signed_in_team(client, admin, alpha, bravo):
    client.post("/api/auction/next", headers=admin)
    client.post("/api/auction/bid", json={"amount": 200}, headers=alpha)
    client.post("/api/auction/close", headers=admin)

    assert client.get("/api/me/dashboard").status_code == 401
    assert client.get("/api/me/dashboard", headers=admin).status_code == 403

    mine = client.get("/api/me/dashboard", headers=alpha).json()
    assert mine["team"]["name"] == "Alpha" and len(mine["players"]) == 1

    theirs = client.get("/api/me/dashboard", headers=bravo).json()
    assert theirs["team"]["name"] == "Bravo"
    assert (theirs["players"], theirs["remaining"]) == ([], 1000)
