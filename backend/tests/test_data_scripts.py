"""The wipe and feed scripts: reset an event, then load fresh data from the raw exports."""

import io
import zipfile

import openpyxl
import pytest
from PIL import Image
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app import feed, wipe
from app.models import Photo, Player, Team


@pytest.fixture
def engine(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(wipe, "engine", engine)
    return engine


def test_wipe_needs_confirmation_then_removes_everything(engine, monkeypatch):
    with Session(engine) as s:
        s.add(Team(name="T", captain="C", purse=1, pin_hash="x"))
        s.add(Photo(key="a.webp", data=b"x"))
        s.commit()
    monkeypatch.setattr("sys.argv", ["wipe"])
    with pytest.raises(SystemExit):
        wipe.main()
    with Session(engine) as s:
        assert s.exec(select(Team)).first() is not None  # nothing happened without --yes
    monkeypatch.setattr("sys.argv", ["wipe", "--yes"])
    wipe.main()
    with Session(engine) as s:
        assert s.exec(select(Team)).first() is None and s.exec(select(Photo)).first() is None


def _png() -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (40, 40), "red").save(out, "PNG")
    return out.getvalue()


def test_feed_loads_captains_and_players_with_photos_into_an_empty_database(engine, tmp_path):
    (tmp_path / "caps").mkdir()
    (tmp_path / "caps" / "IMG_1_ASHA RAO.png").write_bytes(_png())
    (tmp_path / "caps" / "IMG_2_ASHA SHAH.png").write_bytes(_png())  # same first name
    book = openpyxl.Workbook()
    sheet = book.active
    sheet.append(["Full Name", "Department", "Profile Photograph", "Which sports"])
    sheet.append(["kiran shah", "QA", "https://x/y/pic_Kiran.png", "Chess;Cricket"])
    sheet.append(["Kiran Shah", "Eng", "https://x/y/pic_Kiran2.png", "Carrom"])  # same full name
    book.save(tmp_path / "form.xlsx")
    (tmp_path / "ply").mkdir()
    (tmp_path / "ply" / "pic_Kiran.png").write_bytes(_png())
    (tmp_path / "ply" / "pic_Kiran2.png").write_bytes(_png())

    with Session(engine) as s:
        codes, missing = feed.feed(s, tmp_path / "caps", tmp_path / "form.xlsx", tmp_path / "ply", 5000, 500, 6)
        assert missing == [] and codes[0][:2] == ("Team Asha", "Asha Rao")
        assert codes[1][:2] == ("Team Asha S.", "Asha Shah")
        teams = s.exec(select(Team).order_by(Team.id)).all()
        assert len(teams) == 2 and teams[0].purse == 5000 and teams[0].pin_hash != codes[0][2]
        assert s.get(Photo, "captains/asha-rao.webp").data[:4] == b"RIFF"
        players = s.exec(select(Player).order_by(Player.id)).all()
        assert [p.photo_url for p in players] == ["/photos/players/kiran-shah.webp", "/photos/players/kiran-shah-2.webp"]
        assert s.get(Photo, "players/kiran-shah.webp") and s.get(Photo, "players/kiran-shah-2.webp")
        with pytest.raises(SystemExit):  # not empty any more: wipe first
            feed.feed(s, tmp_path / "caps", tmp_path / "form.xlsx", tmp_path / "ply", 5000, 500, None)


def test_unzip_ignores_paths_that_escape(tmp_path):
    archive = tmp_path / "a.zip"
    with zipfile.ZipFile(archive, "w") as z:
        z.writestr("ok/a.txt", "1")
        z.writestr("../evil.txt", "2")
    out = tmp_path / "out"
    out.mkdir()
    feed.unzip(archive, out)
    assert (out / "ok" / "a.txt").exists() and not (tmp_path / "evil.txt").exists()
