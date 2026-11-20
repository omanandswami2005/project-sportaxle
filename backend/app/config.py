"""Runtime settings, read once from the environment."""

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PHOTOS_DIR = ROOT / "backend" / "photos"  # uploaded player photos, served at /photos
DIST_DIR = ROOT / "frontend" / "dist"  # built React app


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///sportsaxle.db")
    secret_key: str = os.getenv("SECRET_KEY", "dev-only-secret-change-me-in-prod")
    admin_pin: str = os.getenv("ADMIN_PIN", "admin-1234")
    bid_increment: int = int(os.getenv("BID_INCREMENT", "100"))
    bid_seconds: int = int(os.getenv("BID_SECONDS", "30"))  # countdown, restarted by every bid
    seed_file: str | None = os.getenv("SEED_FILE")  # loaded on startup into an empty database
    token_hours: int = 12


settings = Settings()

DEV_SECRET = Settings.secret_key
DEV_PIN = Settings.admin_pin


def ensure_safe(s: Settings) -> None:
    """Refuse to run a real deployment (anything but a local SQLite file) on the public
    development secrets: with them anyone can mint an admin token."""
    if s.database_url.startswith("sqlite") and not os.getenv("VERCEL"):
        return
    if s.secret_key == DEV_SECRET or len(s.secret_key) < 32:
        raise RuntimeError("Set SECRET_KEY to a random string of at least 32 characters")
    if s.admin_pin == DEV_PIN or len(s.admin_pin) < 8:
        raise RuntimeError("Set ADMIN_PIN to your own access code (at least 8 characters)")
