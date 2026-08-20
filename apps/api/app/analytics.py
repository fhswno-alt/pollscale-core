"""Analytics registry: PostHog + Slack.

Add a server event by inserting one name in SERVER_EVENTS, then call track(...).
Instant Slack names live in SLACK_INSTANT. See docs/analytics.md.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from app.config import get_settings
from app.models import User

log = logging.getLogger("pollscale.analytics")

EMAIL_RE = re.compile(r"\S+@\S+\.\S+")

SERVER_EVENTS = frozenset(
    {
        "user_signed_up",
        "poll_created",
        "poll_voted",
        "poll_skipped",
        "poll_reported",
        "poll_flagged",
        "poll_deleted",
        "account_deleted",
        "user_onboarded",
    }
)

SLACK_INSTANT = frozenset(
    {
        "user_signed_up",
        "poll_reported",
        "poll_flagged",
        "account_deleted",
    }
)

FUNNEL_EVENTS = (
    "onboarding_started",
    "onboarding_name",
    "onboarding_username",
    "onboarding_dob",
    "onboarding_city",
    "onboarding_interests",
    "onboarding_completed",
    "first_vote",
)

PROVIDER_LABEL = {
    "apple": "Apple",
    "google": "Google",
    "dev": "Dev",
}

DIGEST_NEW_LABEL = {
    "day": "today",
    "week": "this week",
    "month": "this month",
    "quarter": "this quarter",
}


def provider_label(provider: str | None) -> str:
    if not provider:
        return "unknown"
    return PROVIDER_LABEL.get(provider.lower(), provider)


def first_name_of(user: User | None, fallback: str | None = None) -> str:
    if user and user.first_name:
        return user.first_name.strip()
    if user and user.display_name:
        return user.display_name.strip().split()[0]
    if fallback:
        return fallback.strip().split()[0]
    return "Someone"


def slack_safe(text: str) -> str:
    return EMAIL_RE.sub("[redacted]", text)


def digest_body(total: int, new: int, kind: str) -> str:
    label = DIGEST_NEW_LABEL.get(kind, kind)
    return f"{total} users total, plus {new} {label}."


def slack_text(event: str, properties: dict[str, Any]) -> str:
    name = properties.get("first_name") or "Someone"
    provider = properties.get("provider_label") or provider_label(properties.get("provider"))
    city = properties.get("city")
    if event == "user_signed_up":
        if city:
            return slack_safe(f"{name} signed up with {provider} in {city}.")
        return slack_safe(f"{name} signed up with {provider}.")
    if event == "poll_reported":
        return slack_safe(f"{name} reported a poll ({properties.get('reason', 'report')}).")
    if event == "poll_flagged":
        return slack_safe(f"AI flagged a poll from {name}. It is pending review.")
    if event == "account_deleted":
        if city:
            return slack_safe(f"{name} deleted their account ({provider}, {city}).")
        return slack_safe(f"{name} deleted their account ({provider}).")
    return slack_safe(event)


def _posthog_client():
    settings = get_settings()
    key = (settings.posthog_project_api_key or "").strip()
    if not key:
        return None
    from posthog import Posthog

    host = (settings.posthog_host or "").strip() or "http://localhost:8010"
    return Posthog(key, host=host)


def capture_posthog(event: str, distinct_id: str, properties: dict[str, Any] | None = None) -> bool:
    client = _posthog_client()
    if client is None:
        log.info("posthog skipped: POSTHOG_PROJECT_API_KEY unset")
        return False
    payload = {k: v for k, v in (properties or {}).items() if k != "email" and v is not None}
    try:
        client.capture(distinct_id=distinct_id, event=event, properties=payload)
        return True
    except Exception as exc:
        log.warning("posthog capture failed: %s", exc)
        return False


def identify_posthog(user: User) -> None:
    client = _posthog_client()
    if client is None:
        return
    try:
        client.identify(
            user.id,
            properties={
                "first_name": first_name_of(user),
                "provider": provider_label(user.provider),
                "city": user.city,
                "handle": user.handle,
            },
        )
    except Exception as exc:
        log.warning("posthog identify failed: %s", exc)


def post_slack(text: str) -> bool:
    url = (get_settings().slack_webhook_url or "").strip()
    if not url:
        log.info("slack skipped: SLACK_WEBHOOK_URL unset")
        return False
    body = {"text": slack_safe(text)}
    try:
        httpx.post(url, json=body, timeout=8.0)
        return True
    except Exception as exc:
        log.warning("slack webhook failed: %s", exc)
        return False


def distinct_id(user: User | None, device_id: str | None = None) -> str:
    if user is not None:
        return user.id
    if device_id:
        return f"device:{device_id}"
    return "anonymous"


def track(
    event: str,
    *,
    user: User | None = None,
    device_id: str | None = None,
    properties: dict[str, Any] | None = None,
) -> None:
    if event not in SERVER_EVENTS:
        raise ValueError(f"unknown analytics event: {event}")
    props = dict(properties or {})
    if user is not None:
        props.setdefault("first_name", first_name_of(user))
        props.setdefault("provider", user.provider)
        props.setdefault("provider_label", provider_label(user.provider))
        props.setdefault("city", user.city)
        props.pop("email", None)
        identify_posthog(user)
    capture_posthog(event, distinct_id(user, device_id), props)
    if event in SLACK_INSTANT:
        post_slack(slack_text(event, props))
