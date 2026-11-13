from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import DIST_DIR as DIST
from .config import PHOTOS_DIR as PHOTOS
from .db import init_db
from .routers import admin, auction, auth, catalog, matches
from .services.auction import AuctionError


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Sports Axle API", lifespan=lifespan)

for module in (auth, catalog, admin, auction, matches):
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
