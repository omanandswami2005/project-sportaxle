"""Remove EVERYTHING: teams, captains, access codes, players, photos, bids, results, fixtures,
login history and settings. The tables are dropped and rebuilt empty.

    uv run python -m app.wipe --yes

Uses DATABASE_URL (local SQLite when unset). There is no undo.
"""

import sys

from sqlalchemy.engine import make_url
from sqlmodel import SQLModel

from . import models  # noqa: F401  (registers the tables)
from .db import engine


def main() -> None:
    target = make_url(str(engine.url)).render_as_string(hide_password=True)
    if "--yes" not in sys.argv[1:]:
        sys.exit(f"This deletes ALL data in {target}.\nRun again with --yes to confirm.")
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    print(f"All data removed from {target}")


if __name__ == "__main__":
    main()
