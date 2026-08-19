import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("AUTO_SEED", "false")
os.environ.setdefault("ALLOW_DEV_AUTH", "true")
os.environ.setdefault("JWT_SECRET", "test-secret")

from app.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app.database import Base, get_db, make_engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Poll, PollOption, Topic, User  # noqa: E402


@pytest.fixture()
def db_session(tmp_path, monkeypatch):
    monkeypatch.setenv("MEDIA_DIR", str(tmp_path / "media"))
    get_settings.cache_clear()
    engine = make_engine(f"sqlite:///{tmp_path}/test.db")
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)
    session = TestingSession()

    def _override():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = _override
    try:
        yield session
    finally:
        session.close()
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        get_settings.cache_clear()


@pytest.fixture()
def client(db_session):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def poll(db_session):
    author = User(
        handle="seed",
        display_name="Seed",
        provider="seed",
        provider_subject="seed",
    )
    topic = Topic(slug="food", name="Food", icon="food")
    db_session.add_all([author, topic])
    db_session.flush()
    item = Poll(author_id=author.id, topic_id=topic.id, question="Coffee or tea?")
    db_session.add(item)
    db_session.flush()
    a = PollOption(poll_id=item.id, label="Coffee", position=0)
    b = PollOption(poll_id=item.id, label="Tea", position=1)
    db_session.add_all([a, b])
    db_session.commit()
    db_session.refresh(item)
    db_session.refresh(a)
    db_session.refresh(b)
    return {"poll": item, "a": a, "b": b, "author": author, "topic": topic}


def headers(device: str, token: str | None = None) -> dict[str, str]:
    out = {"X-Device-Id": device}
    if token:
        out["Authorization"] = f"Bearer {token}"
    return out
