from app import config

TEAM = {"name": "Echo", "captain": "Esha", "color": "#112233", "purse": 5000, "pin": "echo-99"}
PLAYER = {"name": "New Kid", "department": "Eng", "base_price": "250"}
PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\xc9\xfe\x92\xef\x00\x00\x00\x00IEND\xaeB`\x82"


def test_admin_adds_a_team_whose_captain_can_sign_in(client, admin, alpha):
    assert client.post("/api/teams", json=TEAM).status_code == 401
    assert client.post("/api/teams", json=TEAM, headers=alpha).status_code == 403

    res = client.post("/api/teams", json=TEAM, headers=admin)
    assert res.status_code == 201
    assert set(res.json()) == {
        "id",
        "name",
        "captain",
        "color",
        "captain_photo_url",
    }  # no purse, no PIN
    assert client.post("/api/teams", json=TEAM, headers=admin).status_code == 409  # duplicate
    assert (
        client.post(
            "/api/teams", json={**TEAM, "name": "F", "pin": "123"}, headers=admin
        ).status_code
        == 422
    )

    login = client.post("/api/auth/login", json={"team_id": res.json()["id"], "pin": "echo-99"})
    dash = client.get(
        "/api/me/dashboard", headers={"Authorization": f"Bearer {login.json()['token']}"}
    )
    assert dash.json()["remaining"] == 5000


def test_admin_adds_a_player_with_a_photo_and_removes_them(
    client, admin, alpha, tmp_path, monkeypatch
):
    monkeypatch.setattr(config, "PHOTOS_DIR", tmp_path)
    assert client.post("/api/players", data=PLAYER, headers=alpha).status_code == 403
    assert (
        client.post("/api/players", data={**PLAYER, "base_price": "0"}, headers=admin).status_code
        == 422
    )
    bad = {"photo": ("evil.html", b"<script>", "text/html")}
    assert client.post("/api/players", data=PLAYER, files=bad, headers=admin).status_code == 422

    res = client.post(
        "/api/players", data=PLAYER, files={"photo": ("me.png", PNG, "image/png")}, headers=admin
    )
    assert res.status_code == 201
    player = res.json()
    assert player["status"] == "available" and player["photo_url"].endswith(".webp")
    shown = client.get(player["photo_url"])  # served from the database, not the disk
    assert shown.status_code == 200 and shown.headers["content-type"] == "image/webp"
    assert "max-age=86400" in shown.headers["cache-control"]
    again = client.get(player["photo_url"], headers={"If-None-Match": shown.headers["etag"]})
    assert again.status_code == 304 and again.content == b""  # unchanged: nothing re-sent

    assert client.delete(f"/api/players/{player['id']}", headers=admin).status_code == 204
    assert client.get(player["photo_url"]).status_code == 404
    assert len(client.get("/api/players").json()) == 2


def test_sold_or_on_block_players_cannot_be_removed(client, admin, alpha):
    client.post("/api/auction/next", headers=admin)
    assert client.delete("/api/players/1", headers=admin).status_code == 409  # on the block
    client.post("/api/auction/bid", json={"amount": 200}, headers=alpha)
    client.post("/api/auction/close", headers=admin)
    assert client.delete("/api/players/1", headers=admin).status_code == 409  # sold
    assert client.delete("/api/players/99", headers=admin).status_code == 409


def test_admin_edits_a_team_resets_its_code_and_sets_a_captain_photo(
    client, admin, alpha, tmp_path, monkeypatch
):
    monkeypatch.setattr(config, "PHOTOS_DIR", tmp_path)
    form = {"captain": "Asha Rao", "pin": "new-code-1"}
    files = {"captain_photo": ("c.png", PNG, "image/png")}
    assert client.patch("/api/teams/1", data=form, headers=alpha).status_code == 403

    team = client.patch("/api/teams/1", data=form, files=files, headers=admin).json()
    assert team["captain"] == "Asha Rao" and team["name"] == "Alpha"  # blank fields unchanged
    assert set(team) == {"id", "name", "captain", "color", "captain_photo_url"}
    assert client.get(team["captain_photo_url"]).status_code == 200
    assert client.post("/api/auth/login", json={"team_id": 1, "pin": "a-pin"}).status_code == 401
    assert (
        client.post("/api/auth/login", json={"team_id": 1, "pin": "new-code-1"}).status_code == 200
    )

    assert client.patch("/api/teams/1", data={"name": "Bravo"}, headers=admin).status_code == 409
    assert client.patch("/api/teams/1", data={"pin": "123"}, headers=admin).status_code == 422
    assert client.patch("/api/teams/9", data={"captain": "X"}, headers=admin).status_code == 409


def test_purse_cannot_drop_below_spending(client, admin, alpha):
    client.post("/api/auction/next", headers=admin)
    client.post("/api/auction/bid", json={"amount": 600}, headers=alpha)
    client.post("/api/auction/close", headers=admin)
    assert client.patch("/api/teams/1", data={"purse": "500"}, headers=admin).status_code == 409
    assert client.patch("/api/teams/1", data={"purse": "2000"}, headers=admin).status_code == 200
    assert client.get("/api/me/dashboard", headers=alpha).json()["remaining"] == 1400


def test_admin_edits_a_player_but_not_the_price_on_the_block(client, admin, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PHOTOS_DIR", tmp_path)
    player = client.patch(
        "/api/players/2", data={"sports": "Cricket, Chess", "base_price": "350"}, headers=admin
    ).json()
    assert (player["sports"], player["base_price"], player["name"]) == (
        "Cricket, Chess",
        350,
        "P2",
    )

    client.post("/api/auction/next", headers=admin)  # P1 on the block
    assert (
        client.patch("/api/players/1", data={"base_price": "999"}, headers=admin).status_code == 409
    )
    res = client.patch(
        "/api/players/1",
        data={"name": "P One"},
        files={"photo": ("p.png", PNG, "image/png")},
        headers=admin,
    )
    assert res.status_code == 200 and res.json()["photo_url"].endswith(".webp")


def test_a_rejected_edit_leaves_no_photo_behind(client, admin):
    from sqlmodel import Session, select

    from app.db import get_session
    from app.main import app
    from app.models import Photo

    client.post("/api/auction/next", headers=admin)  # P1 on the block: its price is locked
    res = client.patch(
        "/api/players/1", data={"base_price": "999"},
        files={"photo": ("p.png", PNG, "image/png")}, headers=admin,
    )
    assert res.status_code == 409
    session: Session = next(app.dependency_overrides[get_session]())
    assert session.exec(select(Photo)).all() == []


def test_seeded_photos_are_served_from_the_folder_and_paths_cannot_escape(
    client, tmp_path, monkeypatch
):
    from app import main

    (tmp_path / "players").mkdir()
    (tmp_path / "players" / "a.jpg").write_bytes(b"jpeg")
    (tmp_path.parent / "secret.txt").write_text("secret")
    monkeypatch.setattr(main, "PHOTOS", tmp_path)
    assert client.get("/photos/players/a.jpg").content == b"jpeg"
    for url in ("/photos/../secret.txt", "/photos/%2e%2e/secret.txt", "/photos/players/../../secret.txt"):
        assert b"secret" not in client.get(url).content, url
    assert client.get("/photos/%2e%2e/secret.txt").status_code == 404
