from datetime import datetime

from sqlmodel import Field, SQLModel


class ApiToken(SQLModel, table=True):
    __tablename__ = "api_tokens"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    name: str
    token_hash: str = Field(unique=True, index=True)
    prefix: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_used_at: datetime | None = Field(default=None)
    revoked_at: datetime | None = Field(default=None)


class ApiTokenRead(SQLModel):
    id: int
    name: str
    prefix: str
    created_at: datetime
    last_used_at: datetime | None = None


class ApiTokenCreated(ApiTokenRead):
    raw_token: str
