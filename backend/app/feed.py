"""Load a fresh event into an EMPTY database from the raw exports.

    uv run python -m app.feed --captains captains.zip --form FORM.xlsx --players-zip Question.zip \
        [--purse 10000] [--base-price 500] [--squad-limit N] [--codes captain-codes.csv]

- captains.zip: one photo per captain, named `<anything>_<Captain Name>.<ext>`. Each captain gets
  a team ("Team <first name>"), a colour and a random access code.
- FORM.xlsx + players zip: the Forms nomination export and its uploaded photos (as import_players).
Photos are stored in the database (the `photo` table), so a read-only host can serve them.
The access codes are written to --codes (a CSV, kept out of git); they are shown only there.
Wipe first (`python -m app.wipe --yes`) if the database already has data.
"""

import argparse
import csv
import io
import secrets
import sys
import tempfile
import zipfile
from pathlib import Path

from PIL import Image, ImageOps
from sqlmodel import Session, SQLModel, select

from .db import engine
from .import_players import MAX_SIDE, clean_name, slug
from .models import EventSetting, Photo, Player, Team
from .security import hash_pin

COLORS = ["#00A0DC", "#221F20", "#E4572E", "#2E8B57", "#7B2CBF", "#F4A300", "#C2185B", "#0077A8",
          "#5D6D7E", "#00897B", "#8D6E63", "#3F51B5", "#6D9F00", "#D81B60", "#455A64", "#FF7043"]
IMAGES = {".jpg", ".jpeg", ".png", ".webp"}
PIN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no look-alikes (l, 1, o, 0, i)


def webp(source: Path) -> bytes:
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        image.thumbnail((MAX_SIDE, MAX_SIDE))
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        out = io.BytesIO()
        image.save(out, format="WEBP", quality=82, method=6)
    return out.getvalue()


def new_code() -> str:
    return "".join(secrets.choice(PIN_ALPHABET) for _ in range(8))


def feed(session: Session, captains: Path, form: Path, players_dir: Path, purse: int,
         base_price: int, squad_limit: int | None) -> tuple[list[tuple[str, str, str]], list[str]]:
    from .import_players import build  # reuse the cleaning rules

    if session.exec(select(Team)).first() or session.exec(select(Player)).first():
        raise SystemExit("The database already has data. Run `python -m app.wipe --yes` first.")

    codes: list[tuple[str, str, str]] = []
    files = sorted(p for p in captains.rglob("*") if p.suffix.lower() in IMAGES)
    for i, file in enumerate(files):
        captain = clean_name(file.stem.rsplit("_", 1)[-1])
        key = f"captains/{slug(captain)}.webp"
        code = new_code()
        session.add(Photo(key=key, data=webp(file)))
        session.add(Team(name=f"Team {captain.split()[0]}", captain=captain,
                         color=COLORS[i % len(COLORS)], purse=purse, pin_hash=hash_pin(code),
                         captain_photo_url=f"/photos/{key}"))
        codes.append((f"Team {captain.split()[0]}", captain, code))

    with tempfile.TemporaryDirectory() as tmp:
        players, missing = build(form, players_dir, Path(tmp), base_price)
        for player in players:
            if player.get("photo_url"):  # build() wrote players/<slug>.jpg; store it as WebP
                name = Path(player["photo_url"]).stem
                player["photo_url"] = f"/photos/players/{name}.webp"
                session.add(Photo(key=f"players/{name}.webp", data=webp(Path(tmp) / f"{name}.jpg")))
            session.add(Player(**player))
    if squad_limit:
        session.add(EventSetting(id=1, squad_limit=squad_limit))
    session.commit()
    return codes, missing


def unzip(path: Path, into: Path) -> Path:
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():  # never trust names inside an archive
            target = (into / info.filename).resolve()
            if into.resolve() in target.parents and not info.is_dir():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(z.read(info))
    return into


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--captains", type=Path, required=True, help="captains.zip")
    p.add_argument("--form", type=Path, required=True, help="nomination form .xlsx")
    p.add_argument("--players-zip", type=Path, required=True, help="the form's photo zip")
    p.add_argument("--purse", type=int, default=10000)
    p.add_argument("--base-price", type=int, default=500)
    p.add_argument("--squad-limit", type=int)
    p.add_argument("--codes", type=Path, default=Path("captain-codes.csv"))
    a = p.parse_args()

    SQLModel.metadata.create_all(engine)
    with tempfile.TemporaryDirectory() as tmp, Session(engine) as session:
        cap_dir = unzip(a.captains, Path(tmp) / "captains")
        ply_dir = unzip(a.players_zip, Path(tmp) / "players")
        codes, missing = feed(session, cap_dir, a.form, ply_dir, a.purse, a.base_price, a.squad_limit)
    with a.codes.open("w", newline="") as f:
        csv.writer(f).writerows([("team", "captain", "access code"), *codes])
    a.codes.chmod(0o600)
    count = len(Session(engine).exec(select(Player)).all())
    print(f"{len(codes)} teams, {count} players loaded; codes in {a.codes} (keep private)")
    if missing:
        print("No photo for: " + ", ".join(missing), file=sys.stderr)


if __name__ == "__main__":
    main()
