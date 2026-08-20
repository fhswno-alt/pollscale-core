from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def make_engine(database_url: str | None = None):
    url = database_url or get_settings().database_url
    if url.startswith("sqlite"):
        raise RuntimeError("Postgres is required. Set DATABASE_URL to a postgresql+psycopg2:// URL.")
    return create_engine(url, future=True, pool_pre_ping=True)


engine = None
SessionLocal = None


def get_engine():
    global engine, SessionLocal
    if engine is None:
        engine = make_engine()
        SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    return engine


def get_session_factory():
    get_engine()
    assert SessionLocal is not None
    return SessionLocal


def get_db() -> Generator[Session, None, None]:
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()
