import json

import openpyxl
from PIL import Image

from app import import_players

HEADER = [
    "ID", "Email", "Full Name", "Department",
    "Profile Photograph - Upload a clear, recent photograph",
    "Which sports would you like to participate in as a player? (You can select multiple sports.)",
]  # fmt: skip
LINK = "https://example.sharepoint.com/Question/{}"


def make_form(path, rows):
    book = openpyxl.Workbook()
    sheet = book.active
    sheet.append(HEADER)
    for row in rows:
        sheet.append(row)
    book.save(path)


def test_import_cleans_rows_and_matches_photos(tmp_path):
    form = tmp_path / "form.xlsx"
    make_form(
        form,
        [
            [1, "a@x.com", "karan  bhavsar ", "Dev-Ops", LINK.format("IMG%201_Karan.png"), "Carrom;Chess;Carrom;"],
            [2, "b@x.com", "AMIT TIWARY", "Engineering", LINK.format("missing.jpg"), "Cricket;"],
        ],
    )  # fmt: skip
    photos = tmp_path / "downloads"
    photos.mkdir()
    Image.new("RGB", (2000, 1000), "red").save(photos / "IMG 1_Karan.png")

    players, missing = import_players.build(form, photos, tmp_path / "out", base_price=300)

    assert players[0] == {
        "name": "Karan Bhavsar",
        "department": "DevOps",
        "sports": "Carrom, Chess",
        "base_price": 300,
        "photo_url": "/photos/players/karan-bhavsar.jpg",
    }
    assert players[1]["name"] == "Amit Tiwary" and "photo_url" not in players[1]
    assert missing == ["Amit Tiwary"]
    assert max(Image.open(tmp_path / "out" / "karan-bhavsar.jpg").size) == 640
    assert "@" not in json.dumps(players)  # emails never leave the spreadsheet
