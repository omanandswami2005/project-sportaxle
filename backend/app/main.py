from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from sqlmodel import Session

from .config import DIST_DIR as DIST
from .config import PHOTOS_DIR as PHOTOS
from .config import ensure_safe, settings
from .db import engine, get_session, init_db
from .models import Photo
from .routers import admin, auction, auth, catalog, matches
from .seed import seed_if_empty
from .services.auction import AuctionError, get_state

ensure_safe(settings)  # at import, so a misconfigured deployment never serves a request


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    with Session(engine) as session:
        get_state(session)  # create the auction row before the first bid can race to do it
    if settings.seed_file:  # deployment: first boot loads the event data, later boots keep it
        with Session(engine) as session:
            seed_if_empty(session, Path(settings.seed_file))
    yield


app = FastAPI(title="Sports Axle API", lifespan=lifespan)

for module in (auth, catalog, admin, auction, matches):
    app.include_router(module.router, prefix="/api")


HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy": (
        "default-src 'self'; img-src 'self' data: blob:; media-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'none'"
    ),
}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    for name, value in HEADERS.items():
        response.headers.setdefault(name, value)
    return response


@app.exception_handler(AuctionError)
def auction_error(_: Request, exc: AuctionError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.get("/photos/{path:path}", include_in_schema=False)
def photo(path: str, session: Session = Depends(get_session)) -> Response:
    """Uploaded photos come from the database; seeded ones (sub-folders) from the photos folder."""
    row = session.get(Photo, path)
    if row:  # names are random, so a browser may keep them for good
        return Response(
            row.data, media_type="image/webp",
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )
    file = (PHOTOS / path).resolve()
    if path and file.is_file() and file.is_relative_to(PHOTOS.resolve()):
        return FileResponse(file, headers={"Cache-Control": "public, max-age=3600"})
    raise HTTPException(404, "Not found")

if DIST.is_dir():  # production: serve the built React app from the same process

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path.split("/")[0] in ("api", "photos"):  # a wrong API URL is a 404, not the web page
            raise HTTPException(404, "Not found")
        file = (DIST / path).resolve()
        if path and file.is_file() and file.is_relative_to(DIST.resolve()):
            return FileResponse(file)
        return FileResponse(DIST / "index.html")
