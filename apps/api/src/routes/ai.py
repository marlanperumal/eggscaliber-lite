from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import get_accessible_package_ids, get_current_user
from src.database import get_session
from src.models.ai import ChatRequest
from src.services.ai_service import stream_response

router = APIRouter(tags=["ai"])


@router.post(
    "/ai/chat",
    response_class=StreamingResponse,
    responses={
        200: {
            "content": {"text/event-stream": {}},
            "description": "Vercel AI SDK UI message stream",
        }
    },
)
async def chat(
    request: ChatRequest,
    accessible_ids: set[int] | None = Depends(get_accessible_package_ids),
    session: AsyncSession = Depends(get_session),
    _=Depends(get_current_user),
):
    """Stream a grounded AI response to a natural-language question about your data."""
    return StreamingResponse(
        stream_response(session, request.messages, accessible_ids),
        media_type="text/event-stream",
        headers={"x-vercel-ai-ui-message-stream": "v1"},
    )
