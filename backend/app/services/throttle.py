"""Slow down access-code guessing. Failures live in the database, so the limit holds even when
the API runs as several processes. It is a cooldown, not a lock-out: after WINDOW seconds guesses
are accepted again. Each person (IP) gets MAX_FAILURES per target; all people together get
MAX_FAILURES_ANY per target, so guessing from many addresses is slowed too, while one person
mistyping cannot lock a captain out for everyone else."""

import time

from sqlalchemy import delete, func
from sqlmodel import Session, select

from ..models import LoginFailure

MAX_FAILURES = 10
MAX_FAILURES_ANY = 60
WINDOW = 300  # seconds


class TooManyAttempts(Exception):
    pass


def _now() -> float:
    return time.time()


def _count(session: Session, *where) -> int:
    query = select(func.count()).select_from(LoginFailure).where(
        LoginFailure.at > _now() - WINDOW, *where
    )
    return session.exec(query).one()


def check(session: Session, target: str, ip: str) -> None:
    if _count(session, LoginFailure.target == target) >= MAX_FAILURES_ANY or _count(
        session, LoginFailure.target == target, LoginFailure.ip == ip
    ) >= MAX_FAILURES:
        raise TooManyAttempts


def record_failure(session: Session, target: str, ip: str) -> None:
    session.exec(delete(LoginFailure).where(LoginFailure.at < _now() - WINDOW))
    session.add(LoginFailure(target=target, ip=ip, at=_now()))
    session.commit()
