from typing import Literal

from sqlmodel import SQLModel

from src.models.analytics import CrosstabResponse, TrendResponse


class ChatMessage(SQLModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(SQLModel):
    messages: list[ChatMessage]


class AICrosstabResultPart(SQLModel):
    type: Literal["crosstab_result"] = "crosstab_result"
    query_config: dict
    data: CrosstabResponse


class AITrendResultPart(SQLModel):
    type: Literal["trend_result"] = "trend_result"
    query_config: dict
    data: TrendResponse
