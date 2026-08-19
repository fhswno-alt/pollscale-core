from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth import AuthError, decode_access_token
from app.database import get_db
from app.models import User

bearer = HTTPBearer(auto_error=False)

DbDep = Annotated[Session, Depends(get_db)]


def get_device_id(x_device_id: Annotated[str | None, Header()] = None) -> str:
    if not x_device_id or len(x_device_id) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="X-Device-Id is required")
    return x_device_id[:64]


DeviceDep = Annotated[str, Depends(get_device_id)]


def get_optional_user(
    db: DbDep,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)] = None,
) -> User | None:
    if creds is None:
        return None
    try:
        user_id = decode_access_token(creds.credentials)
    except (AuthError, Exception):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid token") from None
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="unknown user")
    return user


OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def require_user(user: OptionalUser) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="sign_in_required")
    return user


UserDep = Annotated[User, Depends(require_user)]


def actor_key(user: User | None, device_id: str) -> str:
    if user is not None:
        return f"user:{user.id}"
    return f"device:{device_id}"
