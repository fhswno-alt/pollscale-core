from datetime import datetime

from pydantic import BaseModel, Field


class TopicOut(BaseModel):
    id: str
    slug: str
    name: str
    icon: str
    following: bool = False

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: str
    handle: str
    display_name: str
    avatar_url: str | None = None
    following: bool = False

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
    options: list[OptionIn] = Field(min_length=2, max_length=4)


class PollCard(BaseModel):
    id: str
    question: str
    question_image_url: str | None = None
    created_at: datetime
    topic: TopicOut
    author: UserOut
    options: list[OptionOut]
    total_votes: int | None = None
    viewer_vote_option_id: str | None = None
    skipped: bool = False

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


class GoogleAuthIn(BaseModel):
    id_token: str


class DevAuthIn(BaseModel):
    display_name: str = "Tester"
    handle: str | None = None


class UploadOut(BaseModel):
    url: str


class MeUpdate(BaseModel):
    handle: str | None = Field(default=None, min_length=2, max_length=32)
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
