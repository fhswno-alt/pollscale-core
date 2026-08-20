from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import Base, get_engine, get_session_factory
from app.routers import admin, auth, follows, polls, uploads

settings = get_settings()
Path(settings.media_dir).mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Pollscale", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(polls.router)
app.include_router(follows.router)
app.include_router(uploads.router)
app.include_router(admin.router)
app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=get_engine())
    db = get_session_factory()()
    try:
        from app.admin_auth import bootstrap_admin_user

        bootstrap_admin_user(db)
        if settings.auto_seed:
            from scripts.seed import seed

            seed(db)
    finally:
        db.close()
    if settings.pollscale_env.lower() != "test":
        from app.analytics_jobs import start_scheduler

        start_scheduler()
