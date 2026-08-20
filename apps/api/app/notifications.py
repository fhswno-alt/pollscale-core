"""Extensible notification registry.

Add a type by inserting one entry in TYPES, then call notify(...).
See docs/notifications.md.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Notification, PushToken

log = logging.getLogger("pollscale.notify")


@dataclass(frozen=True)
class NotificationType:
    type: str
    title: str
    body: Callable[[dict[str, Any]], str]


TYPES: dict[str, NotificationType] = {
    "poll_approved": NotificationType(
        type="poll_approved",
        title="Your poll is live",
        body=lambda p: p.get("body") or "A human looked it over. It’s up.",
    ),
    "poll_voted": NotificationType(
        type="poll_voted",
        title="Someone voted",
        body=lambda p: p.get("body") or "Your poll just got a vote.",
    ),
    "user_followed": NotificationType(
        type="user_followed",
        title="New follower",
        body=lambda p: p.get("body") or f"{p.get('actor_handle', 'Someone')} followed you.",
    ),
    "poll_rejected": NotificationType(
        type="poll_rejected",
        title="We couldn’t publish that",
        body=lambda p: p.get("body") or "It didn’t meet the Community Guidelines.",
    ),
}


def notify(db: Session, user_id: str, type_key: str, payload: dict[str, Any] | None = None) -> Notification:
    spec = TYPES.get(type_key)
    if spec is None:
        raise ValueError(f"unknown notification type: {type_key}")
    payload = payload or {}
    row = Notification(
        user_id=user_id,
        type=spec.type,
        title=spec.title,
        body=spec.body(payload),
        payload=payload,
    )
    db.add(row)
    db.flush()
    _push(db, user_id, row)
    return row


def _push(db: Session, user_id: str, row: Notification) -> None:
    tokens = list(db.scalars(select(PushToken.token).where(PushToken.user_id == user_id)))
    if not tokens:
        return
    messages = [
        {
            "to": token,
            "title": row.title,
            "body": row.body,
            "data": {"type": row.type, "id": row.id, **(row.payload or {})},
            "sound": "default",
        }
        for token in tokens
    ]
    headers = {"Content-Type": "application/json"}
    expo = get_settings().expo_access_token
    if expo:
        headers["Authorization"] = f"Bearer {expo}"
    try:
        httpx.post("https://exp.host/--/api/v2/push/send", json=messages, headers=headers, timeout=8.0)
    except Exception as exc:
        log.warning("expo push failed: %s", exc)
