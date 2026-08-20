from app.moderation import ModerationResult
from tests.conftest import headers


def _auth(client, handle="ada", email=None):
    body = {"display_name": handle.title(), "handle": handle}
    if email:
        body["email"] = email
    return client.post("/auth/dev", json=body).json()


def test_reserved_username_rejected(client):
    for name in ("dave", "admin", "pollscale", "official", "support", "isis", "nigger"):
        response = client.post(
            "/auth/dev",
            json={"display_name": "X", "handle": name},
        )
        assert response.status_code == 400, name
        assert response.json()["detail"] == "reserved_username"


def test_legal_username_accepted(client):
    response = client.post("/auth/dev", json={"display_name": "Ada", "handle": "adaokoye"})
    assert response.status_code == 200
    assert response.json()["user"]["handle"] == "adaokoye"
    assert response.json()["user"]["handle_set"] is True


def test_report_creates_queue_item(client, poll):
    user = _auth(client, "reporter", "reporter@example.com")
    dave = _auth(client, "daven", "dave@polescale.com")
    reported = client.post(
        f"/polls/{poll['poll'].id}/report",
        json={"reason": "spam", "detail": "looks like a bot"},
        headers=headers("device-report-01", user["access_token"]),
    )
    assert reported.status_code == 200
    queue = client.get("/admin/queue", headers=headers("device-admin-01", dave["access_token"]))
    assert queue.status_code == 200
    ids = [item["poll"]["id"] for item in queue.json()]
    assert poll["poll"].id in ids
    match = next(item for item in queue.json() if item["poll"]["id"] == poll["poll"].id)
    assert match["open_reports"] >= 1
    assert match["reporters"][0]["reason"] == "spam"


def test_flagged_poll_is_not_public(client, poll, monkeypatch):
    def flag(text, image_urls=None):
        return ModerationResult(
            flagged=True,
            scored=True,
            categories={"self-harm": True},
            scores={"self-harm": 0.99},
            source="test",
        )

    monkeypatch.setattr("app.routers.polls.score_content", flag)
    author = _auth(client, "author1")
    created = client.post(
        "/polls",
        json={
            "question": "How should I kill myself tonight?",
            "topic_id": poll["topic"].id,
            "options": [{"label": "Don't"}, {"label": "Call someone"}],
        },
        headers=headers("device-flag-01", author["access_token"]),
    )
    assert created.status_code == 201
    assert created.json()["status"] == "pending_review"
    assert "human" in (created.json()["review_message"] or "").lower()

    guest = headers("device-flag-guest")
    feed = client.get("/feed/next", headers=guest)
    assert feed.json()["poll"] is None or feed.json()["poll"]["id"] != created.json()["id"]
    hidden = client.get(f"/polls/{created.json()['id']}", headers=guest)
    assert hidden.status_code == 404


def test_user_can_delete_own_poll(client, poll):
    token = _auth(client, "owner1")["access_token"]
    created = client.post(
        "/polls",
        json={
            "question": "Keep this poll or not?",
            "topic_id": poll["topic"].id,
            "options": [{"label": "Keep"}, {"label": "Drop"}],
        },
        headers=headers("device-del-01", token),
    )
    assert created.status_code == 201
    poll_id = created.json()["id"]
    deleted = client.delete(f"/polls/{poll_id}", headers=headers("device-del-01", token))
    assert deleted.status_code == 204
    gone = client.get(f"/polls/{poll_id}", headers=headers("device-del-01", token))
    assert gone.status_code == 404
    feed = client.get("/feed/next", headers=headers("device-del-guest"))
    assert feed.json()["poll"] is None or feed.json()["poll"]["id"] != poll_id


def test_account_deletion(client, poll):
    token = _auth(client, "goneuser")["access_token"]
    created = client.post(
        "/polls",
        json={
            "question": "Should this vanish with me?",
            "topic_id": poll["topic"].id,
            "options": [{"label": "Yes"}, {"label": "No"}],
        },
        headers=headers("device-acct-01", token),
    )
    poll_id = created.json()["id"]
    removed = client.delete("/me", headers=headers("device-acct-01", token))
    assert removed.status_code == 204
    me = client.get("/me", headers=headers("device-acct-01", token))
    assert me.status_code == 401
    public = client.get(f"/polls/{poll_id}", headers=headers("device-acct-guest"))
    assert public.status_code == 404
