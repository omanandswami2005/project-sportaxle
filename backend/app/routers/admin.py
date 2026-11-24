"""Auctioneer-only setup: add and edit teams and players before or during the event."""

import uuid
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from ..db import get_session
from ..models import Photo, Player, Team
from ..schemas import MAX_RUPEES, BasePriceIn, PlayerOut, TeamIn, TeamOut
from ..security import hash_pin, require_admin
from ..services import auction

router = APIRouter(tags=["admin"], dependencies=[Depends(require_admin)])

PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
PHOTO_MAX_BYTES = 2 * 1024 * 1024
PHOTO_MAX_SIDE = 640
PHOTO_MAX_PIXELS = 25_000_000  # a small file can still declare a huge picture (decompression bomb)


def _save_photo(session: Session, photo: UploadFile) -> str:
    """Validate, shrink and stage the photo in `session`; it is stored by the caller's commit,
    so a rejected edit leaves nothing behind."""
    data = photo.file.read(PHOTO_MAX_BYTES + 1)
    if photo.content_type not in PHOTO_TYPES or len(data) > PHOTO_MAX_BYTES:
        raise HTTPException(422, "Photo must be a JPG, PNG or WebP under 2 MB")
    Image.MAX_IMAGE_PIXELS = PHOTO_MAX_PIXELS
    try:  # decode for real: the declared content type is only the client's word
        image = ImageOps.exif_transpose(Image.open(BytesIO(data), formats=["JPEG", "PNG", "WEBP"]))
        image.thumbnail((PHOTO_MAX_SIDE, PHOTO_MAX_SIDE))
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        out = BytesIO()
        image.save(out, format="WEBP", quality=82, method=6)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError):
        raise HTTPException(422, "That file is not a valid JPG, PNG or WebP image") from None
    name = f"{uuid.uuid4().hex}.webp"  # re-encoded as WebP; never trust the uploaded filename
    session.add(Photo(key=name, data=out.getvalue()))
    return f"/photos/{name}"


def _delete_photo(session: Session, url: str | None) -> None:
    """Remove an uploaded photo. Only photos uploaded here (directly in /photos/) are deleted;
    seeded ones live in sub-folders and are left alone."""
    if url and Path(url).parent == Path("/photos"):
        row = session.get(Photo, Path(url).name)
        if row:
            session.delete(row)
            session.commit()


def _filled(**fields) -> dict:
    """Form fields the admin actually filled in; blank means "leave as it is"."""
    stripped = {k: v.strip() if isinstance(v, str) else v for k, v in fields.items()}
    return {key: value for key, value in stripped.items() if value not in (None, "")}


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
    sports: str = Form("", max_length=120),
    base_price: int = Form(gt=0, le=MAX_RUPEES),
    photo: UploadFile | None = None,
    session: Session = Depends(get_session),
):
    if not name.strip() or not department.strip():
        raise HTTPException(422, "Name and department cannot be blank")
    player = Player(
        name=name.strip(),
        department=department.strip(),
        sports=sports.strip(),
        base_price=base_price,
        photo_url=_save_photo(session, photo) if photo else None,
    )
    session.add(player)
    session.commit()
    session.refresh(player)
    return player


@router.patch("/teams/{team_id}", response_model=TeamOut)
def edit_team(
    team_id: int,
    name: str | None = Form(None, max_length=60),
    captain: str | None = Form(None, max_length=80),
    color: str | None = Form(None, pattern=r"^#[0-9a-fA-F]{6}$"),
    purse: int | None = Form(None, gt=0, le=MAX_RUPEES),  # write-only: the admin can set it, never read it
    pin: str | None = Form(None, max_length=64),  # reset the captain's access code
    captain_photo: UploadFile | None = None,
    session: Session = Depends(get_session),
):
    changes = _filled(name=name, captain=captain, color=color, purse=purse)
    if pin and pin.strip():
        if len(pin.strip()) < 6:
            raise HTTPException(422, "Access code must be at least 6 characters")
        changes["pin_hash"] = hash_pin(pin.strip())
    old = session.get(Team, team_id)
    old_photo = old.captain_photo_url if old else None
    if captain_photo:
        changes["captain_photo_url"] = _save_photo(session, captain_photo)
    try:
        team = auction.update_team(session, team_id, changes)
    except IntegrityError:
        session.rollback()  # drops the staged photo with the failed edit
        raise HTTPException(status.HTTP_409_CONFLICT, "A team with that name already exists") from None
    if captain_photo:
        _delete_photo(session, old_photo)
    return team


@router.patch("/players/{player_id}", response_model=PlayerOut)
def edit_player(
    player_id: int,
    name: str | None = Form(None, max_length=80),
    department: str | None = Form(None, max_length=80),
    sports: str | None = Form(None, max_length=120),
    base_price: int | None = Form(None, gt=0, le=MAX_RUPEES),
    photo: UploadFile | None = None,
    session: Session = Depends(get_session),
):
    changes = _filled(name=name, department=department, sports=sports, base_price=base_price)
    old = session.get(Player, player_id)
    old_photo = old.photo_url if old else None
    if photo:
        changes["photo_url"] = _save_photo(session, photo)
    player = auction.update_player(session, player_id, changes)
    if photo:
        _delete_photo(session, old_photo)
    return player


@router.delete("/players/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_player(player_id: int, session: Session = Depends(get_session)) -> None:
    _delete_photo(session, auction.remove_player(session, player_id))


@router.put("/players/base-price")
def set_base_price(body: BasePriceIn, session: Session = Depends(get_session)) -> dict[str, int]:
    """One base price for every player not yet sold (the player on the block keeps theirs)."""
    return {"updated": auction.set_base_price(session, body.price)}
