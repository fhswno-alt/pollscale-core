from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.config import get_settings
from app.database import Base, get_engine, get_session_factory
from app.observability import capture_exception, init_sentry
from app.routers import admin, auth, follows, polls, uploads
from app.security import assert_production_safe, parse_cors_origins

settings = get_settings()
assert_production_safe(
    pollscale_env=settings.pollscale_env,
    jwt_secret=settings.jwt_secret,
    allow_dev_auth=settings.allow_dev_auth,
    cors_origins=settings.cors_origins,
)
init_sentry()
Path(settings.media_dir).mkdir(parents=True, exist_ok=True)

cors_origins = parse_cors_origins(settings.cors_origins, production=settings.is_production)

app = FastAPI(title="Pollscale", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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
    try:
        db = get_session_factory()()
        try:
            db.execute(text("SELECT 1"))
        finally:
            db.close()
    except Exception as exc:
        capture_exception(exc)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from exc
    return {"status": "ok", "db": "ok"}


@app.post("/debug/sentry")
def debug_sentry() -> dict[str, str]:
    if settings.is_production:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    try:
        raise RuntimeError("sentry-test")
    except RuntimeError as exc:
        capture_exception(exc)
        if not (settings.sentry_dsn or "").strip():
            return {"status": "noop", "reason": "SENTRY_DSN unset"}
        return {"status": "sent", "message": "sentry-test"}


@app.middleware("http")
async def sentry_unhandled(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        capture_exception(exc)
        raise


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
