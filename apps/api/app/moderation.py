"""OpenAI omni-moderation plus a fail-closed local fallback."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import httpx

from app.config import get_settings
from app.handles import is_blocked_term

log = logging.getLogger("pollscale.moderation")

# Local lexicon so tests and keyless-dev never silently publish obvious abuse.
LOCAL_FLAGS = (
    "kill myself",
    "kys",
    "suicide",
    "self harm",
    "self-harm",
    "cut myself",
    "child porn",
    "child sexual",
    "csam",
    "nude minor",
    "rape a",
    "behead",
    "how to make a bomb",
)

HARD_CATEGORIES = {
    "sexual",
    "sexual/minors",
    "self-harm",
    "self-harm/intent",
    "self-harm/instruction",
}


@dataclass
class ModerationResult:
    flagged: bool
    scored: bool
    categories: dict[str, bool] = field(default_factory=dict)
    scores: dict[str, float] = field(default_factory=dict)
    source: str = "none"
    reason: str = ""

    @property
    def hard_block(self) -> bool:
        return any(self.categories.get(name) for name in HARD_CATEGORIES)


def _local_score(text: str) -> ModerationResult:
    blob = text.lower()
    hits = [term for term in LOCAL_FLAGS if term in blob]
    if is_blocked_term(blob):
        hits.append("blocklist")
    flagged = bool(hits)
    categories = {}
    if any(term in blob for term in ("suicide", "self harm", "self-harm", "kys", "kill myself", "cut myself")):
        categories["self-harm"] = True
    if any(term in blob for term in ("child porn", "child sexual", "csam", "nude minor")):
        categories["sexual/minors"] = True
    if "rape" in blob or "nude" in blob:
        categories["sexual"] = True
    return ModerationResult(
        flagged=flagged,
        scored=True,
        categories=categories,
        scores={name: 1.0 for name in categories},
        source="local",
        reason=", ".join(hits) if hits else "",
    )


def _openai_score(text: str, image_urls: list[str]) -> ModerationResult | None:
    settings = get_settings()
    if not settings.openai_api_key:
        return None
    payload_input: list[dict] = [{"type": "text", "text": text}]
    for url in image_urls:
        payload_input.append({"type": "image_url", "image_url": {"url": url}})
    response = httpx.post(
        "https://api.openai.com/v1/moderations",
        headers={"Authorization": f"Bearer {settings.openai_api_key}"},
        json={"model": "omni-moderation-latest", "input": payload_input},
        timeout=20.0,
    )
    response.raise_for_status()
    result = response.json()["results"][0]
    categories = {key: bool(value) for key, value in (result.get("categories") or {}).items()}
    scores = {key: float(value) for key, value in (result.get("category_scores") or {}).items()}
    return ModerationResult(
        flagged=bool(result.get("flagged")),
        scored=True,
        categories=categories,
        scores=scores,
        source="openai",
    )


def score_content(text: str, image_urls: list[str] | None = None) -> ModerationResult:
    """Score poll text (and images when the API can see them).

    Production without OPENAI_API_KEY fails closed (raises).
    Local/dev without a key logs and returns flagged=True so the poll is queued.
    """
    settings = get_settings()
    images = [url for url in (image_urls or []) if url]
    local = _local_score(text)

    try:
        remote = _openai_score(text, images)
    except Exception as exc:
        log.exception("openai moderation failed: %s", exc)
        remote = None

    if remote is None and not settings.openai_api_key:
        if settings.is_production:
            raise RuntimeError("moderation_unavailable")
        log.warning("OPENAI_API_KEY missing; queueing poll for human review")
        return ModerationResult(
            flagged=True,
            scored=False,
            categories=local.categories,
            scores=local.scores,
            source="unscored",
            reason=local.reason or "unscored_dev_queue",
        )

    if remote is None:
        if settings.is_production:
            raise RuntimeError("moderation_unavailable")
        local.flagged = True
        local.source = "local_after_openai_error"
        return local

    merged_categories = {**local.categories, **remote.categories}
    merged_scores = {**local.scores, **remote.scores}
    return ModerationResult(
        flagged=remote.flagged or local.flagged,
        scored=True,
        categories=merged_categories,
        scores=merged_scores,
        source=remote.source,
        reason=local.reason,
    )


def result_to_dict(result: ModerationResult) -> dict:
    return {
        "flagged": result.flagged,
        "scored": result.scored,
        "categories": result.categories,
        "scores": result.scores,
        "source": result.source,
        "reason": result.reason,
        "hard_block": result.hard_block,
    }
