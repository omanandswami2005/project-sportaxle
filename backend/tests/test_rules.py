"""Squad limit, duplicate fixtures, results needing squads, per-person throttle, admin sign-out."""

import jwt

from app import config
from app.services import throttle

AUTH = "/api/auth/login"
FIXTURE = {"sport": "Cricket", "team_a_id": 1, "team_b_id": 2, "starts_at": "2026-11-25T10:00"}


def buy(client, admin, headers, amount, player_id=None):
    client.post("/api/auction/next", json={"player_id": player_id} if player_id else None, headers=admin)
    client.post("/api/auction/bid", json={"amount": amount}, headers=headers)
    return client.post("/api/auction/close", headers=admin)


def test_admin_sets_and_changes_the_squad_limit_and_everyone_sees_it(client, admin, alpha):
    assert client.get("/api/auction").json()["squad_limit"] is None
    assert client.put("/api/auction/squad-limit", json={"limit": 1}, headers=alpha).status_code == 403
    assert client.put("/api/auction/squad-limit", json={"limit": 0}, headers=admin).status_code == 422
    assert client.put("/api/auction/squad-limit", json={"limit": 1}, headers=admin).json()["squad_limit"] == 1

    buy(client, admin, alpha, 200)
    client.post("/api/auction/next", headers=admin)  # P2 on the block
    full = client.post("/api/auction/bid", json={"amount": 300}, headers=alpha)
    assert full.status_code == 409 and "full" in full.json()["detail"]

    client.put("/api/auction/squad-limit", json={"limit": 2}, headers=admin)  # raise it mid-auction
    assert client.post("/api/auction/bid", json={"amount": 300}, headers=alpha).status_code == 200
    # Alpha holds a 2nd player's leading bid: the limit cannot drop below that.
    low = client.put("/api/auction/squad-limit", json={"limit": 1}, headers=admin)
    assert low.status_code == 409 and "Alpha" in low.json()["detail"]
    assert client.put("/api/auction/squad-limit", json={"limit": None}, headers=admin).status_code == 200


def test_results_need_squads_and_fixtures_are_not_duplicated(client, admin, squads):
    assert client.post("/api/fixtures", json=FIXTURE, headers=admin).status_code == 201
    dup = client.post("/api/fixtures", json={**FIXTURE, "team_a_id": 2, "team_b_id": 1, "sport": "cricket"}, headers=admin)
    assert dup.status_code == 409
    later = {**FIXTURE, "starts_at": "2026-11-26T10:00"}
    assert client.post("/api/fixtures", json=later, headers=admin).status_code == 201  # a rematch is fine


def test_a_team_without_players_cannot_have_a_result(client, admin, alpha):
    buy(client, admin, alpha, 200)  # only Alpha has a squad
    body = {"sport": "Cricket", "team_a_id": 1, "team_b_id": 2, "winner_id": 1}
    res = client.post("/api/matches", json=body, headers=admin)
    assert res.status_code == 422 and "Bravo" in res.json()["detail"]
    fixture = client.post("/api/fixtures", json=FIXTURE, headers=admin).json()
    assert client.post(f"/api/fixtures/{fixture['id']}/result", json={}, headers=admin).status_code == 422


def test_one_persons_wrong_codes_do_not_lock_others_out(client, monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    guesser = {"x-forwarded-for": "10.0.0.1, 76.1.1.1"}
    for _ in range(throttle.MAX_FAILURES):
        client.post(AUTH, json={"team_id": 1, "pin": "nope"}, headers=guesser)
    assert client.post(AUTH, json={"team_id": 1, "pin": "a-pin"}, headers=guesser).status_code == 429
    colleague = {"x-forwarded-for": "10.0.0.2"}
    assert client.post(AUTH, json={"team_id": 1, "pin": "a-pin"}, headers=colleague).status_code == 200


def test_many_addresses_together_still_hit_the_per_team_ceiling(client, monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    for n in range(throttle.MAX_FAILURES_ANY):
        client.post(AUTH, json={"team_id": 1, "pin": "no"}, headers={"x-forwarded-for": f"9.9.9.{n}"})
    fresh = {"x-forwarded-for": "8.8.8.8"}
    assert client.post(AUTH, json={"team_id": 1, "pin": "a-pin"}, headers=fresh).status_code == 429


def test_a_client_cannot_dodge_the_limit_by_forging_a_header_off_vercel(client, monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    for n in range(throttle.MAX_FAILURES):
        client.post(AUTH, json={"team_id": 1, "pin": "no"}, headers={"x-forwarded-for": f"7.7.7.{n}"})
    again = client.post(AUTH, json={"team_id": 1, "pin": "no"}, headers={"x-forwarded-for": "1.2.3.4"})
    assert again.status_code == 429


def test_changing_the_admin_code_signs_out_old_admin_tokens(client, admin, monkeypatch):
    assert client.post("/api/auction/next", headers=admin).status_code == 200
    monkeypatch.setattr(config, "settings", config.Settings(admin_pin="a-brand-new-admin-code"))
    from app import security

    monkeypatch.setattr(security, "settings", config.settings)
    assert client.post("/api/auction/close", headers=admin).status_code == 401
    no_stamp = jwt.encode({"role": "admin", "exp": 4_000_000_000}, config.settings.secret_key, "HS256")
    assert client.post("/api/auction/close", headers={"Authorization": f"Bearer {no_stamp}"}).status_code == 401
