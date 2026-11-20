"""Build the player list in a seed file from a Microsoft Forms nomination export.

    uv run python -m app.import_players FORM.xlsx --photos DIR [--seed seed.json] [--base-price 500]

Only the `players` list of the seed file is replaced; teams and access codes stay as they are.
Photos: the form's photo links need a company sign-in, so they cannot be used directly. Download
the form's uploaded files (Forms > Responses > "..." > Download all files, or the form's OneDrive
folder), unzip them into DIR. Each file is matched by the file name at the end of the link.
Emails and links are never copied into the seed file.
"""

import argparse
import io
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlparse

import openpyxl
from PIL import Image, ImageOps

MAX_SIDE = 640

# The form's free-text departments, folded to one spelling.
DEPARTMENTS = {
    "devops": "DevOps",
    "dev-ops": "DevOps",
    "db compilation": "DB Compilation",
    "data operations": "Data Operations",
    "f&a": "Accounting & Finance",
    "enterprise sales admin": "Enterprise Sales Administration",
    "enterprise accounts operations": "Enterprise Account Operations",
    "product managment": "Product Management",
    "engineering(marketzone)": "Engineering / MarketZone",
}


def clean_name(raw: str) -> str:
    words = " ".join(raw.split())
    if words.isupper():
        words = words.title()
    return " ".join(w[0].upper() + w[1:] for w in words.split(" "))


def clean_department(raw: str) -> str:
    text = " ".join(raw.split())
    return DEPARTMENTS.get(text.lower(), text)


def clean_sports(raw: str) -> str:
    seen: list[str] = []
    for part in raw.split(";"):
        part = " ".join(part.split())
        if part and part not in seen:
            seen.append(part)
    return ", ".join(seen)


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def index_photos(folder: Path | None) -> dict[str, Path]:
    """Every file under `folder`, keyed by its lower-case name."""
    if folder is None:
        return {}
    return {p.name.lower(): p for p in folder.rglob("*") if p.is_file()}


def save_photo(source: Path, dest: Path) -> None:
    """Resize to at most 640px on the long side and save as JPEG, like the captain photos."""
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((MAX_SIDE, MAX_SIDE))
        buffer = io.BytesIO()
        image.save(buffer, "JPEG", quality=85)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(buffer.getvalue())


def read_players(xlsx: Path) -> list[dict]:
    sheet = openpyxl.load_workbook(xlsx, data_only=True).active
    rows = sheet.iter_rows(values_only=True)
    header = [" ".join(str(h or "").split()) for h in next(rows)]
    col = {
        "name": header.index("Full Name"),
        "department": header.index("Department"),
        "photo": next(i for i, h in enumerate(header) if h.startswith("Profile Photograph")),
        "sports": next(i for i, h in enumerate(header) if h.startswith("Which sports")),
    }
    players = []
    for row in rows:
        if not row[col["name"]]:
            continue
        players.append(
            {
                "name": clean_name(str(row[col["name"]])),
                "department": clean_department(str(row[col["department"]] or "")),
                "sports": clean_sports(str(row[col["sports"]] or "")),
                "_link": str(row[col["photo"]] or ""),
            }
        )
    return players


def build(xlsx: Path, photos: Path | None, out_photos: Path, base_price: int) -> tuple[list[dict], list[str]]:
    found = index_photos(photos)
    players, missing = [], []
    for item in read_players(xlsx):
        link = item.pop("_link")
        file_name = unquote(urlparse(link).path.rsplit("/", 1)[-1]).lower()
        source = found.get(file_name)
        player = {**item, "base_price": base_price}
        if source:
            name = f"{slug(item['name'])}.jpg"
            save_photo(source, out_photos / name)
            player["photo_url"] = f"/photos/players/{name}"
        else:
            missing.append(item["name"])
        players.append(player)
    return players, missing


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("xlsx", type=Path)
    parser.add_argument("--photos", type=Path, help="folder with the downloaded photos")
    parser.add_argument("--seed", type=Path, default=Path("seed.json"))
    parser.add_argument("--base-price", type=int, default=500)
    parser.add_argument("--photo-dir", type=Path, default=Path("photos/players"))
    args = parser.parse_args()

    data = json.loads(args.seed.read_text())
    data["players"], missing = build(args.xlsx, args.photos, args.photo_dir, args.base_price)
    args.seed.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(data['players'])} players written to {args.seed}")
    print(f"{len(data['players']) - len(missing)} with a photo, {len(missing)} without (initials)")
    if missing:
        print("No photo for: " + ", ".join(missing))


if __name__ == "__main__":
    main()
