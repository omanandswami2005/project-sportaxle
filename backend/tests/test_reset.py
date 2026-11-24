"""Base price for everyone, and resetting the auction after a test run (FR-2.20, FR-6.13)."""


def bid(client, headers, amount):
    return client.post("/api/auction/bid", json={"amount": amount}, headers=headers)


def test_admin_sets_one_base_price_for_every_player_not_yet_sold(client, admin, alpha):
    client.post("/api/players", data={"name": "P3", "department": "HR", "base_price": 100}, headers=admin)
    client.post("/api/auction/next", headers=admin)  # P1 on the block
    bid(client, alpha, 200)
    client.post("/api/auction/close", headers=admin)  # P1 sold
    on_block = client.post("/api/auction/next", headers=admin).json()["player"]

    assert client.put("/api/players/base-price", json={"price": 700}, headers=alpha).status_code == 403
    assert client.put("/api/players/base-price", json={"price": 0}, headers=admin).status_code == 422
    res = client.put("/api/players/base-price", json={"price": 700}, headers=admin)
    assert res.status_code == 200

    prices = {p["name"]: p["base_price"] for p in client.get("/api/players").json()}
    assert prices["P1"] == 200  # sold: keeps the price it went at
    assert prices[on_block["name"]] == on_block["base_price"]  # on the block: unchanged
    others = [n for n in prices if n not in ("P1", on_block["name"])]
    assert others and all(prices[n] == 700 for n in others)
    assert res.json()["updated"] == len(others)


def test_reset_clears_the_auction_but_keeps_teams_and_players(client, admin, alpha, bravo):
    client.post("/api/auction/next", headers=admin)
    bid(client, alpha, 300)
    client.post("/api/auction/close", headers=admin)  # sold to Alpha
    client.post("/api/auction/next", headers=admin)
    client.post("/api/auction/close", headers=admin)  # unsold
    client.post("/api/auction/next", headers=admin)
    bid(client, bravo, 200)  # someone on the block with a bid
    players_before = len(client.get("/api/players").json())

    assert client.post("/api/auction/reset", headers=alpha).status_code == 403
    state = client.post("/api/auction/reset", headers=admin).json()
    assert (state["player"], state["bid"], state["team_id"], state["last"]) == (None, None, None, None)

    players = client.get("/api/players").json()
    assert len(players) == players_before
    assert all(p["status"] == "available" and p["team_id"] is None for p in players)
    assert len(client.get("/api/teams").json()) == 2
    dash = client.get("/api/me/dashboard", headers=alpha).json()
    assert (dash["spent"], dash["remaining"], dash["players"]) == (0, 1000, [])
    assert client.post("/api/auction/next", headers=admin).status_code == 200  # can start again
