from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.deps import DbDep, DeviceDep, OptionalUser, UserDep, actor_key
from app.models import Poll, PollDwell, PollFeedback, PollOption, Report, Skip, Topic, Vote
from app.moderation import result_to_dict, score_content
from app.notifications import notify
from app.polls import guest_status, guest_votes_used, load_poll, next_poll, present_poll
from app.schemas import DwellIn, FeedOut, FeedbackIn, PollCard, PollCreate, ReportIn, ReportOut, VoteIn

router = APIRouter(tags=["polls"])

REPORT_REASONS = {"spam", "hate", "terror", "violence", "sexual", "self_harm", "illegal", "other"}


def _feed(db: Session, user, device_id: str, poll: Poll | None) -> FeedOut:
    key = actor_key(user, device_id)
    used, remaining = guest_status(db, device_id, user is not None)
    card = PollCard.model_validate(present_poll(db, poll, user, key)) if poll else None
    return FeedOut(
        poll=card,
        guest_votes_used=used,
        guest_votes_remaining=remaining,
        signed_in=user is not None,
    )


def _visible(poll: Poll, user) -> bool:
    if poll.status == "live":
        return True
    if user is None:
        return False
    return user.id == poll.author_id


@router.get("/feed/next", response_model=FeedOut)
def feed_next(db: DbDep, device_id: DeviceDep, user: OptionalUser) -> FeedOut:
    key = actor_key(user, device_id)
    return _feed(db, user, device_id, next_poll(db, user, key))


@router.get("/polls/{poll_id}", response_model=PollCard)
def get_poll(poll_id: str, db: DbDep, device_id: DeviceDep, user: OptionalUser) -> PollCard:
    poll = load_poll(db, poll_id)
    if poll is None or poll.status == "deleted" or not _visible(poll, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="poll_not_found")
    return PollCard.model_validate(present_poll(db, poll, user, actor_key(user, device_id)))


@router.post("/polls", response_model=PollCard, status_code=status.HTTP_201_CREATED)
def create_poll(body: PollCreate, db: DbDep, user: UserDep, device_id: DeviceDep) -> PollCard:
    if db.get(Topic, body.topic_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="unknown_topic")
    labels = [opt.label.strip() for opt in body.options]
    if any(not label for label in labels):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="empty_option")
    if len(set(label.lower() for label in labels)) != len(labels):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="duplicate_options")

    text = " ".join([body.question, *labels])
    images = [url for url in [body.question_image_url, *[opt.image_url for opt in body.options]] if url]
    try:
        score = score_content(text, images)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    poll_status = "pending_review" if score.flagged else "live"
    poll = Poll(
        author_id=user.id,
        topic_id=body.topic_id,
        question=body.question.strip(),
        question_image_url=body.question_image_url,
        city_tag=(body.city_tag or "").strip() or None,
        status=poll_status,
        moderation=result_to_dict(score),
    )
    db.add(poll)
    db.flush()
    for index, option in enumerate(body.options):
        db.add(
            PollOption(
                poll_id=poll.id,
                label=option.label.strip(),
                image_url=option.image_url,
                position=index,
            )
        )
    db.commit()
    loaded = load_poll(db, poll.id)
    assert loaded is not None
    return PollCard.model_validate(present_poll(db, loaded, user, actor_key(user, device_id)))


@router.delete("/polls/{poll_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_poll(poll_id: str, db: DbDep, user: UserDep) -> None:
    poll = load_poll(db, poll_id)
    if poll is None or poll.status == "deleted":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="poll_not_found")
    if poll.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="not_author")
    poll.status = "deleted"
    db.commit()


@router.post("/polls/{poll_id}/vote", response_model=FeedOut)
def vote_poll(
    poll_id: str,
    body: VoteIn,
    db: DbDep,
    device_id: DeviceDep,
    user: OptionalUser,
) -> FeedOut:
    poll = load_poll(db, poll_id)
    if poll is None or poll.status != "live":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="poll_not_found")

    option = next((item for item in poll.options if item.id == body.option_id), None)
    if option is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid_option")

    key = actor_key(user, device_id)
    if user is None:
        used = guest_votes_used(db, device_id)
        if used >= get_settings().guest_vote_limit:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="guest_quota_exceeded")

    poll_id_value = poll.id
    vote = Vote(
        poll_id=poll_id_value,
        option_id=option.id,
        user_id=user.id if user else None,
        device_id=device_id,
        voter_key=key,
    )
    db.add(vote)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="already_voted") from None

    if poll.author_id and (user is None or user.id != poll.author_id):
        notify(db, poll.author_id, "poll_voted", {"poll_id": poll_id_value})
        db.commit()

    loaded = load_poll(db, poll_id_value)
    assert loaded is not None
    return _feed(db, user, device_id, loaded)


@router.post("/polls/{poll_id}/skip", response_model=FeedOut)
def skip_poll(poll_id: str, db: DbDep, device_id: DeviceDep, user: OptionalUser) -> FeedOut:
    poll = load_poll(db, poll_id)
    if poll is None or poll.status != "live":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="poll_not_found")

    key = actor_key(user, device_id)
    existing_vote = db.scalar(select(Vote.id).where(Vote.poll_id == poll.id, Vote.voter_key == key))
    if existing_vote:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="already_voted")

    skip = Skip(
        poll_id=poll.id,
        user_id=user.id if user else None,
        device_id=device_id,
        skipper_key=key,
    )
    db.add(skip)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()

    return _feed(db, user, device_id, next_poll(db, user, key))


@router.post("/polls/{poll_id}/feedback")
def poll_feedback(
    poll_id: str,
    body: FeedbackIn,
    db: DbDep,
    user: UserDep,
) -> dict[str, str]:
    poll = load_poll(db, poll_id)
    if poll is None or poll.status == "deleted":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="poll_not_found")
    existing = db.scalar(
        select(PollFeedback).where(PollFeedback.user_id == user.id, PollFeedback.poll_id == poll.id)
    )
    now = datetime.now(timezone.utc)
    if existing:
        existing.kind = body.kind
        existing.created_at = now
    else:
        db.add(PollFeedback(user_id=user.id, poll_id=poll.id, kind=body.kind, created_at=now))
    db.commit()
    return {"status": "ok", "kind": body.kind}


@router.post("/polls/{poll_id}/dwell")
def poll_dwell(poll_id: str, body: DwellIn, db: DbDep, user: UserDep) -> dict[str, str]:
    poll = load_poll(db, poll_id)
    if poll is None or poll.status == "deleted":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="poll_not_found")
    existing = db.scalar(
        select(PollDwell).where(PollDwell.user_id == user.id, PollDwell.poll_id == poll.id)
    )
    if existing:
        existing.seconds = float(existing.seconds or 0) + body.seconds
    else:
        db.add(PollDwell(user_id=user.id, poll_id=poll.id, seconds=body.seconds))
    db.commit()
    return {"status": "ok"}


@router.post("/polls/{poll_id}/report", response_model=ReportOut)
def report_poll(
    poll_id: str,
    body: ReportIn,
    db: DbDep,
    device_id: DeviceDep,
    user: OptionalUser,
) -> ReportOut:
    if body.reason not in REPORT_REASONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid_reason")
    poll = load_poll(db, poll_id)
    if poll is None or poll.status == "deleted":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="poll_not_found")
    report = Report(
        poll_id=poll.id,
        reporter_id=user.id if user else None,
        device_id=device_id,
        reason=body.reason,
        detail=body.detail,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return ReportOut(id=report.id, poll_id=report.poll_id, reason=report.reason, status=report.status)


@router.get("/me/polls", response_model=list[PollCard])
def my_polls(db: DbDep, user: UserDep, device_id: DeviceDep) -> list[PollCard]:
    rows = list(
        db.scalars(
            select(Poll)
            .where(Poll.author_id == user.id, Poll.status != "deleted")
            .order_by(Poll.created_at.desc())
        )
    )
    out = []
    for poll in rows:
        loaded = load_poll(db, poll.id)
        if loaded:
            out.append(PollCard.model_validate(present_poll(db, loaded, user, actor_key(user, device_id))))
    return out
