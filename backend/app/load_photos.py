"""Copy the photos folder into the database, so a read-only host (Vercel) can serve them.

    DATABASE_URL=... uv run python -m app.load_photos

Every file under backend/photos/ becomes a row keyed by its path after /photos/ (for example
players/asha-rao.jpg). Safe to run again: existing keys are replaced.
"""

import mimetypes

from sqlmodel import Session

from .config import PHOTOS_DIR
from .db import engine, init_db
from .models import Photo


def main() -> None:
    init_db()
    count = 0
    with Session(engine) as session:
        for file in sorted(PHOTOS_DIR.rglob("*")):
            if file.is_file() and (mimetypes.guess_type(file.name)[0] or "").startswith("image/"):
                session.merge(Photo(key=file.relative_to(PHOTOS_DIR).as_posix(), data=file.read_bytes()))
                count += 1
        session.commit()
    print(f"{count} photos stored in the database")


if __name__ == "__main__":
    main()
