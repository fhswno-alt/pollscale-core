"""Sentry wiring. Missing DSN is a no-op."""

from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings

_log = logging.getLogger("pollscale.observability")
_initialized = False


def init_sentry() -> bool:
    """Initialize Sentry when SENTRY_DSN is set. Never raises."""
    global _initialized
    if _initialized:
        return True
    settings = get_settings()
    dsn = (settings.sentry_dsn or "").strip()
    if not dsn:
        return False
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=dsn,
            environment=settings.pollscale_env,
            release=settings.release,
            traces_sample_rate=0.1 if settings.is_production else 0.0,
            send_default_pii=False,
            integrations=[
                StarletteIntegration(transaction_style="endpoint"),
                FastApiIntegration(transaction_style="endpoint"),
            ],
        )
        _initialized = True
        return True
    except Exception as exc:
        _log.warning("Sentry init skipped: %s", exc)
        return False


def capture_exception(error: BaseException, **hint: Any) -> None:
    if not _initialized:
        return
    try:
        import sentry_sdk

        sentry_sdk.capture_exception(error, **hint)
    except Exception:
        _log.warning("Sentry capture_exception failed", exc_info=True)


def capture_message(message: str, *, level: str = "error") -> None:
    if not _initialized:
        return
    try:
        import sentry_sdk

        sentry_sdk.capture_message(message, level=level)
    except Exception:
        _log.warning("Sentry capture_message failed", exc_info=True)
