from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class TopicOut(BaseModel):
    id: str
    slug: str
    name: str
    icon: str
    parent_id: str | None = None
    following: bool = False

    model_config = {"from_attributes": True}


class TopicNode(BaseModel):
    id: str
    slug: str
    name: str
    icon: str
    parent_id: str | None = None
    children: list["TopicNode"] = Field(default_factory=list)


class UserOut(BaseModel):
    id: str
    handle: str
    handle_set: bool = False
    display_name: str
    first_name: str | None = None
    city: str | None = None
    date_of_birth: date | None = None
    onboarded_at: datetime | None = None
    avatar_url: str | None = None
    following: bool = False
    email: str | None = None
    is_admin: bool = False
    interests: list[TopicOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class OptionIn(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    image_url: str | None = None


class OptionOut(BaseModel):
    id: str
    label: str
    image_url: str | None = None
    position: int
    vote_count: int | None = None
    percent: int | None = None

    model_config = {"from_attributes": True}


class PollCreate(BaseModel):
    question: str = Field(min_length=4, max_length=240)
    topic_id: str
    question_image_url: str | None = None
    city_tag: str | None = Field(default=None, max_length=80)
    options: list[OptionIn] = Field(min_length=2, max_length=4)


class PollCard(BaseModel):
    id: str
    question: str
    question_image_url: str | None = None
    status: str = "live"
    review_message: str | None = None
    created_at: datetime
    topic: TopicOut
    author: UserOut
    options: list[OptionOut]
    total_votes: int | None = None
    viewer_vote_option_id: str | None = None
    skipped: bool = False
    is_author: bool = False

    model_config = {"from_attributes": True}


class FeedOut(BaseModel):
    poll: PollCard | None
    guest_votes_used: int
    guest_votes_remaining: int
    signed_in: bool


class VoteIn(BaseModel):
    option_id: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AppleAuthIn(BaseModel):
    identity_token: str
    full_name: str | None = None
    handle: str | None = None


class GoogleAuthIn(BaseModel):
    id_token: str
    handle: str | None = None


class DevAuthIn(BaseModel):
    display_name: str = "Tester"
    handle: str | None = None
    email: str | None = None


class UploadOut(BaseModel):
    url: str


class MeUpdate(BaseModel):
    handle: str | None = Field(default=None, min_length=2, max_length=32)
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    first_name: str | None = Field(default=None, min_length=1, max_length=40)
    city: str | None = Field(default=None, max_length=80)


class OnboardingIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=40)
    handle: str = Field(min_length=2, max_length=32)
    date_of_birth: date
    city: str | None = Field(default=None, max_length=80)
    topic_ids: list[str] = Field(min_length=1)


class InterestsIn(BaseModel):
    topic_ids: list[str] = Field(min_length=1)


class FeedbackIn(BaseModel):
    kind: Literal["relevant", "not_interested"]


class DwellIn(BaseModel):
    seconds: float = Field(ge=0, le=600)


class ReportIn(BaseModel):
    reason: str = Field(min_length=2, max_length=32)
    detail: str | None = Field(default=None, max_length=400)


class ReportOut(BaseModel):
    id: str
    poll_id: str
    reason: str
    status: str


class PushTokenIn(BaseModel):
    token: str
    platform: str = "unknown"


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    body: str
    payload: dict[str, Any] | None = None
    read_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class QueueItem(BaseModel):
    poll: PollCard
    status: str
    open_reports: int
    moderation: dict[str, Any] | None = None
    reporters: list[dict[str, Any]] = Field(default_factory=list)


class MetricsOut(BaseModel):
    users: int
    polls_live: int
    polls_pending: int
    votes: int
    open_reports: int


class ActivityOut(BaseModel):
    kind: str
    label: str
    created_at: datetime


class AdminLoginIn(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)


class AdminMfaIn(BaseModel):
    token: str
    code: str = Field(min_length=6, max_length=12)


class AdminCreateIn(BaseModel):
    email: str
    password: str = Field(min_length=10, max_length=128)


class AdminOut(BaseModel):
    id: str
    email: str
    totp_enrolled: bool


class AdminLoginOut(BaseModel):
    status: Literal["enroll_mfa", "mfa_required"]
    enrollment_token: str | None = None
    mfa_token: str | None = None
    otpauth_url: str | None = None
    secret: str | None = None
    qr_png_base64: str | None = None


class AdminTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminOut
