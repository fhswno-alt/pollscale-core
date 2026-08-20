"""For You ranking. See docs/ranking.md."""

from __future__ import annotations

import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Poll,
    PollDwell,
    PollFeedback,
    PollImpression,
    Skip,
    Topic,
    TopicFollow,
    User,
    UserBlock,
    UserFollow,
    UserInterest,
    Vote,
)
from app.taxonomy import parent_id_of


def _seen_poll_ids(db: Session, key: str) -> set[str]:
    voted = set(db.scalars(select(Vote.poll_id).where(Vote.voter_key == key)))
    skipped = set(db.scalars(select(Skip.poll_id).where(Skip.skipper_key == key)))
    return voted | skipped

SUPPRESS_DAYS = 14
EXPLORE_RATE = 0.15
VOTE_TOPIC = 8.0
VOTE_CREATOR = 5.0
DWELL_PER_8S = 1.0
DWELL_CAP = 3.0
FOLLOW_PERSON = 2.5
FOLLOW_TOPIC = 2.0
SKIP_TOPIC = -2.0
RELEVANT_TOPIC = 4.0
INTEREST_PARENT = 6.0
INTEREST_CHILD = 8.0
CITY_BOOST = 1.5
MAX_VOTE_TOPIC = 24.0
MAX_VOTE_CREATOR = 15.0


def normalize_place(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(value.strip().lower().split())


def _topic_map(db: Session) -> dict[str, Topic]:
    return {topic.id: topic for topic in db.scalars(select(Topic))}


def _children_of(topics: dict[str, Topic], parent_id: str) -> set[str]:
    return {tid for tid, topic in topics.items() if topic.parent_id == parent_id}


def _family_for_suppress(topic: Topic, topics: dict[str, Topic]) -> set[str]:
    if topic.parent_id:
        return {topic.id}
    return {topic.id} | _children_of(topics, topic.id)


def candidate_query(db: Session, user: User | None, key: str):
    seen = _seen_poll_ids(db, key)
    query = (
        select(Poll)
        .options(
            selectinload(Poll.options),
            selectinload(Poll.topic),
            selectinload(Poll.author),
        )
        .where(Poll.status == "live")
        .where(User.deleted_at.is_(None))
        .join(User, User.id == Poll.author_id)
    )
    if seen:
        query = query.where(Poll.id.notin_(seen))
    if user is not None:
        blocked = select(UserBlock.blocked_id).where(UserBlock.blocker_id == user.id)
        query = query.where(Poll.author_id.notin_(blocked))
        hidden = select(PollFeedback.poll_id).where(
            PollFeedback.user_id == user.id, PollFeedback.kind == "not_interested"
        )
        query = query.where(Poll.id.notin_(hidden))
    return list(db.scalars(query))


def _latest_feedback_by_topic(
    db: Session, user_id: str
) -> dict[str, tuple[str, datetime]]:
    rows = db.execute(
        select(PollFeedback.kind, PollFeedback.created_at, Poll.topic_id)
        .join(Poll, Poll.id == PollFeedback.poll_id)
        .where(PollFeedback.user_id == user_id)
    ).all()
    latest: dict[str, tuple[str, datetime]] = {}
    for kind, created_at, topic_id in rows:
        stamp = created_at
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=timezone.utc)
        prev = latest.get(topic_id)
        if prev is None or stamp > prev[1]:
            latest[topic_id] = (kind, stamp)
    return latest


def suppressed_topic_ids(db: Session, user: User, topics: dict[str, Topic]) -> set[str]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=SUPPRESS_DAYS)
    latest = _latest_feedback_by_topic(db, user.id)
    suppressed: set[str] = set()
    for topic_id, (kind, created_at) in latest.items():
        if kind != "not_interested" or created_at < cutoff:
            continue
        topic = topics.get(topic_id)
        if topic is None:
            continue
        suppressed |= _family_for_suppress(topic, topics)
    return suppressed


def interest_ids(db: Session, user: User) -> set[str]:
    chosen = set(db.scalars(select(UserInterest.topic_id).where(UserInterest.user_id == user.id)))
    latest = _latest_feedback_by_topic(db, user.id)
    for topic_id, (kind, _) in latest.items():
        if kind == "relevant":
            chosen.add(topic_id)
    return chosen


def _counts_by_topic(rows: list[tuple[str, int | None]]) -> dict[str, float]:
    out: dict[str, float] = defaultdict(float)
    for topic_id, value in rows:
        out[topic_id] += float(value or 1)
    return out


def score_poll(
    poll: Poll,
    *,
    user: User,
    topics: dict[str, Topic],
    interests: set[str],
    followed_people: set[str],
    followed_topics: set[str],
    votes_by_topic: dict[str, float],
    votes_by_creator: dict[str, float],
    skips_by_topic: dict[str, float],
    dwell_by_topic: dict[str, float],
    relevant_topics: set[str],
) -> float:
    topic = poll.topic
    parent = parent_id_of(topic)
    score = 0.0
    if topic.id in interests and topic.parent_id:
        score += INTEREST_CHILD
    elif parent in interests or topic.id in interests:
        score += INTEREST_PARENT
    if poll.author_id in followed_people:
        score += FOLLOW_PERSON
    if topic.id in followed_topics or parent in followed_topics:
        score += FOLLOW_TOPIC
    score += min(MAX_VOTE_TOPIC, votes_by_topic.get(topic.id, 0.0) * VOTE_TOPIC)
    score += min(MAX_VOTE_TOPIC, votes_by_topic.get(parent, 0.0) * VOTE_TOPIC * 0.6)
    score += min(MAX_VOTE_CREATOR, votes_by_creator.get(poll.author_id, 0.0) * VOTE_CREATOR)
    dwell = dwell_by_topic.get(topic.id, 0.0) + dwell_by_topic.get(parent, 0.0) * 0.5
    score += min(DWELL_CAP, dwell / 8.0 * DWELL_PER_8S)
    score += skips_by_topic.get(topic.id, 0.0) * SKIP_TOPIC
    score += skips_by_topic.get(parent, 0.0) * SKIP_TOPIC * 0.5
    if topic.id in relevant_topics or parent in relevant_topics:
        score += RELEVANT_TOPIC
    user_city = normalize_place(user.city)
    poll_city = normalize_place(poll.city_tag)
    if user_city and poll_city and (user_city in poll_city or poll_city in user_city):
        score += CITY_BOOST
    return score


def _matches_interest(poll: Poll, interests: set[str]) -> bool:
    topic = poll.topic
    parent = parent_id_of(topic)
    return topic.id in interests or parent in interests


def last_parent_ids(db: Session, user_id: str, limit: int = 2) -> list[str]:
    rows = list(
        db.scalars(
            select(PollImpression.parent_topic_id)
            .where(PollImpression.user_id == user_id)
            .order_by(PollImpression.created_at.desc())
            .limit(limit)
        )
    )
    return list(rows)


def record_impression(db: Session, user: User | None, poll: Poll) -> None:
    if user is None:
        return
    db.add(
        PollImpression(
            user_id=user.id,
            poll_id=poll.id,
            parent_topic_id=parent_id_of(poll.topic),
        )
    )
    db.commit()


def next_poll(db: Session, user: User | None, key: str) -> Poll | None:
    candidates = candidate_query(db, user, key)
    if not candidates:
        return None
    if user is None or user.onboarded_at is None:
        candidates.sort(key=lambda item: item.created_at, reverse=True)
        return candidates[0]

    topics = _topic_map(db)
    suppressed = suppressed_topic_ids(db, user, topics)
    interests = interest_ids(db, user)
    followed_people = set(
        db.scalars(select(UserFollow.followee_id).where(UserFollow.follower_id == user.id))
    )
    followed_topics = set(
        db.scalars(select(TopicFollow.topic_id).where(TopicFollow.user_id == user.id))
    )
    vote_rows = db.execute(
        select(Poll.topic_id, Vote.poll_id)
        .join(Poll, Poll.id == Vote.poll_id)
        .where(Vote.user_id == user.id)
    ).all()
    votes_by_topic = _counts_by_topic([(topic_id, 1) for topic_id, _ in vote_rows])
    creator_rows = db.execute(
        select(Poll.author_id, Vote.poll_id)
        .join(Poll, Poll.id == Vote.poll_id)
        .where(Vote.user_id == user.id)
    ).all()
    votes_by_creator = _counts_by_topic([(author_id, 1) for author_id, _ in creator_rows])
    skip_rows = db.execute(
        select(Poll.topic_id, Skip.poll_id)
        .join(Poll, Poll.id == Skip.poll_id)
        .where(Skip.user_id == user.id)
    ).all()
    skips_by_topic = _counts_by_topic([(topic_id, 1) for topic_id, _ in skip_rows])
    dwell_rows = db.execute(
        select(Poll.topic_id, PollDwell.seconds)
        .join(Poll, Poll.id == PollDwell.poll_id)
        .where(PollDwell.user_id == user.id)
    ).all()
    dwell_by_topic = _counts_by_topic(dwell_rows)
    latest = _latest_feedback_by_topic(db, user.id)
    relevant_topics = {tid for tid, (kind, _) in latest.items() if kind == "relevant"}

    scored: list[tuple[float, Poll]] = []
    explore: list[tuple[float, Poll]] = []
    for poll in candidates:
        topic = poll.topic
        family = _family_for_suppress(topic, topics)
        if family & suppressed:
            continue
        value = score_poll(
            poll,
            user=user,
            topics=topics,
            interests=interests,
            followed_people=followed_people,
            followed_topics=followed_topics,
            votes_by_topic=votes_by_topic,
            votes_by_creator=votes_by_creator,
            skips_by_topic=skips_by_topic,
            dwell_by_topic=dwell_by_topic,
            relevant_topics=relevant_topics,
        )
        if _matches_interest(poll, interests):
            scored.append((value, poll))
        else:
            explore.append((value, poll))

    recent_parents = last_parent_ids(db, user.id, 2)
    locked = len(recent_parents) == 2 and recent_parents[0] == recent_parents[1]

    def allowed(pool: list[tuple[float, Poll]]) -> list[tuple[float, Poll]]:
        if not locked:
            return pool
        filtered = [row for row in pool if parent_id_of(row[1].topic) != recent_parents[0]]
        return filtered or pool

    main = allowed(scored)
    extra = allowed(explore)
    pick: Poll | None = None
    if main and random.random() >= EXPLORE_RATE:
        pick = max(main, key=lambda row: (row[0], row[1].created_at))[1]
    elif extra and (not main or random.random() < EXPLORE_RATE):
        pick = max(extra, key=lambda row: (row[0], row[1].created_at))[1]
    elif main:
        pick = max(main, key=lambda row: (row[0], row[1].created_at))[1]
    if pick is not None:
        record_impression(db, user, pick)
    return pick
