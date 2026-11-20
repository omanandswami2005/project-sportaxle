"""Hardening: unsafe deployments, forged or stale tokens, guessing, uploads, odd input."""

import jwt
import pytest

from app import config
from app.config import DEV_PIN, DEV_SECRET, Settings, ensure_safe
from app.services import throttle

AUTH = "/api/auth/login"


def test_a_real_deployment_refuses_the_public_dev_secrets():
    ensure_safe(Settings(database_url="sqlite:///local.db"))  # local development is fine
    prod = {"database_url": "postgresql://db/x"}
    strong = {"secret_key": "k" * 40, "admin_pin": "a-long-code"}
    ensure_safe(Settings(**prod, **strong))
    for bad in ({"secret_key": DEV_SECRET}, {"secret_key": "short"}, {"admin_pin": DEV_PIN}):
        with pytest.raises(RuntimeError):
            ensure_safe(Settings(**prod, **{**strong, **bad}))


def test_tokens_without_valid_claims_are_401_not_500(client):
    key = config.settings.secret_key
    for claims in ({"role": "admin"}, {"exp": 4_000_000_000}, {"role": "root", "exp": 4_000_000_000},
                   {"role": "captain", "team_id": None, "exp": 4_000_000_000}):
        token = jwt.encode(claims, key, algorithm="HS256")
        res = client.get("/api/me/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 401, claims


def test_resetting_an_access_code_signs_that_captain_out(client, admin, alpha, bravo):
    assert client.get("/api/me/dashboard", headers=alpha).status_code == 200
    client.patch("/api/teams/1", data={"pin": "brand-new-code"}, headers=admin)
    assert client.get("/api/me/dashboard", headers=alpha).status_code == 401
    assert client.get("/api/me/dashboard", headers=bravo).status_code == 200  # others unaffected
    assert client.post(AUTH, json={"team_id": 1, "pin": "brand-new-code"}).status_code == 200


def test_guessing_access_codes_is_slowed_down(client, monkeypatch):
    now = [1_000.0]
    monkeypatch.setattr(throttle, "_now", lambda: now[0])
    for _ in range(throttle.MAX_FAILURES):
        assert client.post(AUTH, json={"team_id": 1, "pin": "nope"}).status_code == 401
    assert client.post(AUTH, json={"team_id": 1, "pin": "nope"}).status_code == 429
    assert client.post(AUTH, json={"team_id": 1, "pin": "a-pin"}).status_code == 429  # even the right one
    assert client.post(AUTH, json={"team_id": 2, "pin": "b-pin"}).status_code == 200  # other teams fine
    now[0] += throttle.WINDOW + 1  # a cooldown, not a lock-out
    assert client.post(AUTH, json={"team_id": 1, "pin": "a-pin"}).status_code == 200


def test_the_admin_code_is_throttled_too_and_unknown_teams_are_just_401(client, monkeypatch):
    for _ in range(throttle.MAX_FAILURES):
        client.post(AUTH, json={"team_id": None, "pin": "nope"})
    assert client.post(AUTH, json={"team_id": None, "pin": "nope"}).status_code == 429
    assert client.post(AUTH, json={"team_id": 99, "pin": "x"}).status_code == 401
    assert client.post(AUTH, json={"team_id": 1, "pin": "x" * 500}).status_code == 422


def test_lowering_a_purse_cannot_undercut_the_leading_bid(client, admin, alpha):
    client.post("/api/auction/next", headers=admin)
    client.post("/api/auction/bid", json={"amount": 800}, headers=alpha)
    low = client.patch("/api/teams/1", data={"purse": "500"}, headers=admin)
    assert low.status_code == 409
    assert client.patch("/api/teams/1", data={"purse": "800"}, headers=admin).status_code == 200


def test_amounts_are_capped_and_blank_names_are_not_saved(client, admin, alpha):
    big = {"name": "Z", "captain": "Z", "purse": 10**12, "pin": "123456"}
    assert client.post("/api/teams", json=big, headers=admin).status_code == 422
    client.post("/api/auction/next", headers=admin)
    assert client.post("/api/auction/bid", json={"amount": 10**12}, headers=alpha).status_code == 422
    assert client.patch("/api/teams/1", data={"name": "   "}, headers=admin).json()["name"] == "Alpha"
    match = {"sport": "   ", "team_a_id": 1, "team_b_id": 2}
    assert client.post("/api/matches", json=match, headers=admin).status_code == 422


def test_a_fake_image_is_rejected_not_a_server_error(client, admin, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PHOTOS_DIR", tmp_path)
    data = {"name": "X", "department": "Eng", "base_price": "200"}
    for content in (b"<svg onload=alert(1)>", b"GIF89a....", b"not an image at all"):
        res = client.post("/api/players", data=data, headers=admin,
                          files={"photo": ("a.png", content, "image/png")})
        assert res.status_code == 422, content
    assert list(tmp_path.iterdir()) == []


def test_pages_get_security_headers(client):
    res = client.get("/api/teams")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in res.headers["content-security-policy"]


def test_vercel_serves_the_same_security_headers_as_the_api():
    """Vercel serves the web page itself, so vercel.json must carry the same headers."""
    import json
    from pathlib import Path

    from app.main import HEADERS

    config = json.loads((Path(__file__).parents[2] / "vercel.json").read_text())
    sent = {h["key"]: h["value"] for rule in config["headers"] for h in rule["headers"]}
    assert sent == HEADERS


def test_the_dev_defaults_are_fixed_values_not_whatever_the_environment_holds():
    assert DEV_SECRET == "dev-only-secret-change-me-in-prod" and DEV_PIN == "admin-1234"
