"""In-memory IP rate limits for auth and vote endpoints."""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

# Documented in docs/run.md and docs/observability.md
AUTH_LIMIT = 20
AUTH_WINDOW_SECONDS = 60
VOTE_LIMIT = 60
VOTE_WINDOW_SECONDS = 60


class SlidingWindow:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    def hit(self, key: str) -> None:
        now = time.monotonic()
        recent = [stamp for stamp in self._hits[key] if now - stamp < self.window]
        if len(recent) >= self.limit:
            self._hits[key] = recent
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                detail="rate_limited",
                headers={"Retry-After": str(self.window)},
            )
        recent.append(now)
        self._hits[key] = recent


auth_window = SlidingWindow(AUTH_LIMIT, AUTH_WINDOW_SECONDS)
vote_window = SlidingWindow(VOTE_LIMIT, VOTE_WINDOW_SECONDS)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def limit_auth(request: Request) -> None:
    auth_window.hit(f"auth:{client_ip(request)}")


def limit_vote(request: Request) -> None:
    vote_window.hit(f"vote:{client_ip(request)}")


def reset_limits() -> None:
    auth_window._hits.clear()
    vote_window._hits.clear()
