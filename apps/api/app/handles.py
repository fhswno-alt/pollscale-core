"""Reserved handles and a slur / terror blocklist."""

from __future__ import annotations

import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session

HANDLE_RE = re.compile(r"^[a-z0-9_]{2,24}$")

RESERVED = {
    "dave",
    "pollscale",
    "admin",
    "official",
    "support",
    "administrator",
    "moderator",
    "mod",
    "staff",
    "help",
    "root",
    "system",
    "pollscale_official",
    "pollscalehq",
}

# Terror orgs and sexual / racial slurs. Kept lowercase; matching is exact or contained.
BLOCKED_TERMS = {
    "isis",
    "isil",
    "daesh",
    "alqaeda",
    "alqaida",
    "taliban",
    "bokoharam",
    "alshabaab",
    "nazi",
    "hitler",
    "nigger",
    "nigga",
    "faggot",
    "fag",
    "dyke",
    "kike",
    "spic",
    "wetback",
    "chink",
    "gook",
    "tranny",
    "retard",
    "rapist",
    "childrape",
    "childporn",
    "cp",
    "pedo",
    "pedophile",
    "nazi",
}


class HandleError(ValueError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def normalize_handle(raw: str) -> str:
    return re.sub(r"[^a-z0-9_]", "", raw.lower())[:24]


def _collapsed(value: str) -> str:
    return re.sub(r"[_\-.\s]", "", value.lower())


def is_blocked_term(value: str) -> bool:
    collapsed = _collapsed(value)
    if collapsed in BLOCKED_TERMS or collapsed in RESERVED:
        return True
    return any(term in collapsed for term in BLOCKED_TERMS if len(term) > 2)


def validate_handle(raw: str) -> str:
    handle = normalize_handle(raw)
    if not HANDLE_RE.match(handle):
        raise HandleError("invalid_handle")
    if handle in RESERVED or _collapsed(handle) in RESERVED:
        raise HandleError("reserved_username")
    if is_blocked_term(handle):
        raise HandleError("reserved_username")
    return handle


def unique_legal_handle(db: Session, desired: str, user_model) -> str:
    base = normalize_handle(desired) or "member"
    if base in RESERVED or is_blocked_term(base):
        base = "member"
    handle = base
    n = 1
    while db.scalar(select(func.count()).select_from(user_model).where(user_model.handle == handle)):
        n += 1
        handle = f"{base}{n}"[:24]
    return handle
