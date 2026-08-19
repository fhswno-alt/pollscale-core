from fastapi import APIRouter, HTTPException, status

from app.auth import (
    AuthError,
    create_access_token,
    upsert_user,
    verify_apple_token,
    verify_google_token,
)
from app.config import get_settings
from app.deps import DbDep, UserDep
from app.schemas import AppleAuthIn, DevAuthIn, GoogleAuthIn, MeUpdate, TokenOut, UserOut

router = APIRouter(tags=["auth"])


def _token(user) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.post("/auth/apple", response_model=TokenOut)
def auth_apple(body: AppleAuthIn, db: DbDep) -> TokenOut:
    try:
        claims = verify_apple_token(body.identity_token)
    except AuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = upsert_user(
        db,
        provider="apple",
        subject=str(claims["sub"]),
        display_name=body.full_name or claims.get("name") or "Member",
        email=claims.get("email"),
    )
    return _token(user)


@router.post("/auth/google", response_model=TokenOut)
def auth_google(body: GoogleAuthIn, db: DbDep) -> TokenOut:
    try:
        claims = verify_google_token(body.id_token)
    except AuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = upsert_user(
        db,
        provider="google",
        subject=str(claims["sub"]),
        display_name=claims.get("name") or "Member",
        email=claims.get("email"),
        avatar_url=claims.get("picture"),
    )
    return _token(user)


@router.post("/auth/dev", response_model=TokenOut)
def auth_dev(body: DevAuthIn, db: DbDep) -> TokenOut:
    if not get_settings().allow_dev_auth:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    subject = body.handle or body.display_name
    user = upsert_user(
        db,
        provider="dev",
        subject=subject.lower(),
        display_name=body.display_name,
        handle_hint=body.handle or body.display_name,
    )
    return _token(user)


@router.get("/me", response_model=UserOut)
def me(user: UserDep) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
def update_me(body: MeUpdate, user: UserDep, db: DbDep) -> UserOut:
    if body.display_name:
        user.display_name = body.display_name
    if body.handle:
        user.handle = body.handle
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)
