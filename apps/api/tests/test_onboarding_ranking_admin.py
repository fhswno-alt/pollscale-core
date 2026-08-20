from datetime import date

import pyotp

from app.admin_auth import create_admin_user
from app.models import Poll, PollOption, Topic, User
from tests.conftest import headers


def _auth(client, handle="ada", email=None):
    body = {"display_name": handle.title(), "handle": handle}
    if email:
        body["email"] = email
    return client.post("/auth/dev", json=body).json()


def _parents(db_session):
    food = Topic(slug="food", name="Food", icon="food")
    music = Topic(slug="music", name="Music", icon="note")
    lifestyle = Topic(slug="lifestyle", name="Lifestyle", icon="leaf")
    politics = Topic(slug="politics", name="Politics", icon="gov")
    db_session.add_all([food, music, lifestyle, politics])
    db_session.commit()
    return food, music, lifestyle, politics


def _poll(db_session, author: User, topic: Topic, question: str):
    item = Poll(author_id=author.id, topic_id=topic.id, question=question, status="live")
    db_session.add(item)
    db_session.flush()
    a = PollOption(poll_id=item.id, label="Yes", position=0)
    b = PollOption(poll_id=item.id, label="No", position=1)
    db_session.add_all([a, b])
    db_session.commit()
    db_session.refresh(item)
    db_session.refresh(a)
    return item, a


def _onboard(client, token, device, topic_ids, handle="adaokoye", dob="2000-01-15", city="Austin"):
    return client.post(
        "/me/onboarding",
        json={
            "first_name": "Ada",
            "handle": handle,
            "date_of_birth": dob,
            "city": city,
            "topic_ids": topic_ids,
        },
        headers=headers(device, token),
    )


def _enroll_admin(client, db_session, email="ops@pollscale.com", password="supersecret1"):
    create_admin_user(db_session, email, password)
    login = client.post("/admin/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    payload = login.json()
    assert payload["status"] == "enroll_mfa"
    assert payload.get("access_token") is None
    code = pyotp.TOTP(payload["secret"]).now()
    mfa = client.post(
        "/admin/auth/mfa",
        json={"token": payload["enrollment_token"], "code": code},
    )
    assert mfa.status_code == 200, mfa.text
    return mfa.json()["access_token"]


def test_dob_under_13_rejected(client, db_session):
    food, music, lifestyle, _ = _parents(db_session)
    token = _auth(client, "kiduser")["access_token"]
    today = date.today()
    under = date(today.year - 12, today.month, min(today.day, 28)).isoformat()
    response = _onboard(
        client,
        token,
        "device-dob-01",
        [food.id, music.id, lifestyle.id],
        handle="kiduser",
        dob=under,
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "under_13"


def test_onboarding_requires_three_parent_topics(client, db_session):
    food, music, lifestyle, _ = _parents(db_session)
    token = _auth(client, "thinint")["access_token"]
    too_few = _onboard(
        client,
        token,
        "device-onb-01",
        [food.id, music.id],
        handle="thinint",
    )
    assert too_few.status_code == 400
    assert too_few.json()["detail"] == "need_three_parent_topics"
    ok = _onboard(
        client,
        token,
        "device-onb-01",
        [food.id, music.id, lifestyle.id],
        handle="thinint",
    )
    assert ok.status_code == 200
    assert ok.json()["onboarded_at"]
    assert ok.json()["first_name"] == "Ada"
    assert len(ok.json()["interests"]) == 3


def test_not_interested_suppresses_topic(client, db_session, monkeypatch):
    monkeypatch.setattr("app.ranking.random.random", lambda: 0.99)
    food, music, lifestyle, _ = _parents(db_session)
    author = User(handle="authorx", handle_set=True, display_name="Author", provider="seed", provider_subject="ax")
    db_session.add(author)
    db_session.commit()
    food_poll, _ = _poll(db_session, author, food, "Pizza tonight?")
    music_poll, _ = _poll(db_session, author, music, "New album?")
    token = _auth(client, "rankuser")["access_token"]
    assert _onboard(
        client, token, "device-ni-01", [food.id, music.id, lifestyle.id], handle="rankuser"
    ).status_code == 200
    marked = client.post(
        f"/polls/{food_poll.id}/feedback",
        json={"kind": "not_interested"},
        headers=headers("device-ni-01", token),
    )
    assert marked.status_code == 200
    nxt = client.get("/feed/next", headers=headers("device-ni-01", token))
    assert nxt.status_code == 200
    assert nxt.json()["poll"]["id"] == music_poll.id


def test_vote_outweighs_skip_in_ranking(client, db_session, monkeypatch):
    monkeypatch.setattr("app.ranking.random.random", lambda: 0.99)
    food, music, lifestyle, _ = _parents(db_session)
    author = User(handle="authory", handle_set=True, display_name="Author", provider="seed", provider_subject="ay")
    db_session.add(author)
    db_session.commit()
    voted_poll, voted_opt = _poll(db_session, author, food, "Old food poll")
    skipped_poll, _ = _poll(db_session, author, music, "Old music poll")
    food_next, _ = _poll(db_session, author, food, "Fresh food poll")
    music_next, _ = _poll(db_session, author, music, "Fresh music poll")
    token = _auth(client, "voterank")["access_token"]
    device = "device-vote-rank"
    assert _onboard(
        client, token, device, [food.id, music.id, lifestyle.id], handle="voterank"
    ).status_code == 200
    assert (
        client.post(
            f"/polls/{voted_poll.id}/vote",
            json={"option_id": voted_opt.id},
            headers=headers(device, token),
        ).status_code
        == 200
    )
    assert client.post(f"/polls/{skipped_poll.id}/skip", headers=headers(device, token)).status_code == 200
    nxt = client.get("/feed/next", headers=headers(device, token))
    assert nxt.status_code == 200
    assert nxt.json()["poll"]["id"] == food_next.id
    assert nxt.json()["poll"]["id"] != music_next.id


def test_admin_password_only_rejected_after_mfa(client, db_session, poll):
    token = _enroll_admin(client, db_session)
    again = client.post(
        "/admin/auth/login",
        json={"email": "ops@pollscale.com", "password": "supersecret1"},
    )
    assert again.status_code == 200
    body = again.json()
    assert body["status"] == "mfa_required"
    assert body.get("access_token") is None
    assert body.get("mfa_token")
    bare = client.get("/admin/queue", headers=headers("admin-console-device"))
    assert bare.status_code == 401
    consumer = _auth(client, "notadmin", "notadmin@pollscale.com")
    denied = client.get(
        "/admin/queue",
        headers=headers("device-consumer-admin", consumer["access_token"]),
    )
    assert denied.status_code == 401
    reported = client.post(
        f"/polls/{poll['poll'].id}/report",
        json={"reason": "spam"},
        headers=headers("device-report-admin", consumer["access_token"]),
    )
    assert reported.status_code == 200
    queue = client.get("/admin/queue", headers={"Authorization": f"Bearer {token}"})
    assert queue.status_code == 200
    ids = [item["poll"]["id"] for item in queue.json()]
    assert poll["poll"].id in ids
