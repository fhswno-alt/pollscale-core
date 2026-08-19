from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("provider", "provider_subject", name="uq_user_provider"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    handle: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(80))
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    provider: Mapped[str] = mapped_column(String(20), index=True)
    provider_subject: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    polls: Mapped[list["Poll"]] = relationship(back_populates="author")


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    slug: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(40))
    icon: Mapped[str] = mapped_column(String(16), default="")


class Poll(Base):
    __tablename__ = "polls"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"), index=True)
    question: Mapped[str] = mapped_column(String(240))
    question_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    author: Mapped[User] = relationship(back_populates="polls")
    topic: Mapped[Topic] = relationship()
    options: Mapped[list["PollOption"]] = relationship(
        back_populates="poll",
        order_by="PollOption.position",
        cascade="all, delete-orphan",
    )


class PollOption(Base):
    __tablename__ = "poll_options"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    poll_id: Mapped[str] = mapped_column(ForeignKey("polls.id"), index=True)
    label: Mapped[str] = mapped_column(String(80))
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    position: Mapped[int] = mapped_column(Integer)
    extra_votes: Mapped[int] = mapped_column(Integer, default=0)

    poll: Mapped[Poll] = relationship(back_populates="options")


class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = (UniqueConstraint("poll_id", "voter_key", name="uq_vote_once"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    poll_id: Mapped[str] = mapped_column(ForeignKey("polls.id"), index=True)
    option_id: Mapped[str] = mapped_column(ForeignKey("poll_options.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    device_id: Mapped[str] = mapped_column(String(64), index=True)
    voter_key: Mapped[str] = mapped_column(String(80), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Skip(Base):
    __tablename__ = "skips"
    __table_args__ = (UniqueConstraint("poll_id", "skipper_key", name="uq_skip_once"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    poll_id: Mapped[str] = mapped_column(ForeignKey("polls.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    device_id: Mapped[str] = mapped_column(String(64), index=True)
    skipper_key: Mapped[str] = mapped_column(String(80), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class TopicFollow(Base):
    __tablename__ = "topic_follows"
    __table_args__ = (UniqueConstraint("user_id", "topic_id", name="uq_topic_follow"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class UserFollow(Base):
    __tablename__ = "user_follows"
    __table_args__ = (UniqueConstraint("follower_id", "followee_id", name="uq_user_follow"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    follower_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    followee_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
