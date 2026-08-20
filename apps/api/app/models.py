from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
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
    handle_set: Mapped[bool] = mapped_column(Boolean, default=False)
    display_name: Mapped[str] = mapped_column(String(80))
    first_name: Mapped[str | None] = mapped_column(String(40), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    onboarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    provider: Mapped[str] = mapped_column(String(20), index=True)
    provider_subject: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    polls: Mapped[list["Poll"]] = relationship(back_populates="author")


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    totp_secret: Mapped[str] = mapped_column(String(64))
    totp_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    slug: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(40))
    icon: Mapped[str] = mapped_column(String(16), default="")
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("topics.id"), nullable=True, index=True)


class Poll(Base):
    __tablename__ = "polls"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"), index=True)
    question: Mapped[str] = mapped_column(String(240))
    question_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city_tag: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(24), default="live", index=True)
    moderation: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    author: Mapped[User] = relationship(back_populates="polls")
    topic: Mapped[Topic] = relationship()
    options: Mapped[list["PollOption"]] = relationship(
        back_populates="poll",
        order_by="PollOption.position",
        cascade="all, delete-orphan",
    )
    reports: Mapped[list["Report"]] = relationship(back_populates="poll")


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


class UserBlock(Base):
    __tablename__ = "user_blocks"
    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_user_block"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    blocker_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    blocked_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class UserInterest(Base):
    __tablename__ = "user_interests"
    __table_args__ = (UniqueConstraint("user_id", "topic_id", name="uq_user_interest"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PollFeedback(Base):
    __tablename__ = "poll_feedback"
    __table_args__ = (UniqueConstraint("user_id", "poll_id", name="uq_poll_feedback"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    poll_id: Mapped[str] = mapped_column(ForeignKey("polls.id"), index=True)
    kind: Mapped[str] = mapped_column(String(24), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PollDwell(Base):
    __tablename__ = "poll_dwells"
    __table_args__ = (UniqueConstraint("user_id", "poll_id", name="uq_poll_dwell"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    poll_id: Mapped[str] = mapped_column(ForeignKey("polls.id"), index=True)
    seconds: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PollImpression(Base):
    __tablename__ = "poll_impressions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    poll_id: Mapped[str] = mapped_column(ForeignKey("polls.id"), index=True)
    parent_topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    poll_id: Mapped[str] = mapped_column(ForeignKey("polls.id"), index=True)
    reporter_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    device_id: Mapped[str] = mapped_column(String(64), index=True)
    reason: Mapped[str] = mapped_column(String(32))
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    poll: Mapped[Poll] = relationship(back_populates="reports")
    reporter: Mapped[User | None] = relationship()


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(String(240))
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AnalyticsDigest(Base):
    __tablename__ = "analytics_digests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    period_key: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    kind: Mapped[str] = mapped_column(String(16), index=True)
    body: Mapped[str] = mapped_column(String(240))
    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PushToken(Base):
    __tablename__ = "push_tokens"
    __table_args__ = (UniqueConstraint("user_id", "token", name="uq_push_token"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String(255))
    platform: Mapped[str] = mapped_column(String(16), default="unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
