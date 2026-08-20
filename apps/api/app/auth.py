from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import httpx
import jwt
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.handles import unique_legal_handle, validate_handle
from app.models import User

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_JWKS = "https://appleid.apple.com/auth/keys"
GOOGLE_CERTS = "https://www.googleapis.com/oauth2/v3/certs"


class AuthError(Exception):
    pass


def create_access_token(user_id: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.jwt_expire_days)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> str:
    settings = get_settings()
    payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    if payload.get("role"):
        raise AuthError("invalid token")
    sub = payload.get("sub")
    if not sub:
        raise AuthError("invalid token")
    return str(sub)


def upsert_user(
    db: Session,
    *,
    provider: str,
    subject: str,
    display_name: str,
    email: str | None = None,
    avatar_url: str | None = None,
    handle: str | None = None,
    handle_hint: str | None = None,
) -> tuple[User, bool]:
    existing = db.scalar(
        select(User).where(User.provider == provider, User.provider_subject == subject)
    )
    if existing:
        if existing.deleted_at is not None:
            raise AuthError("account_deleted")
        if display_name and existing.display_name != display_name:
            existing.display_name = display_name
        if email:
            existing.email = email
        if avatar_url:
            existing.avatar_url = avatar_url
        if handle and not existing.handle_set:
            existing.handle = validate_handle(handle)
            existing.handle_set = True
        db.commit()
        db.refresh(existing)
        return existing, False

    chosen = None
    handle_set = False
    if handle:
        chosen = validate_handle(handle)
        handle_set = True
    else:
        chosen = unique_legal_handle(db, handle_hint or (email.split("@")[0] if email else display_name), User)

    user = User(
        id=str(uuid4()),
        handle=chosen,
        handle_set=handle_set,
        display_name=display_name or "Member",
        avatar_url=avatar_url,
        provider=provider,
        provider_subject=subject,
        email=email,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, True


def _decode_oidc(token: str, jwks_url: str, issuer: str, audience: str) -> dict[str, Any]:
    client = PyJWKClient(jwks_url)
    signing_key = client.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=audience,
        issuer=issuer,
    )


def verify_apple_token(identity_token: str) -> dict[str, Any]:
    settings = get_settings()
    if settings.allow_dev_auth and identity_token.startswith("dev:"):
        subject = identity_token.split(":", 1)[1] or str(uuid4())
        return {"sub": subject, "email": None, "name": "Apple Tester"}
    if not settings.apple_client_id:
        raise AuthError("Apple Sign In is not configured")
    claims = _decode_oidc(identity_token, APPLE_JWKS, APPLE_ISSUER, settings.apple_client_id)
    return {
        "sub": claims["sub"],
        "email": claims.get("email"),
        "name": None,
    }


def verify_google_token(id_token: str) -> dict[str, Any]:
    settings = get_settings()
    if settings.allow_dev_auth and id_token.startswith("dev:"):
        subject = id_token.split(":", 1)[1] or str(uuid4())
        return {"sub": subject, "email": None, "name": "Google Tester", "picture": None}
    if not settings.google_client_id:
        raise AuthError("Google Sign In is not configured")
    try:
        claims = _decode_oidc(
            id_token,
            GOOGLE_CERTS,
            "https://accounts.google.com",
            settings.google_client_id,
        )
    except Exception:
        if settings.is_production:
            raise AuthError("invalid Google token") from None
        claims = jwt.decode(id_token, options={"verify_signature": False})
        if claims.get("aud") != settings.google_client_id:
            raise AuthError("invalid Google token") from None
        response = httpx.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
            timeout=8.0,
        )
        if response.status_code != 200:
            raise AuthError("invalid Google token")
        claims = response.json()
        if claims.get("aud") != settings.google_client_id:
            raise AuthError("invalid Google token")
    return {
        "sub": claims["sub"],
        "email": claims.get("email"),
        "name": claims.get("name") or claims.get("email"),
        "picture": claims.get("picture"),
    }


def is_admin(_user: User) -> bool:
    """Consumer accounts are never admins. Admin lives on /admin with its own table."""
    return False
