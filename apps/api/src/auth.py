from dataclasses import dataclass, field

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_session

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    clerk_id: str
    email: str
    org_id: str | None
    is_superuser: bool = field(default=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if settings.auth_mode == "dev":
        return CurrentUser(
            clerk_id="dev_user",
            email="dev@example.com",
            org_id=None,
            is_superuser=settings.dev_superuser,
        )

    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.clerk_jwt_key,
            algorithms=["RS256"],
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    public_metadata = payload.get("public_metadata") or {}
    is_superuser = public_metadata.get("role") == "superuser"

    return CurrentUser(
        clerk_id=payload["sub"],
        email=payload.get("email", ""),
        org_id=payload.get("org_id"),
        is_superuser=is_superuser,
    )


async def _get_accessible_package_ids(
    current_user: CurrentUser,
    session: AsyncSession,
) -> set[int] | None:
    """Return the set of package IDs accessible to the user.

    Returns None when all packages should be accessible (dev mode or superuser).
    """
    if settings.auth_mode == "dev":
        return None
    if current_user.is_superuser:
        return None
    from src.repositories import package_repo

    return await package_repo.get_accessible_ids(session, current_user)


async def get_accessible_package_ids(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> set[int] | None:
    """FastAPI dependency: accessible package IDs for the current user."""
    return await _get_accessible_package_ids(current_user, session)
