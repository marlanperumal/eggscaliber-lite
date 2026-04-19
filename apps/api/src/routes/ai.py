from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.models.ai import ChatRequest
from src.services.ai_service import stream_response

router = APIRouter(tags=["ai"])


@router.post(
    "/ai/chat",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/plain": {}}, "description": "Vercel AI SDK data stream"}},
)
async def chat(request: ChatRequest, session: AsyncSession = Depends(get_session)):
    """Stream a grounded AI response to a natural-language question about your data."""
    return StreamingResponse(
        stream_response(session, request.messages),
        media_type="text/plain; charset=utf-8",
        headers={"X-Vercel-AI-Data-Stream": "v1"},
    )
