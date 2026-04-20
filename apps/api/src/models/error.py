from sqlmodel import SQLModel


class ErrorResponse(SQLModel):
    status: int
    code: str
    detail: str
