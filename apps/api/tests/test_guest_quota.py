from tests.conftest import headers


def _make_poll(client, db_session, name: str):
    from app.models import Poll, PollOption, Topic, User

    author = db_session.query(User).first()
    topic = db_session.query(Topic).first()
    item = Poll(author_id=author.id, topic_id=topic.id, question=name)
    db_session.add(item)
    db_session.flush()
    a = PollOption(poll_id=item.id, label="Yes", position=0)
    b = PollOption(poll_id=item.id, label="No", position=1)
    db_session.add_all([a, b])
    db_session.commit()
    return item, a


def test_guest_can_vote_exactly_three_times(client, poll, db_session):
    device = "guest-device-quota-1"
    first_poll = poll
    p2, a2 = _make_poll(client, db_session, "Second?")
    p3, a3 = _make_poll(client, db_session, "Third?")
    p4, a4 = _make_poll(client, db_session, "Fourth?")

    r1 = client.post(
        f"/polls/{first_poll['poll'].id}/vote",
        json={"option_id": first_poll["a"].id},
        headers=headers(device),
    )
    r2 = client.post(
        f"/polls/{p2.id}/vote", json={"option_id": a2.id}, headers=headers(device)
    )
    r3 = client.post(
        f"/polls/{p3.id}/vote", json={"option_id": a3.id}, headers=headers(device)
    )
    assert r1.status_code == r2.status_code == r3.status_code == 200
    assert r3.json()["guest_votes_used"] == 3
    assert r3.json()["guest_votes_remaining"] == 0

    r4 = client.post(
        f"/polls/{p4.id}/vote", json={"option_id": a4.id}, headers=headers(device)
    )
    assert r4.status_code == 403
    assert r4.json()["detail"] == "guest_quota_exceeded"


def test_guest_quota_survives_as_server_state(client, poll, db_session):
    device = "guest-device-persist"
    p2, a2 = _make_poll(client, db_session, "Two")
    p3, a3 = _make_poll(client, db_session, "Three")
    p4, a4 = _make_poll(client, db_session, "Four")

    for item, option in (
        (poll["poll"], poll["a"]),
        (p2, a2),
        (p3, a3),
    ):
        assert (
            client.post(
                f"/polls/{item.id}/vote",
                json={"option_id": option.id},
                headers=headers(device),
            ).status_code
            == 200
        )

    # "Reopen" is a new client session with the same device id.
    blocked = client.post(
        f"/polls/{p4.id}/vote", json={"option_id": a4.id}, headers=headers(device)
    )
    assert blocked.status_code == 403


def test_signed_in_user_is_not_capped(client, poll, db_session):
    device = "signed-in-device"
    auth = client.post("/auth/dev", json={"display_name": "Nico", "handle": "nico"})
    token = auth.json()["access_token"]
    extras = [_make_poll(client, db_session, f"Q{i}") for i in range(4)]
    for item, option in [(poll["poll"], poll["a"]), *[pair for pair in extras]]:
        response = client.post(
            f"/polls/{item.id}/vote",
            json={"option_id": option.id},
            headers=headers(device, token),
        )
        assert response.status_code == 200, response.text
    assert extras[-1][0] is not None
