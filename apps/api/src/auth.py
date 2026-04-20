from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.config import settings

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    clerk_id: str
    email: str
    org_id: str | None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if settings.auth_mode == "dev":
        return CurrentUser(clerk_id="dev_user", email="dev@example.com", org_id=None)

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

    return CurrentUser(
        clerk_id=payload["sub"],
        email=payload.get("email", ""),
        org_id=payload.get("org_id"),
    )
