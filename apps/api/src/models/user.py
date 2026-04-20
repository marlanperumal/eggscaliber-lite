from datetime import datetime

from sqlmodel import Field, SQLModel


class UserBase(SQLModel):
    clerk_id: str = Field(unique=True, index=True)
    email: str
    display_name: str | None = None


class User(UserBase, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserRead(UserBase):
    id: int
    created_at: datetime


class OrganisationBase(SQLModel):
    clerk_org_id: str = Field(unique=True, index=True)
    name: str


class Organisation(OrganisationBase, table=True):
    __tablename__ = "organisations"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class OrganisationRead(OrganisationBase):
    id: int
    created_at: datetime


class OrgMembershipBase(SQLModel):
    user_id: int = Field(foreign_key="users.id")
    org_id: int = Field(foreign_key="organisations.id")
    role: str


class OrgMembership(OrgMembershipBase, table=True):
    __tablename__ = "org_memberships"

    id: int | None = Field(default=None, primary_key=True)


class OrgMembershipRead(OrgMembershipBase):
    id: int


class WebhookAck(SQLModel):
    status: str
