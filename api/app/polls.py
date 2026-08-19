from collections import defaultdict

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.models import Poll, PollOption, Skip, TopicFollow, User, UserFollow, Vote


def guest_votes_used(db: Session, device_id: str) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(Vote)
            .where(Vote.device_id == device_id, Vote.user_id.is_(None))
        )
        or 0
    )


def guest_status(db: Session, device_id: str, signed_in: bool) -> tuple[int, int]:
    used = 0 if signed_in else guest_votes_used(db, device_id)
    remaining = 0 if signed_in else max(0, get_settings().guest_vote_limit - used)
    return used, remaining


def seen_poll_ids(db: Session, key: str) -> set[str]:
    voted = set(db.scalars(select(Vote.poll_id).where(Vote.voter_key == key)))
    skipped = set(db.scalars(select(Skip.poll_id).where(Skip.skipper_key == key)))
    return voted | skipped


def option_counts(db: Session, poll_ids: list[str]) -> dict[str, dict[str, int]]:
    if not poll_ids:
        return {}
    extras = db.execute(
        select(PollOption.poll_id, PollOption.id, PollOption.extra_votes).where(
            PollOption.poll_id.in_(poll_ids)
        )
    ).all()
    out: dict[str, dict[str, int]] = defaultdict(dict)
    for poll_id, option_id, extra in extras:
        out[poll_id][option_id] = int(extra or 0)
    rows = db.execute(
        select(Vote.poll_id, Vote.option_id, func.count())
        .where(Vote.poll_id.in_(poll_ids))
        .group_by(Vote.poll_id, Vote.option_id)
    ).all()
    for poll_id, option_id, count in rows:
        out[poll_id][option_id] = out[poll_id].get(option_id, 0) + int(count)
    return out


def viewer_votes(db: Session, key: str, poll_ids: list[str]) -> dict[str, str]:
    if not poll_ids:
        return {}
    rows = db.execute(
        select(Vote.poll_id, Vote.option_id).where(
            Vote.voter_key == key, Vote.poll_id.in_(poll_ids)
        )
    ).all()
    return {poll_id: option_id for poll_id, option_id in rows}


def serialize_poll(
    poll: Poll,
    *,
    counts: dict[str, int] | None = None,
    viewer_option_id: str | None = None,
    skipped: bool = False,
    following_topic: bool = False,
    following_author: bool = False,
    reveal: bool = False,
) -> dict:
    total = sum(counts.values()) if counts else 0
    options = []
    for option in poll.options:
        raw = counts.get(option.id, 0) if counts else 0
        percent = None
        vote_count = None
        if reveal:
            vote_count = raw
            percent = round((raw / total) * 100) if total else 0
        options.append(
            {
                "id": option.id,
                "label": option.label,
                "image_url": option.image_url,
                "position": option.position,
                "vote_count": vote_count,
                "percent": percent,
            }
        )
    if reveal and options:
        # Keep displayed percents summing to 100 after rounding.
        known = [o["percent"] for o in options if o["percent"] is not None]
        drift = 100 - sum(known) if total else 0
        if drift and options[0]["percent"] is not None:
            winner = max(options, key=lambda o: (o["vote_count"] or 0, -o["position"]))
            winner["percent"] = (winner["percent"] or 0) + drift

    return {
        "id": poll.id,
        "question": poll.question,
        "question_image_url": poll.question_image_url,
        "created_at": poll.created_at,
        "topic": {
            "id": poll.topic.id,
            "slug": poll.topic.slug,
            "name": poll.topic.name,
            "icon": poll.topic.icon,
            "following": following_topic,
        },
        "author": {
            "id": poll.author.id,
            "handle": poll.author.handle,
            "display_name": poll.author.display_name,
            "avatar_url": poll.author.avatar_url,
            "following": following_author,
        },
        "options": options,
        "total_votes": total if reveal else None,
        "viewer_vote_option_id": viewer_option_id,
        "skipped": skipped,
    }


def load_poll(db: Session, poll_id: str) -> Poll | None:
    return db.scalar(
        select(Poll)
        .options(
            selectinload(Poll.options),
            selectinload(Poll.topic),
            selectinload(Poll.author),
        )
        .where(Poll.id == poll_id)
    )


def present_poll(db: Session, poll: Poll, user: User | None, key: str) -> dict:
    counts = option_counts(db, [poll.id]).get(poll.id, {})
    vote = viewer_votes(db, key, [poll.id]).get(poll.id)
    skipped = db.scalar(
        select(Skip.id).where(Skip.poll_id == poll.id, Skip.skipper_key == key)
    )
    following_topic = False
    following_author = False
    if user is not None:
        following_topic = (
            db.scalar(
                select(TopicFollow.id).where(
                    TopicFollow.user_id == user.id, TopicFollow.topic_id == poll.topic_id
                )
            )
            is not None
        )
        following_author = (
            db.scalar(
                select(UserFollow.id).where(
                    UserFollow.follower_id == user.id,
                    UserFollow.followee_id == poll.author_id,
                )
            )
            is not None
        )
    return serialize_poll(
        poll,
        counts=counts,
        viewer_option_id=vote,
        skipped=skipped is not None,
        following_topic=following_topic,
        following_author=following_author,
        reveal=vote is not None,
    )


def next_poll(db: Session, user: User | None, key: str) -> Poll | None:
    seen = seen_poll_ids(db, key)
    query = select(Poll).options(
        selectinload(Poll.options),
        selectinload(Poll.topic),
        selectinload(Poll.author),
    )
    if seen:
        query = query.where(Poll.id.notin_(seen))

    followed_topics: set[str] = set()
    followed_people: set[str] = set()
    if user is not None:
        followed_topics = set(
            db.scalars(select(TopicFollow.topic_id).where(TopicFollow.user_id == user.id))
        )
        followed_people = set(
            db.scalars(select(UserFollow.followee_id).where(UserFollow.follower_id == user.id))
        )

    if followed_people or followed_topics:
        clauses = []
        if followed_people:
            clauses.append((Poll.author_id.in_(followed_people), 0))
        if followed_topics:
            clauses.append((Poll.topic_id.in_(followed_topics), 1))
        query = query.order_by(case(*clauses, else_=2), Poll.created_at.desc())
    else:
        query = query.order_by(Poll.created_at.desc())
    return db.scalars(query).first()
