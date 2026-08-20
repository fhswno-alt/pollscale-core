from __future__ import annotations

import base64
import io
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import bcrypt
import jwt
import pyotp
import qrcode
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import AuthError
from app.config import get_settings
from app.models import AdminUser


class AdminAuthError(AuthError):
    pass


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def normalize_email(email: str) -> str:
    return email.strip().lower()


def create_admin_token(admin_id: str, typ: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    if typ == "access":
        exp = now + timedelta(hours=12)
    else:
        exp = now + timedelta(minutes=15)
    payload = {
        "sub": admin_id,
        "role": "admin",
        "typ": typ,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_admin_token(token: str, *, allowed: set[str]) -> tuple[str, str]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except Exception as exc:
        raise AdminAuthError("invalid token") from exc
    if payload.get("role") != "admin":
        raise AdminAuthError("invalid token")
    typ = str(payload.get("typ") or "")
    if typ not in allowed:
        raise AdminAuthError("invalid token")
    sub = payload.get("sub")
    if not sub:
        raise AdminAuthError("invalid token")
    return str(sub), typ


def totp_uri(email: str, secret: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="Pollscale Admin")


def qr_png_base64(otpauth_url: str) -> str:
    image = qrcode.make(otpauth_url)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def verify_totp(secret: str, code: str) -> bool:
    digits = "".join(ch for ch in code if ch.isdigit())
    if len(digits) != 6:
        return False
    return bool(pyotp.TOTP(secret).verify(digits, valid_window=1))


def create_admin_user(db: Session, email: str, password: str) -> AdminUser:
    admin = AdminUser(
        id=str(uuid4()),
        email=normalize_email(email),
        password_hash=hash_password(password),
        totp_secret=pyotp.random_base32(),
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def bootstrap_admin_user(db: Session) -> AdminUser | None:
    settings = get_settings()
    email = normalize_email(settings.admin_bootstrap_email)
    password = settings.admin_bootstrap_password
    if not email or not password:
        return None
    existing = db.scalar(select(func.count()).select_from(AdminUser))
    if existing:
        return None
    taken = db.scalar(select(AdminUser).where(AdminUser.email == email))
    if taken:
        return taken
    return create_admin_user(db, email, password)
