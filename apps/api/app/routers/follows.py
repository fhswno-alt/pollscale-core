from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.deps import DbDep, OptionalUser, UserDep
from app.models import Topic, TopicFollow, User, UserBlock, UserFollow
from app.notifications import notify
from app.schemas import TopicOut, UserOut

router = APIRouter(tags=["follows"])


@router.get("/topics", response_model=list[TopicOut])
def list_topics(db: DbDep, user: OptionalUser) -> list[TopicOut]:
    topics = list(db.scalars(select(Topic).order_by(Topic.name)))
    followed: set[str] = set()
    if user is not None:
        followed = set(
            db.scalars(select(TopicFollow.topic_id).where(TopicFollow.user_id == user.id))
        )
    return [
        TopicOut(
            id=topic.id,
            slug=topic.slug,
            name=topic.name,
            icon=topic.icon,
            following=topic.id in followed,
        )
        for topic in topics
    ]


@router.post("/topics/{topic_id}/follow", response_model=TopicOut)
def follow_topic(topic_id: str, db: DbDep, user: UserDep) -> TopicOut:
    topic = db.get(Topic, topic_id)
    if topic is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="topic_not_found")
    db.add(TopicFollow(user_id=user.id, topic_id=topic.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return TopicOut(
        id=topic.id, slug=topic.slug, name=topic.name, icon=topic.icon, following=True
    )


@router.delete("/topics/{topic_id}/follow", response_model=TopicOut)
def unfollow_topic(topic_id: str, db: DbDep, user: UserDep) -> TopicOut:
    topic = db.get(Topic, topic_id)
    if topic is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="topic_not_found")
    row = db.scalar(
        select(TopicFollow).where(
            TopicFollow.user_id == user.id, TopicFollow.topic_id == topic.id
        )
    )
    if row:
        db.delete(row)
        db.commit()
    return TopicOut(
        id=topic.id, slug=topic.slug, name=topic.name, icon=topic.icon, following=False
    )


@router.get("/users", response_model=list[UserOut])
def list_users(db: DbDep, user: OptionalUser) -> list[UserOut]:
    people = list(
        db.scalars(select(User).where(User.deleted_at.is_(None)).order_by(User.display_name).limit(50))
    )
    followed: set[str] = set()
    if user is not None:
        followed = set(
            db.scalars(select(UserFollow.followee_id).where(UserFollow.follower_id == user.id))
        )
    return [
        UserOut(
            id=person.id,
            handle=person.handle,
            display_name=person.display_name,
            avatar_url=person.avatar_url,
            following=person.id in followed,
        )
        for person in people
        if user is None or person.id != user.id
    ]


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: str, db: DbDep, user: OptionalUser) -> UserOut:
    person = db.get(User, user_id)
    if person is None or person.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_not_found")
    following = False
    if user is not None:
        following = (
            db.scalar(
                select(func.count())
                .select_from(UserFollow)
                .where(UserFollow.follower_id == user.id, UserFollow.followee_id == person.id)
            )
            or 0
        ) > 0
    return UserOut(
        id=person.id,
        handle=person.handle,
        display_name=person.display_name,
        avatar_url=person.avatar_url,
        following=following,
    )


@router.post("/users/{user_id}/follow", response_model=UserOut)
def follow_user(user_id: str, db: DbDep, user: UserDep) -> UserOut:
    if user_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="cannot_follow_self")
    person = db.get(User, user_id)
    if person is None or person.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_not_found")
    db.add(UserFollow(follower_id=user.id, followee_id=person.id))
    try:
        db.commit()
        notify(db, person.id, "user_followed", {"actor_handle": user.handle, "actor_id": user.id})
        db.commit()
    except IntegrityError:
        db.rollback()
    return UserOut(
        id=person.id,
        handle=person.handle,
        display_name=person.display_name,
        avatar_url=person.avatar_url,
        following=True,
    )


@router.delete("/users/{user_id}/follow", response_model=UserOut)
def unfollow_user(user_id: str, db: DbDep, user: UserDep) -> UserOut:
    person = db.get(User, user_id)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_not_found")
    row = db.scalar(
        select(UserFollow).where(
            UserFollow.follower_id == user.id, UserFollow.followee_id == person.id
        )
    )
    if row:
        db.delete(row)
        db.commit()
    return UserOut(
        id=person.id,
        handle=person.handle,
        display_name=person.display_name,
        avatar_url=person.avatar_url,
        following=False,
    )


@router.post("/users/{user_id}/block", response_model=UserOut)
def block_user(user_id: str, db: DbDep, user: UserDep) -> UserOut:
    if user_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="cannot_block_self")
    person = db.get(User, user_id)
    if person is None or person.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_not_found")
    follow = db.scalar(
        select(UserFollow).where(
            UserFollow.follower_id == user.id, UserFollow.followee_id == person.id
        )
    )
    if follow:
        db.delete(follow)
    db.add(UserBlock(blocker_id=user.id, blocked_id=person.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return UserOut(
        id=person.id,
        handle=person.handle,
        display_name=person.display_name,
        avatar_url=person.avatar_url,
        following=False,
    )
