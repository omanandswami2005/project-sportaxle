def bid(client, headers, amount):
    return client.post("/api/auction/bid", json={"amount": amount}, headers=headers)


def test_player_is_sold_to_highest_bidder(client, admin, alpha, bravo):
    state = client.post("/api/auction/next", headers=admin).json()
    assert state["player"]["name"] == "P1" and state["min_bid"] == 200

    assert bid(client, alpha, 200).status_code == 200
    state = bid(client, bravo, 300).json()
    assert (state["bid"], state["team_id"], state["min_bid"]) == (300, 2, 400)

    closed = client.post("/api/auction/close", headers=admin).json()
    assert closed["player"] is None
    assert closed["last"]["status"] == "sold" and closed["last"]["team_id"] == 2

    dash = client.get("/api/me/dashboard", headers=bravo).json()
    assert (dash["spent"], dash["remaining"]) == (300, 700)
    assert dash["players"][0]["sold_price"] == 300


def test_bid_rules(client, admin, alpha, bravo):
    assert bid(client, alpha, 200).status_code == 409  # nobody on the block
    client.post("/api/auction/next", headers=admin)

    assert bid(client, alpha, 199).status_code == 409  # below base price
    assert bid(client, alpha, 1001).status_code == 409  # beyond purse
    assert bid(client, alpha, 200).status_code == 200
    assert bid(client, alpha, 300).status_code == 409  # already leading
    assert bid(client, bravo, 250).status_code == 409  # below increment
    assert bid(client, bravo, 0).status_code == 422


def test_spent_money_reduces_what_a_captain_can_bid(client, admin, alpha):
    client.post("/api/auction/next", headers=admin)
    bid(client, alpha, 800)
    client.post("/api/auction/close", headers=admin)

    client.post("/api/auction/next", headers=admin)
    res = bid(client, alpha, 300)
    assert res.status_code == 409 and "purse" in res.json()["detail"]


def test_player_without_bids_goes_unsold_and_returns_last(client, admin):
    client.post("/api/auction/next", headers=admin)
    assert client.post("/api/auction/next", headers=admin).status_code == 409  # must close first
    assert client.post("/api/auction/close", headers=admin).json()["last"]["status"] == "unsold"

    # Available players come first; the unsold one is offered again afterwards.
    assert client.post("/api/auction/next", headers=admin).json()["player"]["name"] == "P2"
    client.post("/api/auction/close", headers=admin)
    assert client.post("/api/auction/next", headers=admin).json()["player"]["name"] == "P1"


def test_roles_are_enforced(client, admin, alpha):
    assert client.post("/api/auction/next").status_code == 401
    assert client.post("/api/auction/next", headers=alpha).status_code == 403
    assert client.post("/api/auction/close", headers=alpha).status_code == 403
    assert bid(client, admin, 200).status_code == 403
    assert client.post("/api/auth/login", json={"team_id": 1, "pin": "nope"}).status_code == 401
