"""Idempotent user-count digests at 18:00 Europe/London."""

from __future__ import annotations

import logging
from calendar import monthrange
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics import digest_body, post_slack
from app.database import get_session_factory
from app.models import AnalyticsDigest, User

log = logging.getLogger("pollscale.analytics")
LONDON = ZoneInfo("Europe/London")
_scheduler: BackgroundScheduler | None = None


def period_key(kind: str, when: datetime) -> str:
    local = when.astimezone(LONDON)
    if kind == "day":
        return f"day:{local.date().isoformat()}"
    if kind == "week":
        iso = local.date().isocalendar()
        return f"week:{iso.year}-W{iso.week:02d}"
    if kind == "month":
        return f"month:{local.year:04d}-{local.month:02d}"
    if kind == "quarter":
        quarter = (local.month - 1) // 3 + 1
        return f"quarter:{local.year:04d}-Q{quarter}"
    raise ValueError(kind)


def period_start(kind: str, when: datetime) -> datetime:
    local = when.astimezone(LONDON)
    day = local.date()
    if kind == "day":
        start = datetime.combine(day, time.min, tzinfo=LONDON)
    elif kind == "week":
        start = datetime.combine(day - timedelta(days=day.weekday()), time.min, tzinfo=LONDON)
    elif kind == "month":
        start = datetime.combine(day.replace(day=1), time.min, tzinfo=LONDON)
    elif kind == "quarter":
        month = ((day.month - 1) // 3) * 3 + 1
        start = datetime.combine(day.replace(month=month, day=1), time.min, tzinfo=LONDON)
    else:
        raise ValueError(kind)
    return start


def is_last_day_of_month(day: date) -> bool:
    return day.day == monthrange(day.year, day.month)[1]


def is_last_day_of_quarter(day: date) -> bool:
    return day.month in (3, 6, 9, 12) and is_last_day_of_month(day)


def count_users(db: Session, *, created_from: datetime | None = None, created_to: datetime | None = None) -> int:
    query = select(func.count()).select_from(User).where(User.deleted_at.is_(None), User.provider != "seed")
    if created_from is not None:
        query = query.where(User.created_at >= created_from)
    if created_to is not None:
        query = query.where(User.created_at < created_to)
    return int(db.scalar(query) or 0)


def post_digest(db: Session, kind: str, when: datetime | None = None) -> str | None:
    now = when or datetime.now(LONDON)
    key = period_key(kind, now)
    existing = db.scalar(select(AnalyticsDigest).where(AnalyticsDigest.period_key == key))
    if existing:
        return None
    start = period_start(kind, now)
    end = now.astimezone(LONDON)
    total = count_users(db)
    new = count_users(db, created_from=start, created_to=end)
    body = digest_body(total, new, kind)
    row = AnalyticsDigest(period_key=key, kind=kind, body=body, posted_at=end)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return None
    post_slack(body)
    return body


def run_scheduled_digests(when: datetime | None = None) -> list[str]:
    now = when or datetime.now(LONDON)
    local = now.astimezone(LONDON)
    kinds = ["day"]
    if local.weekday() == 6:
        kinds.append("week")
    if is_last_day_of_month(local.date()):
        kinds.append("month")
    if is_last_day_of_quarter(local.date()):
        kinds.append("quarter")
    posted: list[str] = []
    db = get_session_factory()()
    try:
        for kind in kinds:
            body = post_digest(db, kind, now)
            if body:
                posted.append(body)
    finally:
        db.close()
    return posted


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone=LONDON)
    _scheduler.add_job(
        run_scheduled_digests,
        "cron",
        hour=18,
        minute=0,
        id="user_digests",
        replace_existing=True,
    )
    _scheduler.start()
    log.info("analytics digest scheduler started (18:00 Europe/London)")
