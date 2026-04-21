from typing import Literal

from sqlmodel import SQLModel

from src.models.analytics import CrosstabResponse, TrendResponse


class _ContentPart(SQLModel):
    type: str
    text: str | None = None


class ChatMessage(SQLModel):
    role: Literal["user", "assistant"]
    # AI SDK v6 UIMessage format sends parts; legacy format sends content
    parts: list[_ContentPart] | None = None
    content: str | list[_ContentPart] | None = None

    def get_text(self) -> str:
        if self.parts:
            return "".join(p.text or "" for p in self.parts if p.type == "text")
        if isinstance(self.content, list):
            return "".join(p.text or "" for p in self.content if p.type == "text")
        return self.content or ""


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
