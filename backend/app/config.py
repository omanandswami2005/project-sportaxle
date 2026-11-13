"""Runtime settings, read once from the environment."""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///sportsaxle.db")
    secret_key: str = os.getenv("SECRET_KEY", "dev-only-secret-change-me-in-prod")
    admin_pin: str = os.getenv("ADMIN_PIN", "admin-1234")
    bid_increment: int = int(os.getenv("BID_INCREMENT", "100"))
    token_hours: int = 12


settings = Settings()
