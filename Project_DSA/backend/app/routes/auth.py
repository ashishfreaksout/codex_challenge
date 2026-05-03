from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from app.models.schemas import AuthRequest, AuthResponse, UserPreferences, UserProfile
from app.services.storage import (
    authenticate_user,
    create_session,
    create_user,
    get_user_by_token,
    update_user_preferences,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def get_current_user(authorization: Optional[str] = Header(default=None)) -> UserProfile:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in to continue.")

    token = authorization.split(" ", 1)[1].strip()
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")

    return user


@router.post("/signup", response_model=AuthResponse)
def signup(payload: AuthRequest) -> AuthResponse:
    try:
        user = create_user(payload.email, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    token = create_session(user.id)
    return AuthResponse(token=token, user=user)


@router.post("/login", response_model=AuthResponse)
def login(payload: AuthRequest) -> AuthResponse:
    user = authenticate_user(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")

    token = create_session(user.id)
    return AuthResponse(token=token, user=user)


@router.get("/me", response_model=UserProfile)
def me(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    return user


@router.put("/preferences", response_model=UserProfile)
def update_preferences(
    preferences: UserPreferences,
    user: UserProfile = Depends(get_current_user),
) -> UserProfile:
    return update_user_preferences(user.id, preferences)
