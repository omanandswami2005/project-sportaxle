from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .db import init_db
from .routers import auction, auth, catalog, matches
from .services.auction import AuctionError

ROOT = Path(__file__).resolve().parents[2]
PHOTOS = ROOT / "backend" / "photos"
DIST = ROOT / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Sports Axle API", lifespan=lifespan)

for module in (auth, catalog, auction, matches):
    app.include_router(module.router, prefix="/api")


@app.exception_handler(AuctionError)
def auction_error(_: Request, exc: AuctionError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": str(exc)})


app.mount("/photos", StaticFiles(directory=PHOTOS, check_dir=False), name="photos")

if DIST.is_dir():  # production: serve the built React app from the same process

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        file = (DIST / path).resolve()
        if path and file.is_file() and file.is_relative_to(DIST):
            return FileResponse(file)
        return FileResponse(DIST / "index.html")
