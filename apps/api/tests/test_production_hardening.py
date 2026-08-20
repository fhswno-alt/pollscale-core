import jwt
import pytest

from app.auth import AuthError, verify_google_token
from app.config import get_settings
from app.rate_limit import AUTH_LIMIT, reset_limits, vote_window
from app.security import (
    ProductionConfigError,
    assert_production_safe,
    parse_cors_origins,
    validate_production_settings,
)
from tests.conftest import headers


def test_production_refuses_default_jwt():
    problems = validate_production_settings(
        pollscale_env="production",
        jwt_secret="change-me-in-production",
        allow_dev_auth=False,
        cors_origins="https://pollscale.com",
    )
    assert any("JWT_SECRET" in item for item in problems)


def test_production_refuses_short_jwt():
    problems = validate_production_settings(
        pollscale_env="production",
        jwt_secret="short-secret-value",
        allow_dev_auth=False,
        cors_origins="https://pollscale.com",
    )
    assert any("JWT_SECRET" in item for item in problems)


def test_production_refuses_dev_auth():
    problems = validate_production_settings(
        pollscale_env="production",
        jwt_secret="a" * 32,
        allow_dev_auth=True,
        cors_origins="https://pollscale.com",
    )
    assert any("ALLOW_DEV_AUTH" in item for item in problems)


def test_production_refuses_wildcard_cors():
    problems = validate_production_settings(
        pollscale_env="production",
        jwt_secret="a" * 32,
        allow_dev_auth=False,
        cors_origins="*",
    )
    assert any("wildcard" in item.lower() for item in problems)


def test_production_refuses_empty_cors():
    problems = validate_production_settings(
        pollscale_env="production",
        jwt_secret="a" * 32,
        allow_dev_auth=False,
        cors_origins="",
    )
    assert problems


def test_production_accepts_explicit_safe_config():
    problems = validate_production_settings(
        pollscale_env="production",
        jwt_secret="a" * 32,
        allow_dev_auth=False,
        cors_origins="https://pollscale.com,https://www.pollscale.com",
    )
    assert problems == []
    assert_production_safe(
        pollscale_env="production",
        jwt_secret="a" * 32,
        allow_dev_auth=False,
        cors_origins="https://pollscale.com",
    )


def test_development_allows_defaults():
    assert (
        validate_production_settings(
            pollscale_env="development",
            jwt_secret="dev-only-change-me",
            allow_dev_auth=True,
            cors_origins="*",
        )
        == []
    )


def test_assert_production_safe_raises():
    with pytest.raises(ProductionConfigError, match="Refusing to boot"):
        assert_production_safe(
            pollscale_env="production",
            jwt_secret="dev-only-change-me",
            allow_dev_auth=True,
            cors_origins="*",
        )


def test_dev_cors_defaults_are_explicit():
    origins = parse_cors_origins("", production=False)
    assert "*" not in origins
    assert "http://localhost:5173" in origins


def test_health_checks_database(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}


def test_cors_echoes_configured_origin(client):
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_does_not_echo_unknown_origin(client):
    response = client.options(
        "/health",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") != "https://evil.example"


def test_auth_dev_404_when_disabled(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "allow_dev_auth", False)
    response = client.post("/auth/dev", json={"display_name": "Nope"})
    assert response.status_code == 404


def test_google_does_not_skip_signature_in_production(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "pollscale_env", "production")
    monkeypatch.setattr(settings, "google_client_id", "web.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "allow_dev_auth", False)

    def boom(*_args, **_kwargs):
        raise jwt.InvalidTokenError("bad sig")

    monkeypatch.setattr("app.auth._decode_oidc", boom)
    monkeypatch.setattr(
        "app.auth.httpx.get",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("tokeninfo must not run")),
    )
    with pytest.raises(AuthError, match="invalid Google token"):
        verify_google_token("not-a-real-google-token")


def test_debug_sentry_is_noop_without_dsn(client):
    response = client.post("/debug/sentry")
    assert response.status_code == 200
    assert response.json()["status"] == "noop"


def test_auth_rate_limit(client):
    reset_limits()
    last = None
    for index in range(AUTH_LIMIT + 1):
        last = client.post("/auth/dev", json={"display_name": f"Rate{index}", "handle": f"rate{index}"})
    assert last is not None
    assert last.status_code == 429
    assert last.json()["detail"] == "rate_limited"


def test_vote_rate_limit(client, poll):
    reset_limits()
    vote_window.limit = 3
    try:
        last = None
        for index in range(4):
            last = client.post(
                f"/polls/{poll['poll'].id}/vote",
                json={"option_id": poll["a"].id},
                headers=headers(f"vote-limit-{index}"),
            )
        assert last is not None
        assert last.status_code == 429
        assert last.json()["detail"] == "rate_limited"
    finally:
        vote_window.limit = 60
        reset_limits()


def test_settings_production_values_fail_assert(monkeypatch):
    monkeypatch.setenv("POLLSCALE_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "change-me-in-production")
    monkeypatch.setenv("ALLOW_DEV_AUTH", "true")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    get_settings.cache_clear()
    from app.config import Settings

    loaded = Settings()
    with pytest.raises(ProductionConfigError):
        assert_production_safe(
            pollscale_env=loaded.pollscale_env,
            jwt_secret=loaded.jwt_secret,
            allow_dev_auth=loaded.allow_dev_auth,
            cors_origins=loaded.cors_origins,
        )
    get_settings.cache_clear()
