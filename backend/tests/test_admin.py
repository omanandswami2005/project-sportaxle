from app import config

TEAM = {"name": "Echo", "captain": "Esha", "color": "#112233", "purse": 5000, "pin": "echo-99"}
PLAYER = {"name": "New Kid", "department": "Eng", "base_price": "250"}
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32


def test_admin_adds_a_team_whose_captain_can_sign_in(client, admin, alpha):
    assert client.post("/api/teams", json=TEAM).status_code == 401
    assert client.post("/api/teams", json=TEAM, headers=alpha).status_code == 403

    res = client.post("/api/teams", json=TEAM, headers=admin)
    assert res.status_code == 201
    assert set(res.json()) == {"id", "name", "captain", "color"}  # no purse, no PIN
    assert client.post("/api/teams", json=TEAM, headers=admin).status_code == 409  # duplicate
    assert client.post("/api/teams", json={**TEAM, "name": "F", "pin": "123"}, headers=admin).status_code == 422

    login = client.post("/api/auth/login", json={"team_id": res.json()["id"], "pin": "echo-99"})
    dash = client.get("/api/me/dashboard", headers={"Authorization": f"Bearer {login.json()['token']}"})
    assert dash.json()["remaining"] == 5000


def test_admin_adds_a_player_with_a_photo_and_removes_them(client, admin, alpha, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PHOTOS_DIR", tmp_path)
    assert client.post("/api/players", data=PLAYER, headers=alpha).status_code == 403
    assert client.post("/api/players", data={**PLAYER, "base_price": "0"}, headers=admin).status_code == 422
    bad = {"photo": ("evil.html", b"<script>", "text/html")}
    assert client.post("/api/players", data=PLAYER, files=bad, headers=admin).status_code == 422

    res = client.post("/api/players", data=PLAYER, files={"photo": ("me.png", PNG, "image/png")}, headers=admin)
    assert res.status_code == 201
    player = res.json()
    assert player["status"] == "available" and player["photo_url"].endswith(".png")
    saved = tmp_path / player["photo_url"].removeprefix("/photos/")
    assert saved.read_bytes() == PNG

    assert client.delete(f"/api/players/{player['id']}", headers=admin).status_code == 204
    assert not saved.exists()
    assert len(client.get("/api/players").json()) == 2


def test_sold_or_on_block_players_cannot_be_removed(client, admin, alpha):
    client.post("/api/auction/next", headers=admin)
    assert client.delete("/api/players/1", headers=admin).status_code == 409  # on the block
    client.post("/api/auction/bid", json={"amount": 200}, headers=alpha)
    client.post("/api/auction/close", headers=admin)
    assert client.delete("/api/players/1", headers=admin).status_code == 409  # sold
    assert client.delete("/api/players/99", headers=admin).status_code == 409
