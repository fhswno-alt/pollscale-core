from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.deps import AdminDep, DbDep
from app.models import Poll, Report, User, Vote
from app.notifications import notify
from app.polls import load_poll, present_poll
from app.schemas import ActivityOut, MetricsOut, PollCard, QueueItem

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/queue", response_model=list[QueueItem])
def queue(db: DbDep, _admin: AdminDep) -> list[QueueItem]:
    open_reports = (
        select(Report.poll_id, func.count().label("n"))
        .where(Report.status == "open")
        .group_by(Report.poll_id)
        .subquery()
    )
    rows = db.execute(
        select(Poll, func.coalesce(open_reports.c.n, 0))
        .outerjoin(open_reports, open_reports.c.poll_id == Poll.id)
        .options(selectinload(Poll.options), selectinload(Poll.topic), selectinload(Poll.author))
        .where(
            Poll.status != "deleted",
            or_(Poll.status == "pending_review", func.coalesce(open_reports.c.n, 0) > 0),
        )
        .order_by(Poll.created_at.desc())
    ).all()
    items = []
    for poll, count in rows:
        reports = list(
            db.scalars(select(Report).where(Report.poll_id == poll.id, Report.status == "open"))
        )
        reporters = []
        for report in reports:
            person = db.get(User, report.reporter_id) if report.reporter_id else None
            reporters.append(
                {
                    "id": report.id,
                    "reason": report.reason,
                    "detail": report.detail,
                    "reporter_handle": person.handle if person else "guest",
                    "created_at": report.created_at.isoformat(),
                }
            )
        items.append(
            QueueItem(
                poll=PollCard.model_validate(present_poll(db, poll, _admin, f"user:{_admin.id}")),
                status=poll.status,
                open_reports=int(count),
                moderation=poll.moderation,
                reporters=reporters,
            )
        )
    return items


@router.post("/polls/{poll_id}/approve", response_model=PollCard)
def approve(poll_id: str, db: DbDep, admin: AdminDep) -> PollCard:
    poll = load_poll(db, poll_id)
    if poll is None or poll.status == "deleted":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="poll_not_found")
    poll.status = "live"
    for report in list(db.scalars(select(Report).where(Report.poll_id == poll.id, Report.status == "open"))):
        report.status = "resolved"
    notify(db, poll.author_id, "poll_approved", {"poll_id": poll.id})
    db.commit()
    loaded = load_poll(db, poll.id)
    assert loaded is not None
    return PollCard.model_validate(present_poll(db, loaded, admin, f"user:{admin.id}"))


@router.post("/polls/{poll_id}/reject", response_model=PollCard)
def reject(poll_id: str, db: DbDep, admin: AdminDep) -> PollCard:
    poll = load_poll(db, poll_id)
    if poll is None or poll.status == "deleted":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="poll_not_found")
    poll.status = "rejected"
    for report in list(db.scalars(select(Report).where(Report.poll_id == poll.id, Report.status == "open"))):
        report.status = "resolved"
    notify(db, poll.author_id, "poll_rejected", {"poll_id": poll.id})
    db.commit()
    loaded = load_poll(db, poll.id)
    assert loaded is not None
    return PollCard.model_validate(present_poll(db, loaded, admin, f"user:{admin.id}"))


@router.get("/metrics", response_model=MetricsOut)
def metrics(db: DbDep, _admin: AdminDep) -> MetricsOut:
    return MetricsOut(
        users=int(db.scalar(select(func.count()).select_from(User).where(User.deleted_at.is_(None))) or 0),
        polls_live=int(db.scalar(select(func.count()).select_from(Poll).where(Poll.status == "live")) or 0),
        polls_pending=int(
            db.scalar(select(func.count()).select_from(Poll).where(Poll.status == "pending_review")) or 0
        ),
        votes=int(db.scalar(select(func.count()).select_from(Vote)) or 0),
        open_reports=int(
            db.scalar(select(func.count()).select_from(Report).where(Report.status == "open")) or 0
        ),
    )


@router.get("/activity", response_model=list[ActivityOut])
def activity(db: DbDep, _admin: AdminDep) -> list[ActivityOut]:
    items: list[ActivityOut] = []
    for user in db.scalars(select(User).where(User.deleted_at.is_(None)).order_by(User.created_at.desc()).limit(8)):
        items.append(ActivityOut(kind="user", label=f"@{user.handle} joined", created_at=user.created_at))
    for poll in db.scalars(select(Poll).order_by(Poll.created_at.desc()).limit(8)):
        items.append(ActivityOut(kind="poll", label=poll.question, created_at=poll.created_at))
    for vote in db.scalars(select(Vote).order_by(Vote.created_at.desc()).limit(8)):
        items.append(ActivityOut(kind="vote", label="A vote landed", created_at=vote.created_at))
    items.sort(key=lambda row: row.created_at, reverse=True)
    return items[:20]
