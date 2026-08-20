"""Interest taxonomy: parent categories with a short list of subtopics."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Topic

# Enough to feel like X-style interests. Not infinite.
TAXONOMY: list[tuple[str, str, str, list[tuple[str, str]]]] = [
    (
        "technology",
        "Technology",
        "chip",
        [
            ("technology-ai", "AI"),
            ("technology-robotics", "Robotics"),
            ("technology-gadgets", "Gadgets"),
            ("technology-software", "Software"),
        ],
    ),
    (
        "lifestyle",
        "Lifestyle",
        "leaf",
        [
            ("lifestyle-home", "Home"),
            ("lifestyle-fashion", "Fashion"),
            ("lifestyle-travel", "Travel"),
            ("lifestyle-wellness", "Wellness"),
        ],
    ),
    (
        "food",
        "Food",
        "food",
        [
            ("food-cooking", "Cooking"),
            ("food-restaurants", "Restaurants"),
            ("food-drinks", "Drinks"),
        ],
    ),
    (
        "music",
        "Music",
        "note",
        [
            ("music-rock", "Rock"),
            ("music-hiphop", "Hip-hop"),
            ("music-pop", "Pop"),
            ("music-live", "Live"),
        ],
    ),
    (
        "sports",
        "Sports",
        "ball",
        [
            ("sports-football", "Football"),
            ("sports-basketball", "Basketball"),
            ("sports-soccer", "Soccer"),
            ("sports-fitness", "Fitness"),
        ],
    ),
    (
        "culture",
        "Culture",
        "film",
        [
            ("culture-film", "Film"),
            ("culture-books", "Books"),
            ("culture-tv", "TV"),
        ],
    ),
    (
        "work",
        "Work",
        "bag",
        [
            ("work-remote", "Remote"),
            ("work-career", "Career"),
            ("work-startups", "Startups"),
        ],
    ),
    (
        "politics",
        "Politics",
        "gov",
        [
            ("politics-us", "US"),
            ("politics-world", "World"),
            ("politics-policy", "Policy"),
        ],
    ),
    (
        "places",
        "Places",
        "pin",
        [
            ("places-local", "Local"),
        ],
    ),
]


def ensure_taxonomy(db: Session) -> dict[str, Topic]:
    by_slug: dict[str, Topic] = {}
    for parent_slug, name, icon, children in TAXONOMY:
        parent = db.scalar(select(Topic).where(Topic.slug == parent_slug))
        if parent is None:
            parent = Topic(slug=parent_slug, name=name, icon=icon, parent_id=None)
            db.add(parent)
            db.flush()
        else:
            parent.name = name
            parent.icon = icon
            parent.parent_id = None
        by_slug[parent_slug] = parent
        for child_slug, child_name in children:
            child = db.scalar(select(Topic).where(Topic.slug == child_slug))
            if child is None:
                child = Topic(slug=child_slug, name=child_name, icon=icon, parent_id=parent.id)
                db.add(child)
                db.flush()
            else:
                child.name = child_name
                child.icon = icon
                child.parent_id = parent.id
            by_slug[child_slug] = child
    db.flush()
    return by_slug


def parent_id_of(topic: Topic) -> str:
    return topic.parent_id or topic.id


def unique_parent_ids(topics: list[Topic]) -> set[str]:
    return {parent_id_of(topic) for topic in topics}
