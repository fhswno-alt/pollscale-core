from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.admin_auth import (
    AdminAuthError,
    create_admin_token,
    create_admin_user,
    decode_admin_token,
    normalize_email,
    qr_png_base64,
    totp_uri,
    verify_password,
    verify_totp,
)
from app.deps import AdminDep, DbDep
from app.models import AdminUser, Poll, Report, User, Vote
from app.notifications import notify
from app.polls import load_poll, present_poll
from app.schemas import (
    ActivityOut,
    AdminCreateIn,
    AdminLoginIn,
    AdminLoginOut,
    AdminMfaIn,
    AdminOut,
    AdminTokenOut,
    MetricsOut,
    PollCard,
    QueueItem,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _admin_out(admin: AdminUser) -> AdminOut:
    return AdminOut(
        id=admin.id,
        email=admin.email,
        totp_enrolled=admin.totp_confirmed_at is not None,
    )


@router.post("/auth/login", response_model=AdminLoginOut)
def admin_login(body: AdminLoginIn, db: DbDep) -> AdminLoginOut:
    email = normalize_email(body.email)
    admin = db.scalar(select(AdminUser).where(AdminUser.email == email))
    if admin is None or not verify_password(body.password, admin.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")
    if admin.totp_confirmed_at is None:
        if not admin.totp_secret:
            admin.totp_secret = __import__("pyotp").random_base32()
            db.commit()
        url = totp_uri(admin.email, admin.totp_secret)
        return AdminLoginOut(
            status="enroll_mfa",
            enrollment_token=create_admin_token(admin.id, "enroll"),
            otpauth_url=url,
            secret=admin.totp_secret,
            qr_png_base64=qr_png_base64(url),
        )
    return AdminLoginOut(status="mfa_required", mfa_token=create_admin_token(admin.id, "mfa"))


@router.post("/auth/mfa", response_model=AdminTokenOut)
def admin_mfa(body: AdminMfaIn, db: DbDep) -> AdminTokenOut:
    try:
        admin_id, typ = decode_admin_token(body.token, allowed={"enroll", "mfa"})
    except AdminAuthError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_token") from None
    admin = db.get(AdminUser, admin_id)
    if admin is None or not admin.totp_secret:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_token")
    if not verify_totp(admin.totp_secret, body.code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_code")
    if typ == "enroll":
        from datetime import datetime, timezone

        admin.totp_confirmed_at = datetime.now(timezone.utc)
        db.commit()
    return AdminTokenOut(access_token=create_admin_token(admin.id, "access"), admin=_admin_out(admin))


@router.get("/users", response_model=list[AdminOut])
def list_admins(db: DbDep, _admin: AdminDep) -> list[AdminOut]:
    rows = list(db.scalars(select(AdminUser).order_by(AdminUser.created_at)))
    return [_admin_out(row) for row in rows]


@router.post("/users", response_model=AdminOut, status_code=status.HTTP_201_CREATED)
def add_admin(body: AdminCreateIn, db: DbDep, _admin: AdminDep) -> AdminOut:
    email = normalize_email(body.email)
    taken = db.scalar(select(AdminUser).where(AdminUser.email == email))
    if taken:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="admin_exists")
    try:
        created = create_admin_user(db, email, body.password)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="admin_exists") from None
    return _admin_out(created)


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
                poll=PollCard.model_validate(present_poll(db, poll, None, "admin")),
                status=poll.status,
                open_reports=int(count),
                moderation=poll.moderation,
                reporters=reporters,
            )
        )
    return items


@router.post("/polls/{poll_id}/approve", response_model=PollCard)
def approve(poll_id: str, db: DbDep, _admin: AdminDep) -> PollCard:
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
    return PollCard.model_validate(present_poll(db, loaded, None, "admin"))


@router.post("/polls/{poll_id}/reject", response_model=PollCard)
def reject(poll_id: str, db: DbDep, _admin: AdminDep) -> PollCard:
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
    return PollCard.model_validate(present_poll(db, loaded, None, "admin"))


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
