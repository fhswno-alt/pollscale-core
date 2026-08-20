"""Production boot gates and CORS origin parsing."""

from __future__ import annotations

DEFAULT_JWT_SECRETS = {
    "dev-only-change-me",
    "change-me-in-production",
    "change-me",
    "secret",
    "jwt-secret",
}

DEV_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
]

MIN_JWT_SECRET_LENGTH = 32


class ProductionConfigError(RuntimeError):
    pass


def parse_cors_origins(raw: str, *, production: bool) -> list[str]:
    origins = [item.strip() for item in (raw or "").split(",") if item.strip()]
    if not origins:
        if production:
            raise ProductionConfigError("CORS_ORIGINS must list explicit origins in production")
        return list(DEV_CORS_ORIGINS)
    if "*" in origins and production:
        raise ProductionConfigError("CORS must not be wildcard in production")
    return origins


def validate_production_settings(
    *,
    pollscale_env: str,
    jwt_secret: str,
    allow_dev_auth: bool,
    cors_origins: str,
) -> list[str]:
    """Return problems that must refuse a production boot. Empty means safe."""
    if pollscale_env.lower() != "production":
        return []
    problems: list[str] = []
    secret = (jwt_secret or "").strip()
    if not secret or secret in DEFAULT_JWT_SECRETS or len(secret) < MIN_JWT_SECRET_LENGTH:
        problems.append("JWT_SECRET is default or shorter than 32 characters")
    if allow_dev_auth:
        problems.append("ALLOW_DEV_AUTH must be false in production")
    try:
        parse_cors_origins(cors_origins, production=True)
    except ProductionConfigError as exc:
        problems.append(str(exc))
    return problems


def assert_production_safe(
    *,
    pollscale_env: str,
    jwt_secret: str,
    allow_dev_auth: bool,
    cors_origins: str,
) -> None:
    problems = validate_production_settings(
        pollscale_env=pollscale_env,
        jwt_secret=jwt_secret,
        allow_dev_auth=allow_dev_auth,
        cors_origins=cors_origins,
    )
    if problems:
        raise ProductionConfigError(
            "Refusing to boot with unsafe production configuration:\n- " + "\n- ".join(problems)
        )
