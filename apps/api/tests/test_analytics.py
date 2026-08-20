from datetime import datetime
from zoneinfo import ZoneInfo

from app.analytics import FUNNEL_EVENTS, capture_posthog, digest_body
from app.config import get_settings
from tests.conftest import headers

LONDON = ZoneInfo("Europe/London")


class _FakeResponse:
    status_code = 200


def test_signup_slack_payload_has_no_email(client, monkeypatch):
    sent: list[tuple[str, dict]] = []

    def fake_post(url, json=None, **kwargs):
        sent.append((url, json or {}))
        return _FakeResponse()

    monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/test/pollscale")
    get_settings.cache_clear()
    monkeypatch.setattr("app.analytics.httpx.post", fake_post)

    response = client.post(
        "/auth/dev",
        json={"display_name": "Ada Okoye", "handle": "adaokoye", "email": "ada@pollscale.com"},
    )
    assert response.status_code == 200
    assert sent, "expected a Slack webhook post"
    text = sent[0][1]["text"]
    assert "ada@pollscale.com" not in text
    assert "@" not in text
    assert "Ada" in text
    assert "Dev" in text
    get_settings.cache_clear()


def test_digest_body_includes_total_and_new():
    assert digest_body(134, 24, "day") == "134 users total, plus 24 today."
    assert digest_body(134, 24, "week") == "134 users total, plus 24 this week."
    assert digest_body(10, 2, "month") == "10 users total, plus 2 this month."
    assert digest_body(10, 2, "quarter") == "10 users total, plus 2 this quarter."


def test_digest_is_idempotent(db_session, monkeypatch):
    from app.analytics_jobs import post_digest

    monkeypatch.setattr("app.analytics_jobs.post_slack", lambda text: True)
    when = datetime(2026, 8, 20, 18, 0, tzinfo=LONDON)
    first = post_digest(db_session, "day", when)
    second = post_digest(db_session, "day", when)
    assert first == "0 users total, plus 0 today."
    assert second is None


def test_posthog_skipped_when_key_missing(monkeypatch):
    monkeypatch.delenv("POSTHOG_PROJECT_API_KEY", raising=False)
    monkeypatch.setenv("POSTHOG_PROJECT_API_KEY", "")
    get_settings.cache_clear()
    called = []

    class Boom:
        def capture(self, **kwargs):
            called.append(kwargs)

    monkeypatch.setattr("app.analytics._posthog_client", lambda: None)
    assert capture_posthog("user_signed_up", "user-1", {"email": "hidden@pollscale.com"}) is False
    assert called == []
    get_settings.cache_clear()


def test_funnel_event_names_are_documented():
    assert FUNNEL_EVENTS == (
        "onboarding_started",
        "onboarding_name",
        "onboarding_username",
        "onboarding_dob",
        "onboarding_city",
        "onboarding_interests",
        "onboarding_completed",
        "first_vote",
    )


def test_signup_still_works_without_slack(client):
    response = client.post("/auth/dev", json={"display_name": "Nico", "handle": "nicosign"})
    assert response.status_code == 200
    assert response.json()["user"]["handle"] == "nicosign"
