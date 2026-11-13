"""Auctioneer-only setup: add teams and players before or during the event."""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from .. import config
from ..db import get_session
from ..models import Player, Team
from ..schemas import PlayerOut, TeamIn, TeamOut
from ..security import hash_pin, require_admin
from ..services import auction

router = APIRouter(tags=["admin"], dependencies=[Depends(require_admin)])

PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
PHOTO_MAX_BYTES = 2 * 1024 * 1024


def _save_photo(photo: UploadFile) -> str:
    extension = PHOTO_TYPES.get(photo.content_type or "")
    data = photo.file.read(PHOTO_MAX_BYTES + 1)
    if extension is None or len(data) > PHOTO_MAX_BYTES:
        raise HTTPException(422, "Photo must be a JPG, PNG or WebP under 2 MB")
    name = f"{uuid.uuid4().hex}{extension}"  # never trust the uploaded filename
    config.PHOTOS_DIR.mkdir(exist_ok=True)
    (config.PHOTOS_DIR / name).write_bytes(data)
    return f"/photos/{name}"


@router.post("/teams", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def add_team(body: TeamIn, session: Session = Depends(get_session)):
    team = Team(**body.model_dump(exclude={"pin"}), pin_hash=hash_pin(body.pin))
    session.add(team)
    try:
        session.commit()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, "A team with that name already exists") from None
    session.refresh(team)
    return team


@router.post("/players", response_model=PlayerOut, status_code=status.HTTP_201_CREATED)
def add_player(
    name: str = Form(min_length=1, max_length=80),
    department: str = Form(min_length=1, max_length=80),
    details: str = Form("", max_length=120),
    base_price: int = Form(gt=0),
    photo: UploadFile | None = None,
    session: Session = Depends(get_session),
):
    player = Player(
        name=name.strip(),
        department=department.strip(),
        details=details.strip(),
        base_price=base_price,
        photo_url=_save_photo(photo) if photo else None,
    )
    session.add(player)
    session.commit()
    session.refresh(player)
    return player


@router.delete("/players/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_player(player_id: int, session: Session = Depends(get_session)) -> None:
    photo_url = auction.remove_player(session, player_id)
    if photo_url and photo_url.startswith("/photos/"):
        (config.PHOTOS_DIR / Path(photo_url).name).unlink(missing_ok=True)
