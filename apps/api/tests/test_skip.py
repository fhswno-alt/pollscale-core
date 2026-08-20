from tests.conftest import headers


def _second_poll(db_session, poll):
    from app.models import Poll, PollOption

    item = Poll(
        author_id=poll["author"].id,
        topic_id=poll["topic"].id,
        question="Stay or go?",
    )
    db_session.add(item)
    db_session.flush()
    option = PollOption(poll_id=item.id, label="Stay", position=0)
    db_session.add(PollOption(poll_id=item.id, label="Go", position=1))
    db_session.add(option)
    db_session.commit()
    return item


def test_skip_does_not_create_a_vote(client, poll):
    device = "skip-device-0001"
    skipped = client.post(f"/polls/{poll['poll'].id}/skip", headers=headers(device))
    assert skipped.status_code == 200
    assert skipped.json()["poll"] is None or skipped.json()["poll"]["id"] != poll["poll"].id
    assert skipped.json()["guest_votes_used"] == 0

    shown = client.get(f"/polls/{poll['poll'].id}", headers=headers(device))
    assert shown.json()["viewer_vote_option_id"] is None
    assert shown.json()["skipped"] is True
    assert shown.json()["total_votes"] is None


def test_skip_does_not_consume_guest_quota(client, poll, db_session):
    device = "skip-quota-device"
    other = _second_poll(db_session, poll)
    card = client.get(f"/polls/{other.id}", headers=headers(device)).json()

    skip = client.post(f"/polls/{poll['poll'].id}/skip", headers=headers(device))
    assert skip.status_code == 200
    assert skip.json()["guest_votes_used"] == 0
    assert skip.json()["guest_votes_remaining"] == 3

    voted = client.post(
        f"/polls/{other.id}/vote",
        json={"option_id": card["options"][0]["id"]},
        headers=headers(device),
    )
    assert voted.status_code == 200
    assert voted.json()["guest_votes_used"] == 1
    assert voted.json()["guest_votes_remaining"] == 2


def test_skipped_poll_is_not_served_again(client, poll, db_session):
    device = "skip-feed-device"
    other = _second_poll(db_session, poll)
    first = client.get("/feed/next", headers=headers(device))
    assert first.status_code == 200
    assert first.json()["poll"] is not None

    client.post(f"/polls/{poll['poll'].id}/skip", headers=headers(device))
    nxt = client.get("/feed/next", headers=headers(device))
    assert nxt.json()["poll"]["id"] == other.id

    client.post(f"/polls/{other.id}/skip", headers=headers(device))
    empty = client.get("/feed/next", headers=headers(device))
    assert empty.json()["poll"] is None


def test_cannot_skip_after_voting(client, poll):
    device = "skip-after-vote"
    vote = client.post(
        f"/polls/{poll['poll'].id}/vote",
        json={"option_id": poll["a"].id},
        headers=headers(device),
    )
    assert vote.status_code == 200
    skipped = client.post(f"/polls/{poll['poll'].id}/skip", headers=headers(device))
    assert skipped.status_code == 409
