from tests.conftest import headers


def test_vote_is_unique_per_guest_device(client, poll):
    first = client.post(
        f"/polls/{poll['poll'].id}/vote",
        json={"option_id": poll["a"].id},
        headers=headers("device-alpha-001"),
    )
    assert first.status_code == 200
    assert first.json()["poll"]["viewer_vote_option_id"] == poll["a"].id
    assert first.json()["poll"]["total_votes"] == 1

    second = client.post(
        f"/polls/{poll['poll'].id}/vote",
        json={"option_id": poll["b"].id},
        headers=headers("device-alpha-001"),
    )
    assert second.status_code == 409
    assert second.json()["detail"] == "already_voted"


def test_signed_in_user_cannot_change_vote(client, poll):
    auth = client.post("/auth/dev", json={"display_name": "Ada", "handle": "ada"})
    token = auth.json()["access_token"]

    first = client.post(
        f"/polls/{poll['poll'].id}/vote",
        json={"option_id": poll["a"].id},
        headers=headers("device-user-1", token),
    )
    assert first.status_code == 200

    second = client.post(
        f"/polls/{poll['poll'].id}/vote",
        json={"option_id": poll["b"].id},
        headers=headers("device-user-1", token),
    )
    assert second.status_code == 409

    shown = client.get(f"/polls/{poll['poll'].id}", headers=headers("device-user-1", token))
    assert shown.json()["viewer_vote_option_id"] == poll["a"].id
    percents = [option["percent"] for option in shown.json()["options"]]
    assert sum(percents) == 100


def test_two_devices_can_vote_the_same_poll(client, poll):
    a = client.post(
        f"/polls/{poll['poll'].id}/vote",
        json={"option_id": poll["a"].id},
        headers=headers("device-one-aaaa"),
    )
    b = client.post(
        f"/polls/{poll['poll'].id}/vote",
        json={"option_id": poll["b"].id},
        headers=headers("device-two-bbbb"),
    )
    assert a.status_code == 200
    assert b.status_code == 200
    assert b.json()["poll"]["total_votes"] == 2
