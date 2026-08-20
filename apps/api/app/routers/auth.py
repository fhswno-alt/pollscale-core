from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select

from app.auth import (
    AuthError,
    create_access_token,
    is_admin,
    upsert_user,
    verify_apple_token,
    verify_google_token,
)
from app.config import get_settings
from app.deps import DbDep, UserDep
from app.handles import HandleError, validate_handle
from app.models import (
    Notification,
    Poll,
    PushToken,
    TopicFollow,
    User,
    UserBlock,
    UserFollow,
    Vote,
)
from app.schemas import (
    AppleAuthIn,
    DevAuthIn,
    GoogleAuthIn,
    MeUpdate,
    NotificationOut,
    PushTokenIn,
    TokenOut,
    UserOut,
)

router = APIRouter(tags=["auth"])


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        handle=user.handle,
        handle_set=user.handle_set,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        email=user.email,
        is_admin=is_admin(user),
    )


def _token(user: User) -> TokenOut:
    return TokenOut(access_token=create_access_token(user.id), user=user_out(user))


def _auth_error(exc: Exception):
    if isinstance(exc, HandleError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=exc.code) from exc
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/auth/apple", response_model=TokenOut)
def auth_apple(body: AppleAuthIn, db: DbDep) -> TokenOut:
    try:
        claims = verify_apple_token(body.identity_token)
        user = upsert_user(
            db,
            provider="apple",
            subject=str(claims["sub"]),
            display_name=body.full_name or claims.get("name") or "Member",
            email=claims.get("email"),
            handle=body.handle,
        )
    except (AuthError, HandleError) as exc:
        _auth_error(exc)
    return _token(user)


@router.post("/auth/google", response_model=TokenOut)
def auth_google(body: GoogleAuthIn, db: DbDep) -> TokenOut:
    try:
        claims = verify_google_token(body.id_token)
        user = upsert_user(
            db,
            provider="google",
            subject=str(claims["sub"]),
            display_name=claims.get("name") or "Member",
            email=claims.get("email"),
            avatar_url=claims.get("picture"),
            handle=body.handle,
        )
    except (AuthError, HandleError) as exc:
        _auth_error(exc)
    return _token(user)


@router.post("/auth/dev", response_model=TokenOut)
def auth_dev(body: DevAuthIn, db: DbDep) -> TokenOut:
    if not get_settings().allow_dev_auth:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    subject = body.email or body.handle or body.display_name
    try:
        user = upsert_user(
            db,
            provider="dev",
            subject=subject.lower(),
            display_name=body.display_name,
            email=body.email,
            handle=body.handle,
            handle_hint=body.handle or body.display_name,
        )
    except HandleError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=exc.code) from exc
    return _token(user)


@router.get("/me", response_model=UserOut)
def me(user: UserDep) -> UserOut:
    return user_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(body: MeUpdate, user: UserDep, db: DbDep) -> UserOut:
    if body.display_name:
        user.display_name = body.display_name
    if body.handle:
        try:
            handle = validate_handle(body.handle)
        except HandleError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=exc.code) from exc
        taken = db.scalar(select(User.id).where(User.handle == handle, User.id != user.id))
        if taken:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="handle_taken")
        user.handle = handle
        user.handle_set = True
    db.commit()
    db.refresh(user)
    return user_out(user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(user: UserDep, db: DbDep) -> None:
    now = datetime.now(timezone.utc)
    for poll in list(db.scalars(select(Poll).where(Poll.author_id == user.id))):
        poll.status = "deleted"
    db.execute(delete(TopicFollow).where(TopicFollow.user_id == user.id))
    db.execute(
        delete(UserFollow).where(
            (UserFollow.follower_id == user.id) | (UserFollow.followee_id == user.id)
        )
    )
    db.execute(
        delete(UserBlock).where((UserBlock.blocker_id == user.id) | (UserBlock.blocked_id == user.id))
    )
    db.execute(delete(Notification).where(Notification.user_id == user.id))
    db.execute(delete(PushToken).where(PushToken.user_id == user.id))
    db.execute(delete(Vote).where(Vote.user_id == user.id))
    user.deleted_at = now
    user.email = None
    user.display_name = "Deleted"
    user.handle = f"deleted_{user.id[:8]}"
    user.handle_set = True
    user.avatar_url = None
    db.commit()


@router.post("/me/push-token")
def register_push(body: PushTokenIn, user: UserDep, db: DbDep) -> dict[str, str]:
    existing = db.scalar(select(PushToken).where(PushToken.user_id == user.id, PushToken.token == body.token))
    if existing is None:
        db.add(PushToken(user_id=user.id, token=body.token, platform=body.platform))
        db.commit()
    return {"status": "ok"}


@router.get("/me/notifications", response_model=list[NotificationOut])
def list_notifications(user: UserDep, db: DbDep) -> list[NotificationOut]:
    rows = list(
        db.scalars(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
    )
    return [NotificationOut.model_validate(row) for row in rows]
