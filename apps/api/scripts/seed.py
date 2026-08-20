"""Seed taxonomy, authors, and a first set of polls."""

from __future__ import annotations

import io
import sys
from pathlib import Path
from PIL import Image, ImageDraw
from sqlalchemy import func, select
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.auth import upsert_user  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.database import get_engine, get_session_factory  # noqa: E402
from app.models import Base, Poll, PollOption  # noqa: E402
from app.storage import get_storage  # noqa: E402
from app.taxonomy import ensure_taxonomy  # noqa: E402

PHOTOS = {
    "cabin": ("#1b140c", "#e8c07a", "CABIN"),
    "penthouse": ("#1a1020", "#c9a36a", "CITY"),
    "riff-black": ("#111111", "#E8FF3D", "RIFF"),
    "riff-sweet": ("#2a1020", "#f2d2c2", "RIFF"),
    "dune": ("#c4a35a", "#3b2a12", "DUNE"),
    "blade": ("#102030", "#7ad7ff", "2049"),
}


def _placeholder(key: str) -> bytes:
    bg, fg, label = PHOTOS.get(key, ("#222", "#E8FF3D", "POLL"))
    image = Image.new("RGB", (1400, 900), bg)
    draw = ImageDraw.Draw(image)
    draw.rectangle((80, 80, 1320, 820), outline=fg, width=8)
    draw.rectangle((120, 620, 520, 760), fill=fg)
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=88)
    return buf.getvalue()


def _store_photo(key: str) -> str:
    return get_storage().save(_placeholder(key), "image/jpeg", f"{key}.jpg")


def seed(db: Session | None = None) -> None:
    close = False
    if db is None:
        Base.metadata.create_all(bind=get_engine())
        Path(get_settings().media_dir).mkdir(parents=True, exist_ok=True)
        db = get_session_factory()()
        close = True
    try:
        ensure_taxonomy(db)
        db.commit()
        if db.scalar(select(func.count()).select_from(Poll)):
            return
        _seed(db)
    finally:
        if close:
            db.close()


def _seed(db: Session) -> None:
    topics = ensure_taxonomy(db)

    ada, _ = upsert_user(
        db, provider="seed", subject="ada", display_name="Ada Okoye", handle_hint="ada"
    )
    nico, _ = upsert_user(
        db, provider="seed", subject="nico", display_name="Nico Marsh", handle_hint="nico"
    )
    june, _ = upsert_user(
        db, provider="seed", subject="june", display_name="June Park", handle_hint="june"
    )
    upsert_user(
        db,
        provider="seed",
        subject="dave",
        display_name="Dave",
        email="dave@pollscale.com",
        handle_hint="daven",
    )
    db.flush()

    cabin = _store_photo("cabin")
    penthouse = _store_photo("penthouse")
    riff_a = _store_photo("riff-black")
    riff_b = _store_photo("riff-sweet")
    dune = _store_photo("dune")
    blade = _store_photo("blade")

    catalog = [
        {
            "author": nico,
            "topic": topics["lifestyle-travel"],
            "question": "First thing you do on a long weekend?",
            "options": [
                ("Leave town", None, 380),
                ("Stay in", None, 290),
                ("Cook something slow", None, 210),
                ("See everyone", None, 140),
            ],
        },
        {
            "author": ada,
            "topic": topics["food-restaurants"],
            "question": "Pineapple on pizza?",
            "options": [
                ("Obviously yes", None, 444),
                ("Absolutely not", None, 556),
            ],
        },
        {
            "author": june,
            "topic": topics["work-remote"],
            "question": "Where should the interesting work actually happen?",
            "options": [
                ("Home", None, 701),
                ("The office", None, 299),
                ("A third place", None, 214),
            ],
        },
        {
            "author": nico,
            "topic": topics["culture-film"],
            "question": "Better world: Dune or Blade Runner?",
            "options": [
                ("Dune", dune, 612),
                ("Blade Runner", blade, 588),
            ],
        },
        {
            "author": ada,
            "topic": topics["politics-us"],
            "question": "Will the U.S. economy avoid recession in 2025?",
            "options": [
                ("Yes", None, 7688),
                ("No", None, 4712),
            ],
        },
        {
            "author": june,
            "topic": topics["music-rock"],
            "question": "Which opening riff is better?",
            "options": [
                ("Back in Black", riff_a, 910),
                ("Sweet Child O' Mine", riff_b, 870),
            ],
        },
        {
            "author": nico,
            "topic": topics["food-cooking"],
            "question": "The correct way to eat pizza?",
            "options": [
                ("Fold it", None, 540),
                ("Knife and fork", None, 210),
                ("Hands, flat", None, 390),
                ("Whatever, just eat", None, 480),
            ],
        },
        {
            "author": ada,
            "topic": topics["lifestyle-home"],
            "question": "Cabin in the woods or penthouse in the city?",
            "options": [
                ("Cabin", cabin, 821),
                ("Penthouse", penthouse, 463),
            ],
        },
        {
            "author": june,
            "topic": topics["places-local"],
            "city_tag": "Austin",
            "question": "Best breakfast taco in Austin?",
            "options": [
                ("Veracruz", None, 410),
                ("Torchy's", None, 290),
                ("Home kitchen", None, 180),
            ],
        },
    ]

    for item in catalog:
        poll = Poll(
            author_id=item["author"].id,
            topic_id=item["topic"].id,
            question=item["question"],
            city_tag=item.get("city_tag"),
            status="live",
        )
        db.add(poll)
        db.flush()
        for index, (label, image, extra) in enumerate(item["options"]):
            db.add(
                PollOption(
                    poll_id=poll.id,
                    label=label,
                    image_url=image,
                    position=index,
                    extra_votes=extra,
                )
            )
    db.commit()


if __name__ == "__main__":
    seed()
    print("Seeded Pollscale.")
