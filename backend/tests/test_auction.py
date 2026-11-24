import pytest

from app.services import auction as auction_service


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

    # The draw only takes players nobody has seen yet...
    assert client.post("/api/auction/next", headers=admin).json()["player"]["name"] == "P2"
    client.post("/api/auction/close", headers=admin)
    nobody_new = client.post("/api/auction/next", headers=admin)
    assert nobody_new.status_code == 409 and "unsold" in nobody_new.json()["detail"]
    # ...so unsold players never loop; the auctioneer offers one again by choosing them.
    again = client.post("/api/auction/next", json={"player_id": 1}, headers=admin)
    assert again.json()["player"]["name"] == "P1"


def test_roles_are_enforced(client, admin, alpha):
    assert client.post("/api/auction/next").status_code == 401
    assert client.post("/api/auction/next", headers=alpha).status_code == 403
    assert client.post("/api/auction/close", headers=alpha).status_code == 403
    assert bid(client, admin, 200).status_code == 403
    assert client.post("/api/auth/login", json={"team_id": 1, "pin": "nope"}).status_code == 401


class Clock:
    def __init__(self):
        self.t = 1_000.0

    def __call__(self):
        return self.t


@pytest.fixture
def clock(monkeypatch):
    clock = Clock()
    monkeypatch.setattr(auction_service, "_now", clock)
    return clock


def test_countdown_starts_at_30_and_every_bid_restarts_it(client, admin, alpha, bravo, clock):
    assert client.post("/api/auction/next", headers=admin).json()["seconds_left"] == 30
    clock.t += 20
    assert client.get("/api/auction").json()["seconds_left"] == 10
    clock.t += 0.75  # the exact time lets browsers count down locally between polls
    state = client.get("/api/auction").json()
    assert (state["seconds_left"], state["ms_left"]) == (10, 9250)
    assert bid(client, alpha, 200).json()["seconds_left"] == 30
    clock.t += 29
    assert bid(client, bravo, 300).json()["seconds_left"] == 30


def test_time_up_sells_to_the_latest_bid(client, admin, alpha, bravo, clock):
    client.post("/api/auction/next", headers=admin)
    bid(client, alpha, 200)
    bid(client, bravo, 300)
    clock.t += 30

    state = client.get("/api/auction").json()  # any viewer's poll settles it
    assert state["player"] is None and state["seconds_left"] is None
    assert state["last"]["status"] == "sold" and state["last"]["team_id"] == 2
    assert client.get("/api/me/dashboard", headers=bravo).json()["spent"] == 300


def test_late_bid_is_rejected_and_the_leader_keeps_the_player(client, admin, alpha, bravo, clock):
    client.post("/api/auction/next", headers=admin)
    bid(client, alpha, 200)
    clock.t += 31

    res = bid(client, bravo, 300)
    assert res.status_code == 409 and "Time is up" in res.json()["detail"]
    assert client.get("/api/auction").json()["last"]["team_id"] == 1


def test_time_up_without_bids_goes_unsold_and_next_player_can_start(client, admin, clock):
    client.post("/api/auction/next", headers=admin)
    clock.t += 30
    state = client.post("/api/auction/next", headers=admin).json()  # settles, then starts P2
    assert state["player"]["name"] == "P2"
    assert client.get("/api/players").json()[0]["status"] == "unsold"


def test_auctioneer_can_still_close_early(client, admin, alpha, clock):
    client.post("/api/auction/next", headers=admin)
    bid(client, alpha, 200)
    clock.t += 5
    assert client.post("/api/auction/close", headers=admin).json()["last"]["status"] == "sold"
    assert (
        client.post("/api/auction/close", headers=admin).status_code == 409
    )  # nobody on the block


def test_pause_freezes_the_countdown_and_blocks_bids(client, admin, alpha, clock):
    client.post("/api/auction/next", headers=admin)
    clock.t += 10
    state = client.post("/api/auction/pause", headers=admin).json()
    assert (state["paused"], state["seconds_left"]) == (True, 20)

    clock.t += 300  # a long pause never runs the clock out
    assert client.get("/api/auction").json()["seconds_left"] == 20
    res = bid(client, alpha, 200)
    assert res.status_code == 409 and "paused" in res.json()["detail"]
    assert client.post("/api/auction/pause", headers=admin).status_code == 409

    state = client.post("/api/auction/resume", headers=admin).json()
    assert (state["paused"], state["seconds_left"]) == (False, 20)
    assert bid(client, alpha, 200).status_code == 200
    assert client.post("/api/auction/resume", headers=admin).status_code == 409
    assert client.post("/api/auction/pause", headers=alpha).status_code == 403


def test_undo_puts_the_last_player_back_and_refunds_the_buyer(client, admin, alpha, clock):
    assert client.post("/api/auction/undo", headers=admin).status_code == 409  # nothing yet
    client.post("/api/auction/next", headers=admin)
    bid(client, alpha, 600)
    client.post("/api/auction/close", headers=admin)
    assert client.get("/api/me/dashboard", headers=alpha).json()["remaining"] == 400

    state = client.post("/api/auction/undo", headers=admin).json()
    assert state["player"]["name"] == "P1" and state["player"]["status"] == "available"
    assert (state["bid"], state["seconds_left"], state["last"]) == (None, 30, None)
    assert client.get("/api/me/dashboard", headers=alpha).json()["remaining"] == 1000
    assert client.post("/api/auction/undo", headers=admin).status_code == 409  # P1 is on the block
    assert client.post("/api/auction/undo", headers=alpha).status_code == 403


def test_auctioneer_picks_which_player_goes_next(client, admin):
    assert (
        client.post("/api/auction/next", json={"player_id": 2}, headers=admin).json()["player"][
            "name"
        ]
        == "P2"
    )


REAL_PICK = auction_service._pick


def test_next_player_is_drawn_at_random_not_in_list_order(client, admin, monkeypatch):
    monkeypatch.setattr(auction_service, "_pick", REAL_PICK)
    monkeypatch.setattr(auction_service.secrets, "choice", lambda pool: pool[-1])
    assert client.post("/api/auction/next", headers=admin).json()["player"]["name"] == "P2"
    # the draw is over the available players only: after P2 is closed unsold, P1 (still
    # available) comes before P2 (unsold) is offered again
    client.post("/api/auction/close", headers=admin)
    assert client.post("/api/auction/next", headers=admin).json()["player"]["name"] == "P1"
